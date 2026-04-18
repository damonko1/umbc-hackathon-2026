import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "accent" | "muted";
}) {
  const styles = {
    default: "border bg-[var(--card)] text-foreground",
    accent: "bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30",
    muted: "bg-transparent border text-[var(--muted)]",
  }[variant];
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles,
        className,
      )}
      {...props}
    />
  );
}
