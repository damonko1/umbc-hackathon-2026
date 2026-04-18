"use client";

import * as React from "react";
import { ChevronDown, Star } from "lucide-react";
import type { Dimension, TimelineStep } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const DIMENSION_LABELS: Record<Dimension, string> = {
  financial: "Fin",
  career: "Career",
  psychological: "Mind",
  events: "Events",
  relationships: "Rel",
  health: "Health",
  learning: "Learn",
  identity: "Self",
  time: "Time",
  social: "Social",
};

function labelForDimension(dimension: string) {
  if (dimension in DIMENSION_LABELS) {
    return DIMENSION_LABELS[dimension as Dimension];
  }

  return dimension.charAt(0).toUpperCase() + dimension.slice(1);
}

const ACCENTS = {
  purple: {
    dot: "bg-[var(--accent)]",
    border: "border-[var(--accent)]/30",
    ring: "ring-[var(--accent)]/45",
    star: "text-[var(--accent)]",
    glow: "shadow-[0_0_28px_-14px_rgba(124,58,237,0.9)]",
    button: "hover:border-[var(--accent)]/45 hover:bg-[var(--accent)]/6",
  },
  cyan: {
    dot: "bg-[var(--accent-2)]",
    border: "border-[var(--accent-2)]/30",
    ring: "ring-[var(--accent-2)]/45",
    star: "text-[var(--accent-2)]",
    glow: "shadow-[0_0_28px_-14px_rgba(6,182,212,0.9)]",
    button: "hover:border-[var(--accent-2)]/45 hover:bg-[var(--accent-2)]/6",
  },
  amber: {
    dot: "bg-amber-500",
    border: "border-amber-500/30",
    ring: "ring-amber-500/45",
    star: "text-amber-400",
    glow: "shadow-[0_0_28px_-14px_rgba(245,158,11,0.9)]",
    button: "hover:border-amber-500/45 hover:bg-amber-500/6",
  },
} as const;

type Accent = keyof typeof ACCENTS;

export interface StepNodeProps {
  step: TimelineStep;
  accent: Accent;
  isLast: boolean;
}

export function StepNode({ step, accent, isLast }: StepNodeProps) {
  const [expanded, setExpanded] = React.useState(false);
  const theme = ACCENTS[accent];
  const isTurningPoint = Boolean(step.turningPoint);
  const metricEntries = Object.entries(step.metrics).filter(
    ([, value]) => typeof value === "number"
  ) as [string, number][];

  return (
    <li className="relative pl-8">
      {!isLast && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute left-[11px] top-6 bottom-[-1.5rem] w-px bg-[var(--border)]",
            theme.border
          )}
        />
      )}

      <span
        aria-hidden="true"
        className={cn(
          "absolute left-0 top-5 z-10 h-[22px] w-[22px] rounded-full border-4 border-[var(--background)] shadow-sm",
          theme.dot,
          isTurningPoint && "scale-110 ring-4",
          isTurningPoint && theme.ring
        )}
      />

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className={cn(
          "group w-full rounded-2xl border bg-[var(--card)]/92 p-4 text-left transition-all duration-200",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
          "border-[var(--border)] shadow-[0_16px_38px_-30px_rgba(15,23,42,0.95)]",
          theme.button,
          isTurningPoint && theme.border,
          isTurningPoint && theme.glow
        )}
        aria-expanded={expanded}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
              <span>{step.label}</span>
              {isTurningPoint && (
                <span className={cn("inline-flex items-center gap-1", theme.star)}>
                  <Star className="h-3.5 w-3.5 fill-current" />
                  Turning point
                </span>
              )}
            </div>
            <h4 className="mt-2 text-sm font-semibold leading-6 text-foreground sm:text-[15px]">
              {step.headline}
            </h4>
          </div>

          <ChevronDown
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)] transition-transform duration-200",
              expanded && "rotate-180"
            )}
          />
        </div>

        {metricEntries.length > 0 && (
          <div className="mt-4 border-t border-[var(--border)] pt-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-foreground">
              {metricEntries.map(([dimension, value]) => (
                <div key={dimension} className="flex items-center justify-between gap-2">
                  <span className="text-[var(--muted)]">{labelForDimension(dimension)}</span>
                  <span className="font-semibold">{Math.round(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {expanded && (
          <div className="mt-4 border-t border-[var(--border)] pt-4">
            <p className="text-sm leading-7 text-[var(--muted)]">{step.narrative}</p>
          </div>
        )}
      </button>
    </li>
  );
}

export default StepNode;
