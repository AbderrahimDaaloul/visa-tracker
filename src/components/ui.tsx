"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-[var(--primary)] text-[var(--primary-fg)] hover:bg-[var(--primary-hover)]",
        secondary: "border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--background)]",
        danger: "bg-[var(--danger)] text-white hover:opacity-90",
        ghost: "hover:bg-[var(--background)]",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("card p-5", className)}>{children}</div>;
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-lg font-bold">{children}</h2>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}

export function Label({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium">
      {children}
      {hint ? <span className="ml-1 font-normal text-muted">({hint})</span> : null}
    </label>
  );
}

const fieldCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-[var(--ring)]";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldCls, className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldCls, className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldCls, "min-h-24 resize-y", className)} {...props} />;
}

export function Badge({ children, color = "muted" }: { children: ReactNode; color?: "muted" | "success" | "danger" | "primary" }) {
  const colors: Record<string, string> = {
    muted: "border-[var(--border)] text-muted",
    success: "border-[var(--success)] text-[var(--success)]",
    danger: "border-[var(--danger)] text-[var(--danger)]",
    primary: "border-[var(--primary)] text-[var(--primary)]",
  };
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", colors[color])}>{children}</span>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-[var(--border)]", className)} />;
}

export function Alert({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" | "error" | "success" }) {
  const tones: Record<string, string> = {
    info: "border-[var(--border)]",
    warn: "border-[var(--primary)] bg-orange-50/50 dark:bg-orange-950/20",
    error: "border-[var(--danger)] bg-red-50/50 dark:bg-red-950/20",
    success: "border-[var(--success)] bg-green-50/50 dark:bg-green-950/20",
  };
  return <div className={cn("rounded-lg border-l-4 border border-[var(--border)] p-3 text-sm", tones[tone])}>{children}</div>;
}
