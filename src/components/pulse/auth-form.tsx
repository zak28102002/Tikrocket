"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { LogoMark } from "@/components/ui/logo";
import { api, ApiError } from "@/lib/api";

type FieldDef = { name: string; label: string; type?: string; placeholder?: string; autoComplete?: string; hint?: string; defaultValue?: string; readOnly?: boolean };

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div>
      <div className="mb-8 flex flex-col items-center text-center">
        <LogoMark size={36} className="text-fg" />
        <h1 className="display mt-6 text-[24px] font-semibold text-fg">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[14px] text-fg-3">{subtitle}</p>}
      </div>
      <div className="card p-6 shadow-md">{children}</div>
      {footer && <div className="mt-6 text-center text-[12.5px] text-fg-3">{footer}</div>}
    </div>
  );
}

export function AuthForm({
  fields,
  endpoint,
  submitLabel,
  extra,
  redirectTo = "/",
}: {
  fields: FieldDef[];
  endpoint: string;
  submitLabel: string;
  extra?: Record<string, string>;
  redirectTo?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      await api(endpoint, { method: "POST", json: { ...data, ...extra } });
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : redirectTo;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
      setPending(false);
    }
  };
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {fields.map((f) => (
        <Field key={f.name} label={f.label} htmlFor={f.name} hint={f.hint}>
          <Input id={f.name} name={f.name} type={f.type ?? "text"} placeholder={f.placeholder} autoComplete={f.autoComplete} defaultValue={f.defaultValue} readOnly={f.readOnly} required />
        </Field>
      ))}
      {error && <p className="rounded-lg bg-negative-soft px-3 py-2 text-[12.5px] text-negative">{error}</p>}
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
