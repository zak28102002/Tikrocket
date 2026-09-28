import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { __pulsePrisma?: PrismaClient };

function create() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.__pulsePrisma ?? create();
if (process.env.NODE_ENV !== "production") globalForPrisma.__pulsePrisma = db;

export { Prisma } from "@/generated/prisma/client";
export type { Platform, Role, AccountStatus, JobStatus, JobStage } from "@/generated/prisma/enums";
