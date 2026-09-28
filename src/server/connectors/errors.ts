import type { PlatformKey } from "@/lib/profile-url";
import { PLATFORM_META } from "@/lib/platforms";

export type ConnectorErrorCode =
  | "NOT_FOUND"
  | "PRIVATE"
  | "UNSUPPORTED_ACCOUNT"
  | "RATE_LIMITED"
  | "NOT_CONFIGURED"
  | "AUTH"
  | "UPSTREAM";

export class ConnectorError extends Error {
  constructor(
    public code: ConnectorErrorCode,
    public platform: PlatformKey,
    /** Technical detail for logs / "View details". Never shown as the headline. */
    public detail: string,
    public retryable = code === "RATE_LIMITED" || code === "UPSTREAM",
  ) {
    super(`[${platform}] ${code}: ${detail}`);
  }

  /** Calm, human copy for the UI. */
  get userMessage(): string {
    const name = PLATFORM_META[this.platform].label;
    switch (this.code) {
      case "NOT_FOUND":
        return `We couldn't find this ${name} profile. Check the URL and try again.`;
      case "PRIVATE":
        return `This ${name} profile is private. Pulse only tracks public profiles.`;
      case "UNSUPPORTED_ACCOUNT":
        return name === "Instagram"
          ? "Instagram only shares data for Business and Creator profiles."
          : `${name} doesn't share data for this kind of profile.`;
      case "RATE_LIMITED":
        return `${name} asked us to slow down. We'll try again shortly.`;
      case "NOT_CONFIGURED":
        return `${name} data isn't available yet. A data source hasn't been configured.`;
      case "AUTH":
        return `Pulse's ${name} connection needs attention. An admin can check Settings.`;
      default:
        return `${name} temporarily didn't return the requested data.`;
    }
  }
}

/** Turn any thrown value into a ConnectorError for consistent handling. */
export function asConnectorError(err: unknown, platform: PlatformKey): ConnectorError {
  if (err instanceof ConnectorError) return err;
  const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return new ConnectorError("UPSTREAM", platform, detail);
}
