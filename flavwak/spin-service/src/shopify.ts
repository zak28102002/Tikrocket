/**
 * Minimal Shopify Admin GraphQL client for creating Spin-to-Win discount codes.
 * Runs server-side only; credentials come from environment variables.
 */

export interface CreateDiscountInput {
  code: string;
  percent: number;
  /** Ties the spin to the Shopify discount for audits and crash recovery. */
  spinId: string;
  startsAt: Date;
  endsAt: Date;
  /** gid://shopify/Customer/… — when set, only this customer can redeem the code. */
  customerGid: string | null;
}

export interface CreatedDiscount {
  discountId: string;
  code: string;
  endsAt: Date;
}

export interface DiscountGateway {
  createPercentCode(input: CreateDiscountInput): Promise<CreatedDiscount>;
}

export class ShopifyError extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "ShopifyError";
    this.retryable = retryable;
  }
}

export interface ShopifyClientOptions {
  shop: string;
  apiVersion: string;
  /** A static Admin API token (shpat_…), or … */
  accessToken?: string;
  /** … Dev Dashboard app credentials for the client credentials grant (24 h tokens). */
  clientId?: string;
  clientSecret?: string;
  combinesWithShipping: boolean;
  fetchImpl?: typeof fetch;
}

const CREATE_MUTATION = /* GraphQL */ `
  mutation SpinDiscountCreate($input: DiscountCodeBasicInput!) {
    discountCodeBasicCreate(basicCodeDiscount: $input) {
      codeDiscountNode {
        id
        codeDiscount {
          ... on DiscountCodeBasic {
            title
            status
            endsAt
            usageLimit
            appliesOncePerCustomer
          }
        }
      }
      userErrors { field code message }
    }
  }
`;

const LOOKUP_QUERY = /* GraphQL */ `
  query SpinDiscountByCode($code: String!) {
    codeDiscountNodeByCode(code: $code) {
      id
      codeDiscount {
        ... on DiscountCodeBasic {
          title
          status
          endsAt
          usageLimit
          asyncUsageCount
        }
      }
    }
  }
`;

export function discountTitle(percent: number, spinId: string): string {
  return `Spin to Win ${percent}% · ${spinId}`;
}

export class ShopifyDiscountGateway implements DiscountGateway {
  private readonly opts: ShopifyClientOptions;
  private readonly fetchImpl: typeof fetch;
  private token: { value: string; expiresAt: number } | null = null;

  constructor(opts: ShopifyClientOptions) {
    if (!opts.accessToken && !(opts.clientId && opts.clientSecret)) {
      throw new Error("Shopify credentials missing: set SHOPIFY_ADMIN_ACCESS_TOKEN or SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET");
    }
    this.opts = opts;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async createPercentCode(input: CreateDiscountInput): Promise<CreatedDiscount> {
    const variables = {
      input: {
        title: discountTitle(input.percent, input.spinId),
        code: input.code,
        startsAt: input.startsAt.toISOString(),
        endsAt: input.endsAt.toISOString(),
        // One successful use in total, and at most once per customer.
        usageLimit: 1,
        appliesOncePerCustomer: true,
        customerGets: { value: { percentage: input.percent / 100 }, items: { all: true } },
        context: input.customerGid ? { customers: { add: [input.customerGid] } } : { all: "ALL" },
        // Never stacks with other codes or with the automatic multi-pack discounts.
        combinesWith: { orderDiscounts: false, productDiscounts: false, shippingDiscounts: this.opts.combinesWithShipping },
      },
    };

    const data = await this.graphql<{
      discountCodeBasicCreate: {
        codeDiscountNode: { id: string; codeDiscount: { endsAt: string | null } } | null;
        userErrors: { field: string[] | null; code: string | null; message: string }[];
      };
    }>(CREATE_MUTATION, variables);

    const payload = data.discountCodeBasicCreate;
    if (payload.codeDiscountNode && !payload.userErrors.length) {
      return {
        discountId: payload.codeDiscountNode.id,
        code: input.code,
        endsAt: new Date(payload.codeDiscountNode.codeDiscount.endsAt ?? input.endsAt),
      };
    }

    // A previous attempt may have created the code before we could record it (crash,
    // timeout). If the existing code is ours, adopt it instead of failing.
    const taken = payload.userErrors.some((e) => e.code === "TAKEN" || /taken|unique|already/i.test(e.message));
    if (taken) {
      const existing = await this.findOwnCode(input.code, input.spinId);
      if (existing) return existing;
      throw new ShopifyError("code_collision", true);
    }
    throw new ShopifyError(`discount_rejected: ${payload.userErrors.map((e) => e.message).join("; ")}`, false);
  }

  private async findOwnCode(code: string, spinId: string): Promise<CreatedDiscount | null> {
    const data = await this.graphql<{
      codeDiscountNodeByCode: { id: string; codeDiscount: { title?: string; endsAt?: string | null } } | null;
    }>(LOOKUP_QUERY, { code });
    const node = data.codeDiscountNodeByCode;
    if (!node || !node.codeDiscount.title?.endsWith(`· ${spinId}`) || !node.codeDiscount.endsAt) return null;
    return { discountId: node.id, code, endsAt: new Date(node.codeDiscount.endsAt) };
  }

  private async graphql<T>(query: string, variables: Record<string, unknown>, attempt = 1): Promise<T> {
    const url = `https://${this.opts.shop}/admin/api/${this.opts.apiVersion}/graphql.json`;
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": await this.accessToken() },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      throw new ShopifyError(`network: ${(err as Error).message}`, true);
    }

    if (res.status === 401 && !this.opts.accessToken && attempt === 1) {
      this.token = null; // expired client-credentials token
      return this.graphql<T>(query, variables, attempt + 1);
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await sleep(400 * attempt);
      return this.graphql<T>(query, variables, attempt + 1);
    }
    if (!res.ok) throw new ShopifyError(`http_${res.status}`, res.status === 429 || res.status >= 500);

    const body = (await res.json()) as { data?: T; errors?: { message: string; extensions?: { code?: string } }[] };
    if (body.errors?.length) {
      const throttled = body.errors.some((e) => e.extensions?.code === "THROTTLED");
      if (throttled && attempt < 3) {
        await sleep(800 * attempt);
        return this.graphql<T>(query, variables, attempt + 1);
      }
      throw new ShopifyError(`graphql: ${body.errors.map((e) => e.message).join("; ")}`, throttled);
    }
    if (!body.data) throw new ShopifyError("graphql: empty response", true);
    return body.data;
  }

  private async accessToken(): Promise<string> {
    if (this.opts.accessToken) return this.opts.accessToken;
    if (this.token && this.token.expiresAt > Date.now()) return this.token.value;

    // https://shopify.dev/docs/apps/build/authentication-authorization/client-credentials-grant
    const res = await this.fetchImpl(`https://${this.opts.shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.opts.clientId!,
        client_secret: this.opts.clientSecret!,
        grant_type: "client_credentials",
      }),
      signal: AbortSignal.timeout(10_000),
    }).catch((err: Error) => {
      throw new ShopifyError(`token network: ${err.message}`, true);
    });
    if (!res.ok) throw new ShopifyError(`token http_${res.status}`, res.status >= 500);
    const body = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) throw new ShopifyError("token: no access_token in response", false);
    const ttl = Math.max(60, (body.expires_in ?? 86_399) - 300) * 1000;
    this.token = { value: body.access_token, expiresAt: Date.now() + ttl };
    return body.access_token;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
