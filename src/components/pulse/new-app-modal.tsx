"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef, useState, type DragEvent } from "react";
import { ImagePlus, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import { AppIcon } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import type { AppRef } from "@/lib/types";
import { cn } from "@/lib/cn";

export function NewAppModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<{ id: string; url: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [seed] = useState(() => Math.floor(Math.random() * 12));
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useToast();

  const upload = async (file: File) => {
    setError(null);
    if (!file.type.startsWith("image/")) return setError("Choose a PNG, JPG or WebP image.");
    if (file.size > 5 * 1024 * 1024) return setError("That image is larger than 5 MB.");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await api<{ assetId: string; url: string }>("/api/v1/uploads", { method: "POST", body: fd });
      setIcon({ id: res.assetId, url: res.url });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const create = useMutation({
    mutationFn: () =>
      api<{ app: AppRef }>("/api/v1/apps", {
        method: "POST",
        json: { name: name.trim(), description: description.trim() || null, iconAssetId: icon?.id ?? null },
      }),
    onSuccess: ({ app }) => {
      qc.invalidateQueries();
      onOpenChange(false);
      toast({ title: `${app.name} created`, description: "Add a social account to start tracking." });
      router.push(`/apps/${app.id}`);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Couldn't create the app."),
  });

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void upload(f);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} width={520} hideClose>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return setError("Give your app a name.");
          create.mutate();
        }}
      >
        <div className="px-6 pt-6">
          <p className="text-[12px] font-medium text-fg-3">New app</p>
          <div className="mt-4 flex items-start gap-5">
            <div className="shrink-0">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={onDrop}
                className={cn(
                  "group relative flex size-[76px] items-center justify-center rounded-[20px] transition-all duration-200",
                  drag ? "scale-105 ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--surface)]" : "hover:scale-[1.03]",
                )}
                aria-label="Upload app icon"
              >
                <AppIcon name={name || "?"} url={icon?.url} seed={seed} size={76} className={cn(!name && !icon && "opacity-35")} />
                <span className="absolute inset-0 flex items-center justify-center rounded-[20px] bg-black/0 text-white opacity-0 transition-all group-hover:bg-black/35 group-hover:opacity-100">
                  {uploading ? <Spinner size={18} /> : <ImagePlus size={20} strokeWidth={1.75} />}
                </span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
              />
              {icon && (
                <button type="button" onClick={() => setIcon(null)} className="mx-auto mt-2 flex items-center gap-1 text-[11.5px] text-fg-3 hover:text-fg">
                  <X size={11} /> Remove
                </button>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <input
                autoFocus
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                maxLength={60}
                placeholder="App name"
                aria-label="App name"
                className="display w-full bg-transparent text-[26px] font-semibold text-fg outline-none placeholder:text-fg-4"
              />
              <p className="mt-1 text-[12.5px] text-fg-3">Drop an icon on the tile, or click it to upload.</p>
            </div>
          </div>
          <div className="mt-6">
            <Field label="Description" optional htmlFor="app-desc">
              <Textarea
                id="app-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={280}
                placeholder="What does this app do? e.g. Screen-time control app."
                rows={2}
              />
            </Field>
          </div>
          {error && <p className="mt-3 text-[12.5px] text-negative">{error}</p>}
        </div>
        <div className="mt-6 flex items-center justify-end gap-2 rounded-b-2xl bg-surface-2 px-6 py-3.5 shadow-[inset_0_1px_0_var(--line)]">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={create.isPending} disabled={!name.trim() || uploading}>
            Create app
          </Button>
        </div>
      </form>
    </Modal>
  );
}
