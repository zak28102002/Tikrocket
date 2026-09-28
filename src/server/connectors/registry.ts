import { env } from "@/server/env";
import type { PlatformKey } from "@/lib/profile-url";
import { PLATFORMS } from "@/lib/platforms";
import type { PlatformConnector } from "./types";
import { YouTubeConnector } from "./youtube";
import { InstagramConnector } from "./instagram";
import { TikTokConnector } from "./tiktok";
import { MockConnector } from "./mock";

/**
 * The single place that knows which implementation serves which platform.
 * Adding a platform (X, Threads, Reddit…) = new connector folder + one entry here
 * + a Platform enum value.
 */
let production: Record<PlatformKey, PlatformConnector> | null = null;

function productionConnectors() {
  production ??= {
    YOUTUBE: new YouTubeConnector(),
    INSTAGRAM: new InstagramConnector(),
    TIKTOK: new TikTokConnector(),
  };
  return production;
}

const mocks: Partial<Record<PlatformKey, MockConnector>> = {};

/**
 * Demo workspaces always use the mock connector (when demo mode is enabled).
 * Real workspaces never do — an unconfigured platform surfaces as "Data unavailable".
 */
export function connectorFor(platform: PlatformKey, workspace: { isDemo: boolean }): PlatformConnector {
  if (workspace.isDemo) {
    if (!env().PULSE_ENABLE_DEMO) return productionConnectors()[platform];
    return (mocks[platform] ??= new MockConnector(platform));
  }
  return productionConnectors()[platform];
}

export function connectorStatus(workspace: { isDemo: boolean }) {
  return PLATFORMS.map((p) => {
    const c = connectorFor(p, workspace);
    return {
      platform: p,
      connectorId: c.id,
      label: c.label,
      configured: c.isConfigured(),
      capabilities: c.capabilities,
    };
  });
}
