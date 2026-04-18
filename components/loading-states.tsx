"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STAGES = [
  {
    title: "Planning the simulation",
    blurb: "Choosing a time horizon, dimensions, and forks.",
  },
  {
    title: "Running parallel agents",
    blurb: "Simulating each option across life dimensions.",
  },
  {
    title: "Stitching the narrative",
    blurb: "Weaving scores and events into a story.",
  },
] as const;

export interface LoadingStatesProps {
  stage: 0 | 1 | 2 | 3;
}

export function LoadingStates({ stage }: LoadingStatesProps) {
  return (
    <div className="flex flex-col gap-4 max-w-lg">
      {STAGES.map((s, idx) => {
        const done = stage > idx;
        const active = stage === idx;
        const pending = stage < idx;
        return (
          <div
            key={s.title}
            className={cn(
              "flex items-start gap-3 rounded-xl border p-4 transition-colors",
              done &&
                "border-[var(--accent)]/40 bg-[var(--accent)]/5",
              active &&
                "border-[var(--accent-2)]/50 bg-[var(--accent-2)]/5",
              pending && "opacity-50",
            )}
          >
            <span
              className={cn(
                "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                done &&
                  "bg-[var(--accent)] border-[var(--accent)] text-white",
                active &&
                  "border-[var(--accent-2)] text-[var(--accent-2)]",
                pending && "text-[var(--muted)]",
              )}
            >
              {done ? (
                <Check className="h-3.5 w-3.5" />
              ) : active ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full bg-[var(--muted)]",
                  )}
                />
              )}
            </span>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {s.title}
                </span>
                {active && (
                  <span className="flex items-center gap-0.5">
                    <span className="h-1 w-1 animate-pulse rounded-full bg-[var(--accent-2)]" />
                    <span className="h-1 w-1 animate-pulse rounded-full bg-[var(--accent-2)] [animation-delay:120ms]" />
                    <span className="h-1 w-1 animate-pulse rounded-full bg-[var(--accent-2)] [animation-delay:240ms]" />
                  </span>
                )}
              </div>
              <span className="text-xs text-[var(--muted)]">{s.blurb}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default LoadingStates;
