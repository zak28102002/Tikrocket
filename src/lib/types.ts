/** API DTOs shared by server services and client components. Numbers are plain; null = N/A. */
import type { DayKey } from "./dates";
import type { PlatformKey } from "./profile-url";
import type { ResolvedRange } from "./range";

export type RoleKey = "ADMIN" | "MEMBER" | "VIEWER";
export type AccountStatusKey = "PENDING" | "SYNCING" | "HEALTHY" | "ERROR" | "UNAVAILABLE" | "PAUSED";
export type MetricKey = "views" | "likes" | "followers" | "posts" | "comments" | "shares";

export type Summary = {
  metric: MetricKey;
  kind: "flow" | "stock";
  value: number | null;
  previous: number | null;
  change: number | null;
  changePct: number | null;
  lifetime: number | null;
  today: number | null;
  partialSince: DayKey | null;
  comparable: boolean;
};

export type ChartPoint = { date: DayKey; value: number | null; change: number | null };

export type AppRef = { id: string; name: string; iconUrl: string | null; iconSeed: number };

export type AccountRef = {
  id: string;
  platform: PlatformKey;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export type AppSummary = AppRef & {
  description: string | null;
  accountCount: number;
  views: Summary;
  likes: Summary;
  posts: Summary;
  followers: Summary;
  spark: (number | null)[];
};

export type AccountRow = AccountRef & {
  app: AppRef;
  profileUrl: string;
  status: AccountStatusKey;
  userError: string | null;
  lastSyncedAt: string | null;
  followers: number | null;
  totalViews: number | null;
  totalLikes: number | null;
  postCount: number | null;
  viewsSource: "PROFILE" | "POSTS" | null;
  period: { views: number | null; viewsPct: number | null; followers: number | null };
  spark: (number | null)[];
  refreshMinutes: number | null;
  activeJobId: string | null;
};

export type PostCard = {
  id: string;
  platform: PlatformKey;
  url: string;
  thumbnailUrl: string | null;
  caption: string | null;
  publishedAt: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  /** Views gained within the selected period, when computed. */
  periodViews?: number | null;
  account: AccountRef;
  app: AppRef;
};

export type ActivityItem = {
  id: string;
  type: "ACCOUNT_ADDED" | "ACCOUNT_UPDATED" | "POST_DETECTED" | "VIEWS_MILESTONE" | "SYNC_FAILED";
  createdAt: string;
  account: AccountRef | null;
  post: { id: string; thumbnailUrl: string | null; caption: string | null } | null;
  payload: Record<string, unknown> | null;
};

export type OverviewResponse = {
  range: ResolvedRange;
  kpis: { views: Summary; likes: Summary; posts: Summary; followers: Summary };
  chart: ChartPoint[];
  apps: AppSummary[];
  topAccounts: (AccountRow & { rank: number })[];
  topContent: PostCard[];
  activity: ActivityItem[];
  counts: { apps: number; accounts: number; healthy: number; unavailable: number; syncing: number };
};

export type PlatformBreakdown = { platform: PlatformKey; views: number | null; followers: number | null; accounts: number };

export type AppDetailResponse = {
  range: ResolvedRange;
  app: AppRef & { description: string | null; createdAt: string };
  kpis: { views: Summary; likes: Summary; posts: Summary; followers: Summary };
  charts: Record<"views" | "likes" | "followers" | "posts", ChartPoint[]>;
  platforms: PlatformBreakdown[];
  accounts: AccountRow[];
  topContent: PostCard[];
};

export type AccountDetailResponse = {
  range: ResolvedRange;
  account: AccountRow & {
    bio: string | null;
    isVerified: boolean | null;
    following: number | null;
    trackingSince: string | null;
    nextRefreshAt: string | null;
    connector: { id: string; label: string; configured: boolean; capabilities: { postViews: boolean; shares: boolean; profileViews: boolean } };
    devErrorDetail: string | null;
  };
  kpis: { views: Summary; likes: Summary; posts: Summary; followers: Summary };
  charts: Record<"views" | "likes" | "followers" | "posts", ChartPoint[]>;
  engagementRate: number | null;
  avgViewsPerPost: number | null;
};

export type PostDetailResponse = {
  post: PostCard & { durationSec: number | null; firstSeenAt: string; lastSyncedAt: string | null };
  engagementRate: number | null;
  /** Views per day since publication (Day 1 = publish day). */
  timeline: { day: number; date: DayKey; views: number | null; likes: number | null; gained: number | null }[];
  trackingStartedDay: number | null;
};

export type JobStatusResponse = {
  id: string;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "PARTIAL" | "FAILED" | "CANCELLED";
  stage: "QUEUED" | "CHECKING_PROFILE" | "FINDING_CONTENT" | "COLLECTING_METRICS" | "FINALIZING" | "DONE";
  postsFound: number | null;
  userError: string | null;
  accountId: string;
  accountStatus: AccountStatusKey;
};

export type ResolveResponse =
  | { ok: false; reason: string }
  | {
      ok: true;
      platform: PlatformKey;
      username: string;
      canonicalUrl: string;
      connectorConfigured: boolean;
      existing: { id: string; appName: string } | null;
    };

export type CompareResponse = {
  range: ResolvedRange;
  metric: MetricKey;
  apps: (AppRef & { summary: Summary; series: ChartPoint[] })[];
};

export type SearchResponse = {
  apps: AppRef[];
  accounts: (AccountRef & { app: AppRef })[];
  posts: PostCard[];
};

export type ViewerInfo = {
  user: { id: string; name: string; email: string; avatarUrl: string | null };
  workspace: { id: string; name: string; isDemo: boolean; timezone: string; defaultRefreshMinutes: number };
  role: RoleKey;
  workspaces: { id: string; name: string; isDemo: boolean; role: RoleKey }[];
};
