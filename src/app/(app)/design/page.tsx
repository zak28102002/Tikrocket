"use client";

import { useState, type ReactNode } from "react";
import { Boxes, Plus, RefreshCw } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/shell/page-header";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Delta } from "@/components/ui/delta";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { AppIcon, Avatar } from "@/components/ui/avatar";
import { PlatformLabel } from "@/components/ui/platform-icon";
import { FilterPill } from "@/components/ui/filter-pill";
import { Tooltip } from "@/components/ui/tooltip";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/pulse/status";
import { TimeChart } from "@/components/charts/time-chart";
import { Sparkline } from "@/components/charts/sparkline";
import { BarList } from "@/components/charts/bar-list";
import { LogoMark, Logo } from "@/components/ui/logo";

const SWATCHES = ["--bg", "--surface", "--surface-hover", "--fg", "--fg-2", "--fg-3", "--fg-4", "--accent", "--accent-soft", "--positive", "--negative", "--warning"];
const demo = Array.from({ length: 30 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, "0")}`, value: Math.round(40000 + Math.sin(i / 3) * 12000 + i * 900 + (i === 18 ? 38000 : 0)), change: null }));

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="py-8 hairline-b">
      <SectionHeader title={title} />
      {children}
    </section>
  );
}

/** Living reference for the Pulse design system. Every screen is built from these parts. */
export default function DesignPage() {
  const [seg, setSeg] = useState("views");
  const [pill, setPill] = useState<string | null>("TIKTOK");
  const [modal, setModal] = useState(false);
  return (
    <>
      <PageHeader title="Design system" description="The building blocks every Pulse screen is made from." showRange={false} />

      <Block title="Brand">
        <div className="flex items-center gap-8">
          <Logo />
          <LogoMark size={40} className="text-fg" />
          <LogoMark size={40} className="text-accent" />
        </div>
      </Block>

      <Block title="Color tokens">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {SWATCHES.map((v) => (
            <div key={v} className="overflow-hidden rounded-xl shadow-[0_0_0_1px_var(--line)]">
              <div className="h-14" style={{ background: `var(${v})` }} />
              <p className="px-3 py-2 font-mono text-[11px] text-fg-3">{v}</p>
            </div>
          ))}
        </div>
      </Block>

      <Block title="Typography">
        <div className="space-y-4">
          <p className="display text-[64px] leading-none font-semibold">8.42M</p>
          <p className="display text-[28px] font-semibold">Page title</p>
          <p className="text-[15px] font-semibold">Section heading</p>
          <p className="text-[14px] text-fg-2">Body copy is softer and quieter than headings.</p>
          <p className="text-[12.5px] text-fg-3">Labels are small but readable.</p>
          <p className="text-[13px] tnum">Tabular 1,284,002 · 12,900 · 842,210</p>
        </div>
      </Block>

      <Block title="Buttons">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" icon={<Plus size={14} />}>
            Primary
          </Button>
          <Button>Secondary</Button>
          <Button variant="subtle">Subtle</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" loading>
            Loading
          </Button>
          <IconButton label="Refresh">
            <RefreshCw size={15} />
          </IconButton>
          <Button size="sm">Small</Button>
          <Button size="lg" variant="primary">
            Large
          </Button>
        </div>
      </Block>

      <Block title="Inputs & controls">
        <div className="grid max-w-2xl gap-5 sm:grid-cols-2">
          <Field label="Name" hint="Helpful hint text.">
            <Input placeholder="Catrot" />
          </Field>
          <Field label="With error" error="Give your app a name.">
            <Input aria-invalid placeholder="…" />
          </Field>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Segmented value={seg} onChange={setSeg} options={["views", "likes", "followers"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))} />
          <FilterPill label="Platform" allLabel="All platforms" value={pill} onChange={setPill} options={[{ value: "TIKTOK", label: "TikTok" }, { value: "YOUTUBE", label: "YouTube" }]} />
          <Tooltip content="Tooltips explain, never decorate.">
            <Button variant="ghost">Hover me</Button>
          </Tooltip>
          <Button onClick={() => setModal(true)}>Open modal</Button>
        </div>
        <Modal open={modal} onOpenChange={setModal} title="Modal" description="Centered, springy, dismissable.">
          <div className="px-6 pt-4 pb-6 text-[13.5px] text-fg-2">Modal content.</div>
        </Modal>
      </Block>

      <Block title="Identity & status">
        <div className="flex flex-wrap items-center gap-6">
          <AppIcon name="Catrot" seed={0} size={44} />
          <AppIcon name="Mealzy" seed={2} size={44} />
          <Avatar name="catrotapp" size={40} platform="TIKTOK" />
          <PlatformLabel platform="TIKTOK" />
          <PlatformLabel platform="INSTAGRAM" />
          <PlatformLabel platform="YOUTUBE" />
          <StatusBadge status="HEALTHY" />
          <StatusBadge status="SYNCING" />
          <StatusBadge status="ERROR" />
          <StatusBadge status="UNAVAILABLE" />
          <Delta value={24.8} />
          <Delta value={-3.1} />
          <Delta value={null} showNull />
        </div>
      </Block>

      <Block title="Charts">
        <div className="card px-3 pt-4 pb-2">
          <TimeChart series={[{ id: "demo", label: "Views", color: "var(--chart-line)", points: demo }]} area height={220} valueLabel="Views" />
        </div>
        <div className="mt-6 grid gap-8 sm:grid-cols-2">
          <div className="flex items-center gap-4">
            <Sparkline values={demo.map((d) => d.value)} width={120} height={32} />
            <span className="text-[13px] text-fg-3">Sparkline</span>
          </div>
          <BarList items={[{ key: "a", label: "TikTok", value: 3420000 }, { key: "b", label: "Instagram", value: 1020000 }, { key: "c", label: "YouTube", value: 380000 }]} />
        </div>
      </Block>

      <Block title="Loading, empty & error states">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="card space-y-3 p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-3 w-32" />
          </div>
          <div className="card">
            <EmptyState compact icon={<Boxes size={20} strokeWidth={1.5} />} title="No apps yet" description="Create your first app to start tracking social performance." />
          </div>
          <div className="card">
            <ErrorState compact title="Couldn't update this account" message="Instagram temporarily didn't return the requested data." detail="UPSTREAM: 500 (graph.facebook.com)" onRetry={() => {}} />
          </div>
        </div>
      </Block>
    </>
  );
}
