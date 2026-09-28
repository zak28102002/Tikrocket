"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const base =
  "w-full bg-surface text-fg rounded-lg shadow-[0_0_0_1px_var(--line-strong)] outline-none transition-shadow duration-150 " +
  "placeholder:text-fg-4 hover:shadow-[0_0_0_1px_var(--fg-4)] focus:shadow-[0_0_0_1px_var(--accent),0_0_0_4px_var(--accent-soft)] " +
  "disabled:opacity-60 aria-[invalid=true]:shadow-[0_0_0_1px_var(--negative),0_0_0_4px_var(--negative-soft)]";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { leading?: ReactNode; inputSize?: "md" | "lg" }>(
  function Input({ className, leading, inputSize = "md", ...props }, ref) {
    const size = inputSize === "lg" ? "h-12 text-[15px] px-4" : "h-9 text-[13.5px] px-3";
    if (!leading) return <input ref={ref} className={cn(base, size, className)} {...props} />;
    return (
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-3">{leading}</span>
        <input ref={ref} className={cn(base, size, inputSize === "lg" ? "pl-11" : "pl-9", className)} {...props} />
      </div>
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} className={cn(base, "min-h-20 resize-none px-3 py-2.5 text-[13.5px] leading-relaxed", className)} {...props} />;
});

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  optional,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  htmlFor?: string;
  optional?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="flex items-baseline justify-between text-[12.5px] font-medium text-fg-2">
        {label}
        {optional && <span className="font-normal text-fg-4">Optional</span>}
      </label>
      {children}
      {error ? (
        <p className="text-[12px] text-negative">{error}</p>
      ) : hint ? (
        <p className="text-[12px] text-fg-3">{hint}</p>
      ) : null}
    </div>
  );
}
