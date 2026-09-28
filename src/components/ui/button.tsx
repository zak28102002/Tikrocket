"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-hover active:bg-accent-press shadow-[0_1px_0_rgba(255,255,255,.15)_inset,0_1px_2px_rgba(20,30,90,.18)]",
  secondary:
    "bg-surface text-fg shadow-[0_0_0_1px_var(--line-strong),0_1px_2px_rgba(0,0,0,.04)] hover:bg-surface-hover active:bg-surface-active",
  subtle: "bg-surface-hover text-fg hover:bg-surface-active",
  ghost: "text-fg-2 hover:text-fg hover:bg-surface-hover active:bg-surface-active",
  danger: "bg-negative text-white hover:brightness-110 active:brightness-95",
};

const SIZES: Record<Size, string> = {
  sm: "h-7 px-2.5 text-[12.5px] gap-1.5 rounded-md",
  md: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  lg: "h-10 px-4 text-[14px] gap-2 rounded-[10px]",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, icon, iconRight, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center font-medium whitespace-nowrap",
        "transition-[background-color,color,box-shadow,transform,opacity] duration-150 ease-out active:scale-[0.98]",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner size={14} /> : icon}
      {children}
      {iconRight}
    </button>
  );
});

export const IconButton = forwardRef<HTMLButtonElement, ButtonProps & { label: string }>(function IconButton(
  { label, className, size = "md", variant = "ghost", children, ...props },
  ref,
) {
  const dim = size === "sm" ? "size-7" : size === "lg" ? "size-10" : "size-8";
  return (
    <Button ref={ref} aria-label={label} title={label} variant={variant} size={size} className={cn(dim, "px-0", className)} {...props}>
      {children}
    </Button>
  );
});
