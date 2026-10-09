import { parseProbabilities, validatePrizeConfig, WHEEL } from "./prizes.ts";
import type { SpinSettings } from "./spin.ts";

export interface Config {
  port: number;
  databaseUrl: string;
  shop: string;
  apiVersion: string;
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
  /** Verifies App Proxy signatures: the app's client secret ("API secret key"). */
  proxySecret: string;
  /** Signs visitor tokens and hashes IPs. Any long random string, kept stable. */
  visitorSecret: string;
  signatureMaxAgeSeconds: number;
  allowUnsigned: boolean;
  combinesWithShipping: boolean;
  spin: SpinSettings;
}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const v = env[key]?.trim();
  if (!v) throw new Error(`Missing required environment variable ${key}`);
  return v;
}

function num(env: NodeJS.ProcessEnv, key: string, fallback: number, min: number, max: number): number {
  const raw = env[key]?.trim();
  if (!raw) return fallback;
  const v = Number(raw);
  if (!Number.isFinite(v) || v < min || v > max) throw new Error(`${key} must be a number between ${min} and ${max}`);
  return v;
}

function bool(env: NodeJS.ProcessEnv, key: string, fallback: boolean): boolean {
  const raw = env[key]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (["1", "true", "yes"].includes(raw)) return true;
  if (["0", "false", "no"].includes(raw)) return false;
  throw new Error(`${key} must be true or false`);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const probabilities = parseProbabilities(env.SPIN_PROBABILITIES);
  validatePrizeConfig(probabilities, WHEEL);

  const clientSecret = env.SHOPIFY_CLIENT_SECRET?.trim() || undefined;
  const allowUnsigned = bool(env, "SPIN_ALLOW_UNSIGNED", false);
  if (allowUnsigned && env.NODE_ENV === "production") throw new Error("SPIN_ALLOW_UNSIGNED must never be enabled in production");

  const visitorSecret = required(env, "SPIN_VISITOR_SECRET");
  if (visitorSecret.length < 32) throw new Error("SPIN_VISITOR_SECRET must be at least 32 characters");

  const shop = required(env, "SHOPIFY_SHOP_DOMAIN").toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) throw new Error("SHOPIFY_SHOP_DOMAIN must look like your-store.myshopify.com");

  return {
    port: num(env, "PORT", 8080, 1, 65535),
    databaseUrl: required(env, "DATABASE_URL"),
    shop,
    apiVersion: env.SHOPIFY_API_VERSION?.trim() || "2026-10",
    accessToken: env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim() || undefined,
    clientId: env.SHOPIFY_CLIENT_ID?.trim() || undefined,
    clientSecret,
    proxySecret: env.SHOPIFY_APP_PROXY_SECRET?.trim() || clientSecret || required(env, "SHOPIFY_APP_PROXY_SECRET"),
    visitorSecret,
    signatureMaxAgeSeconds: num(env, "SPIN_SIGNATURE_MAX_AGE_SECONDS", 300, 30, 3600),
    allowUnsigned,
    combinesWithShipping: bool(env, "SPIN_COMBINES_WITH_SHIPPING", true),
    spin: {
      probabilities,
      wheel: WHEEL,
      codeValidHours: num(env, "SPIN_CODE_VALID_HOURS", 48, 1, 24 * 90),
      cooldownDays: num(env, "SPIN_COOLDOWN_DAYS", 30, 0, 3650),
      maxSpinsPerIpPerDay: num(env, "SPIN_MAX_SPINS_PER_IP_PER_DAY", 5, 0, 10_000),
      lockCodeToCustomer: bool(env, "SPIN_LOCK_CODE_TO_CUSTOMER", true),
    },
  };
}
