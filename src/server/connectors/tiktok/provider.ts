import type { NormalizedPost, NormalizedProfile, NormalizedProfileMetrics } from "../types";

/**
 * Transport for TikTok data. The TikTok connector owns handle parsing and
 * normalization rules; a provider only knows how to talk to one licensed data
 * vendor. Swapping vendors = adding one file in ./providers and a registry line.
 */
export interface TikTokDataProvider {
  readonly id: string;
  readonly label: string;
  fetchProfile(handle: string): Promise<{ profile: Omit<NormalizedProfile, "platform">; metrics: NormalizedProfileMetrics }>;
  fetchVideos(handle: string, limit: number): Promise<NormalizedPost[]>;
}
