"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Check, Copy, Monitor, Moon, Sun, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useCan, useTheme } from "@/components/providers";
import { api, ApiError } from "@/lib/api";
import { refreshLabel } from "@/lib/format";
import { PLATFORM_META } from "@/lib/platforms";
import type { PlatformKey } from "@/lib/profile-url";
import type { RoleKey } from "@/lib/types";

type Settings = {
  workspace: { id: string; name: string; timezone: string; defaultRefreshMinutes: number; isDemo: boolean };
  members: { id: string; role: RoleKey; isYou: boolean; user: { id: string; name: string; email: string; avatarUrl: string | null } }[];
  invites: { id: string; email: string; role: RoleKey; expiresAt: string }[];
  connectors: { platform: PlatformKey; connectorId: string; label: string; configured: boolean; capabilities: { postViews: boolean; shares: boolean; profileViews: boolean } }[];
};

const ROLES: { value: RoleKey; label: string; hint: string }[] = [
  { value: "ADMIN", label: "Admin", hint: "Manage settings, members and deletions" },
  { value: "MEMBER", label: "Member", hint: "Add apps & accounts, refresh" },
  { value: "VIEWER", label: "Viewer", hint: "View and export" },
];
const INTERVALS = [60, 360, 720, 1440, 0];

function Section({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-x-10 gap-y-4 py-10 hairline-b first:pt-2 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div>
        <h2 className="text-[14px] font-semibold text-fg">{title}</h2>
        {description && <p className="mt-1 text-[13px] leading-relaxed text-fg-3">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const can = useCan();
  const qc = useQueryClient();
  const toast = useToast();
  const { pref, setPref } = useTheme();
  const q = useQuery({ queryKey: ["settings"], queryFn: () => api<Settings>("/api/v1/workspace") });
  const d = q.data;
  const [draft, setDraft] = useState<{ name?: string; tz?: string }>({});
  const name = draft.name ?? d?.workspace.name ?? "";
  const tz = draft.tz ?? d?.workspace.timezone ?? "UTC";
  const setName = (v: string) => setDraft((x) => ({ ...x, name: v }));
  const setTz = (v: string) => setDraft((x) => ({ ...x, tz: v }));
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<RoleKey>("MEMBER");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) => api("/api/v1/workspace", { method: "PATCH", json: body }),
    onSuccess: () => {
      qc.invalidateQueries();
      toast({ title: "Settings saved" });
    },
    onError: (e) => toast({ tone: "error", title: e instanceof ApiError ? e.message : "Couldn't save" }),
  });
  const invite = useMutation({
    mutationFn: () => api<{ link: string }>("/api/v1/workspace/invites", { method: "POST", json: { email: inviteEmail, role: inviteRole } }),
    onSuccess: (r) => {
      setInviteLink(r.link);
      setInviteEmail("");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e) => toast({ tone: "error", title: e instanceof ApiError ? e.message : "Couldn't create invite" }),
  });

  const timezones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["UTC"];

  return (
    <>
      <PageHeader title="Settings" description="Workspace, data sources and people." showRange={false} />
      {q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : !d ? (
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <div>
          <Section title="Workspace" description="Days are counted in the workspace timezone, so “today” means the same thing for everyone.">
            <form
              className="max-w-md space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                patch.mutate({ name, timezone: tz });
              }}
            >
              <Field label="Name" htmlFor="ws-name">
                <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!can.admin} />
              </Field>
              <Field label="Timezone" htmlFor="ws-tz">
                <select
                  id="ws-tz"
                  value={tz}
                  onChange={(e) => setTz(e.target.value)}
                  disabled={!can.admin}
                  className="h-9 w-full rounded-lg bg-surface px-3 text-[13.5px] text-fg shadow-[0_0_0_1px_var(--line-strong)] outline-none focus:shadow-[0_0_0_1px_var(--accent),0_0_0_4px_var(--accent-soft)]"
                >
                  {timezones.map((z) => (
                    <option key={z}>{z}</option>
                  ))}
                </select>
              </Field>
              {can.admin && (
                <Button type="submit" variant="primary" loading={patch.isPending} disabled={name === d.workspace.name && tz === d.workspace.timezone}>
                  Save
                </Button>
              )}
            </form>
          </Section>

          <Section title="Automatic refresh" description="How often Pulse collects fresh numbers. Individual accounts can override this.">
            <div className="flex flex-wrap gap-2">
              {INTERVALS.map((m) => (
                <button
                  key={m}
                  disabled={!can.admin}
                  onClick={() => patch.mutate({ defaultRefreshMinutes: m })}
                  className={
                    d.workspace.defaultRefreshMinutes === m
                      ? "h-8 rounded-full bg-accent-soft px-3.5 text-[12.5px] font-medium text-accent"
                      : "h-8 rounded-full px-3.5 text-[12.5px] font-medium text-fg-2 shadow-[0_0_0_1px_var(--line-strong)] hover:bg-surface-hover disabled:opacity-60"
                  }
                >
                  {refreshLabel(m)}
                </button>
              ))}
            </div>
          </Section>

          <Section
            title="Data sources"
            description="Pulse uses official APIs and licensed providers only. It never bypasses logins, CAPTCHAs or private profiles. Credentials live in server environment variables."
          >
            {d.workspace.isDemo && (
              <p className="mb-4 rounded-lg bg-warning-soft px-3 py-2 text-[12.5px] text-warning">This is a demo workspace. All numbers come from a mock data source and are not real.</p>
            )}
            <ul className="divide-y divide-[var(--line)] rounded-xl shadow-[0_0_0_1px_var(--line)]">
              {d.connectors.map((c) => (
                <li key={c.platform} className="flex items-center gap-4 px-4 py-3.5">
                  <span className="flex size-9 items-center justify-center rounded-full bg-surface-hover text-fg">
                    <PlatformIcon platform={c.platform} size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium text-fg">{PLATFORM_META[c.platform].label}</p>
                    <p className="truncate text-[12.5px] text-fg-3">
                      {c.label}
                      {c.configured && !c.capabilities.postViews && " · views not available"}
                    </p>
                  </div>
                  {c.configured ? (
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-fg-2">
                      <span className="size-1.5 rounded-full bg-positive" /> Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-fg-3">
                      <span className="size-1.5 rounded-full bg-fg-4" /> Not configured
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] text-fg-3">
              YouTube: <code className="font-mono text-fg-2">YOUTUBE_API_KEY</code>. TikTok: <code className="font-mono text-fg-2">TIKTOK_PROVIDER=ensembledata</code> + <code className="font-mono text-fg-2">ENSEMBLEDATA_TOKEN</code>. Instagram: <code className="font-mono text-fg-2">META_ACCESS_TOKEN</code> + <code className="font-mono text-fg-2">META_IG_BUSINESS_ACCOUNT_ID</code>, or <code className="font-mono text-fg-2">INSTAGRAM_PROVIDER=ensembledata</code> for reel views. See the README.
            </p>
          </Section>

          <Section title="Members" description="Admins manage settings and members. Members add apps and accounts. Viewers can look and export.">
            <ul className="divide-y divide-[var(--line)]">
              {d.members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-3">
                  <Avatar name={m.user.name} url={m.user.avatarUrl} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-fg">
                      {m.user.name} {m.isYou && <span className="font-normal text-fg-3">(you)</span>}
                    </p>
                    <p className="truncate text-[12.5px] text-fg-3">{m.user.email}</p>
                  </div>
                  {can.admin && !m.isYou ? (
                    <Menu>
                      <MenuTrigger asChild>
                        <Button size="sm" variant="ghost">
                          {ROLES.find((r) => r.value === m.role)?.label}
                        </Button>
                      </MenuTrigger>
                      <MenuContent>
                        {ROLES.map((r) => (
                          <MenuItem
                            key={r.value}
                            checked={m.role === r.value}
                            onSelect={async () => {
                              await api(`/api/v1/workspace/members/${m.id}`, { method: "PATCH", json: { role: r.value } });
                              qc.invalidateQueries({ queryKey: ["settings"] });
                            }}
                          >
                            {r.label}
                          </MenuItem>
                        ))}
                        <MenuItem
                          danger
                          icon={<Trash2 size={14} />}
                          onSelect={async () => {
                            if (!confirm(`Remove ${m.user.name} from the workspace?`)) return;
                            await api(`/api/v1/workspace/members/${m.id}`, { method: "DELETE" });
                            qc.invalidateQueries({ queryKey: ["settings"] });
                          }}
                        >
                          Remove
                        </MenuItem>
                      </MenuContent>
                    </Menu>
                  ) : (
                    <span className="text-[12.5px] text-fg-3">{ROLES.find((r) => r.value === m.role)?.label}</span>
                  )}
                </li>
              ))}
            </ul>

            {can.admin && (
              <div className="mt-6 rounded-xl bg-surface-2 p-4 shadow-[0_0_0_1px_var(--line)]">
                <p className="text-[13px] font-medium text-fg">Invite someone</p>
                <form
                  className="mt-3 flex flex-col gap-2 sm:flex-row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    invite.mutate();
                  }}
                >
                  <Input type="email" required placeholder="name@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="sm:flex-1" />
                  <Segmented size="sm" value={inviteRole} onChange={setInviteRole} options={ROLES.map((r) => ({ value: r.value, label: r.label }))} className="self-start sm:self-center" />
                  <Button type="submit" variant="primary" loading={invite.isPending}>
                    Create invite
                  </Button>
                </form>
                {inviteLink && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-surface px-3 py-2 shadow-[0_0_0_1px_var(--line)]">
                    <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-fg-2">{inviteLink}</code>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={copied ? <Check size={13} /> : <Copy size={13} />}
                      onClick={async () => {
                        await navigator.clipboard.writeText(inviteLink);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }}
                    >
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                )}
                {d.invites.length > 0 && (
                  <ul className="mt-4 space-y-1.5">
                    {d.invites.map((i) => (
                      <li key={i.id} className="flex items-center justify-between text-[12.5px] text-fg-3">
                        <span>
                          {i.email} · {i.role.toLowerCase()} · pending
                        </span>
                        <button
                          className="text-fg-3 hover:text-negative"
                          onClick={async () => {
                            await api(`/api/v1/workspace/invites/${i.id}`, { method: "DELETE" });
                            qc.invalidateQueries({ queryKey: ["settings"] });
                          }}
                        >
                          Revoke
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Section>

          <Section title="Appearance" description="Pulse follows your system by default.">
            <Segmented
              value={pref}
              onChange={setPref}
              options={[
                { value: "system", label: <span className="flex items-center gap-1.5"><Monitor size={13} /> System</span> },
                { value: "light", label: <span className="flex items-center gap-1.5"><Sun size={13} /> Light</span> },
                { value: "dark", label: <span className="flex items-center gap-1.5"><Moon size={13} /> Dark</span> },
              ]}
            />
          </Section>
        </div>
      )}
    </>
  );
}
