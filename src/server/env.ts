import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
  CRON_SECRET: z.string().default(""),
  PULSE_ENABLE_DEMO: z
    .string()
    .default("false")
    .transform((v) => v === "true" || v === "1"),
  YOUTUBE_API_KEY: z.string().default(""),
  META_IG_BUSINESS_ACCOUNT_ID: z.string().default(""),
  META_ACCESS_TOKEN: z.string().default(""),
  META_GRAPH_VERSION: z.string().default("v21.0"),
  TIKTOK_PROVIDER: z.string().default(""),
  TIKTOK_PROVIDER_BASE_URL: z.string().default(""),
  TIKTOK_PROVIDER_API_KEY: z.string().default(""),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(3),
  NODE_ENV: z.string().default("development"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Server-only, validated environment. Never import from client components. */
export function env(): Env {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}
