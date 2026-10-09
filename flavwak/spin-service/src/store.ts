import pg from "pg";
import type { OutcomeKey } from "./prizes.ts";

export type SpinStatus = "pending" | "issued" | "lost";

export interface SpinRecord {
  id: string;
  visitorId: string;
  customerId: string | null;
  ipHash: string | null;
  outcome: OutcomeKey;
  percent: number;
  segmentIndex: number;
  /** pending = outcome rolled, discount not created yet (or creation failed; retried with the same outcome). */
  status: SpinStatus;
  code: string | null;
  discountId: string | null;
  expiresAt: Date | null;
  attempts: number;
  createdAt: Date;
}

const MIGRATION = `
create table if not exists spins (
  id            text primary key,
  visitor_id    text not null,
  customer_id   text,
  ip_hash       text,
  outcome       text not null,
  percent       integer not null,
  segment_index integer not null,
  status        text not null check (status in ('pending', 'issued', 'lost')),
  code          text unique,
  discount_id   text,
  expires_at    timestamptz,
  attempts      integer not null default 0,
  last_error    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists spins_visitor_idx on spins (visitor_id, created_at desc);
create index if not exists spins_customer_idx on spins (customer_id, created_at desc) where customer_id is not null;
create index if not exists spins_ip_idx on spins (ip_hash, created_at desc) where ip_hash is not null;
`;

function toRecord(r: Record<string, unknown>): SpinRecord {
  return {
    id: r.id as string,
    visitorId: r.visitor_id as string,
    customerId: (r.customer_id as string | null) ?? null,
    ipHash: (r.ip_hash as string | null) ?? null,
    outcome: r.outcome as OutcomeKey,
    percent: r.percent as number,
    segmentIndex: r.segment_index as number,
    status: r.status as SpinStatus,
    code: (r.code as string | null) ?? null,
    discountId: (r.discount_id as string | null) ?? null,
    expiresAt: r.expires_at ? new Date(r.expires_at as string) : null,
    attempts: r.attempts as number,
    createdAt: new Date(r.created_at as string),
  };
}

export interface Identity {
  visitorId: string;
  customerId: string | null;
}

/** Queries usable inside `withIdentityLock`. */
export interface LockedStore {
  findRecent(identity: Identity, since: Date): Promise<SpinRecord | null>;
  countByIpSince(ipHash: string, since: Date): Promise<number>;
  insert(rec: Omit<SpinRecord, "attempts" | "createdAt">): Promise<SpinRecord>;
  setCode(id: string, code: string): Promise<void>;
  markIssued(id: string, discountId: string, code: string, expiresAt: Date): Promise<SpinRecord>;
  markFailed(id: string, error: string): Promise<void>;
}

export class SpinStore {
  readonly pool: pg.Pool;

  constructor(databaseUrl: string, poolSize = 10) {
    this.pool = new pg.Pool({ connectionString: databaseUrl, max: poolSize });
  }

  async migrate(): Promise<void> {
    await this.pool.query(MIGRATION);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async findRecent(identity: Identity, since: Date): Promise<SpinRecord | null> {
    return findRecent(this.pool, identity, since);
  }

  /**
   * Runs `fn` while holding Postgres session advisory locks on the visitor and (when
   * logged in) the customer. Concurrent spins for the same person queue here, so
   * refreshes, double clicks and retries can never mint two rewards. Locks are taken
   * in a fixed order (visitor, then customer) so they cannot deadlock, and they are
   * released automatically if the process dies mid-request.
   */
  async withIdentityLock<T>(identity: Identity, fn: (db: LockedStore) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    const keys = [`visitor:${identity.visitorId}`, ...(identity.customerId ? [`customer:${identity.customerId}`] : [])];
    let locked = 0;
    try {
      await client.query("set lock_timeout = '20s'");
      for (const key of keys) {
        await client.query("select pg_advisory_lock(hashtextextended($1, 0))", [key]);
        locked++;
      }
      return await fn(lockedStore(client));
    } finally {
      for (const key of keys.slice(0, locked).reverse()) {
        await client.query("select pg_advisory_unlock(hashtextextended($1, 0))", [key]).catch(() => {});
      }
      client.release();
    }
  }
}

type Queryable = Pick<pg.Pool, "query"> | pg.PoolClient;

async function findRecent(db: Queryable, identity: Identity, since: Date): Promise<SpinRecord | null> {
  const { rows } = await db.query(
    `select * from spins
      where (visitor_id = $1 or ($2::text is not null and customer_id = $2))
        and created_at > $3
      order by created_at desc
      limit 1`,
    [identity.visitorId, identity.customerId, since],
  );
  return rows[0] ? toRecord(rows[0]) : null;
}

function lockedStore(client: pg.PoolClient): LockedStore {
  return {
    findRecent: (identity, since) => findRecent(client, identity, since),
    async countByIpSince(ipHash, since) {
      const { rows } = await client.query("select count(*)::int as n from spins where ip_hash = $1 and created_at > $2", [ipHash, since]);
      return rows[0].n as number;
    },
    async insert(rec) {
      const { rows } = await client.query(
        `insert into spins (id, visitor_id, customer_id, ip_hash, outcome, percent, segment_index, status, code, discount_id, expires_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning *`,
        [rec.id, rec.visitorId, rec.customerId, rec.ipHash, rec.outcome, rec.percent, rec.segmentIndex, rec.status, rec.code, rec.discountId, rec.expiresAt],
      );
      return toRecord(rows[0]);
    },
    async setCode(id, code) {
      await client.query("update spins set code = $2, updated_at = now() where id = $1", [id, code]);
    },
    async markIssued(id, discountId, code, expiresAt) {
      const { rows } = await client.query(
        `update spins set status = 'issued', discount_id = $2, code = $3, expires_at = $4, last_error = null,
                attempts = attempts + 1, updated_at = now()
          where id = $1 returning *`,
        [id, discountId, code, expiresAt],
      );
      return toRecord(rows[0]);
    },
    async markFailed(id, error) {
      await client.query("update spins set attempts = attempts + 1, last_error = $2, updated_at = now() where id = $1", [id, error.slice(0, 500)]);
    },
  };
}
