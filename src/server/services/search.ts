import "server-only";
import { db } from "@/server/db";
import type { SearchResponse } from "@/lib/types";
import type { Viewer } from "@/server/auth/session";
import { accountRef, appRef, postCard, postInclude } from "./shared";

export async function search(viewer: Viewer, q: string): Promise<SearchResponse> {
  const term = q.trim().replace(/^@/, "");
  if (!term) return { apps: [], accounts: [], posts: [] };
  const ws = viewer.workspace.id;
  const ci = { contains: term, mode: "insensitive" as const };
  const [apps, accounts, posts] = await Promise.all([
    db.app.findMany({ where: { workspaceId: ws, OR: [{ name: ci }, { description: ci }] }, take: 5, orderBy: { name: "asc" } }),
    db.socialAccount.findMany({
      where: { workspaceId: ws, OR: [{ username: ci }, { displayName: ci }, { app: { name: ci } }] },
      include: { app: true },
      take: 6,
      orderBy: { totalViews: { sort: "desc", nulls: "last" } },
    }),
    db.post.findMany({
      where: { workspaceId: ws, OR: [{ caption: ci }, { app: { name: ci } }, { account: { username: ci } }] },
      include: postInclude,
      take: 5,
      orderBy: { views: { sort: "desc", nulls: "last" } },
    }),
  ]);
  return {
    apps: apps.map(appRef),
    accounts: accounts.map((a) => ({ ...accountRef(a), app: appRef(a.app) })),
    posts: posts.map((p) => postCard(p)),
  };
}
