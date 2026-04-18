import * as React from "react";
import { Star } from "lucide-react";
import type {
  TimelineOutput,
  TimeUnit,
  Dimension,
} from "@/lib/schemas";
import { Badge } from "@/components/ui/badge";
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

function labelForDim(dim: string): string {
  if (dim in DIMENSION_LABELS) {
    return DIMENSION_LABELS[dim as Dimension];
  }
  return dim.charAt(0).toUpperCase() + dim.slice(1);
}

const ACCENTS = {
  purple: {
    dot: "bg-[var(--accent)]",
    rail: "bg-[var(--accent)]/30",
    ring: "ring-[var(--accent)]/60",
    glow: "shadow-[0_0_24px_-6px_rgba(124,58,237,0.7)]",
    border: "border-[var(--accent)]/50",
    star: "text-[var(--accent)]",
  },
  cyan: {
    dot: "bg-[var(--accent-2)]",
    rail: "bg-[var(--accent-2)]/30",
    ring: "ring-[var(--accent-2)]/60",
    glow: "shadow-[0_0_24px_-6px_rgba(6,182,212,0.7)]",
    border: "border-[var(--accent-2)]/50",
    star: "text-[var(--accent-2)]",
  },
  amber: {
    dot: "bg-amber-500",
    rail: "bg-amber-500/30",
    ring: "ring-amber-500/60",
    glow: "shadow-[0_0_24px_-6px_rgba(245,158,11,0.7)]",
    border: "border-amber-500/50",
    star: "text-amber-400",
  },
} as const;

export interface TimelineProps {
  timeline: TimelineOutput;
  timeUnit: TimeUnit;
  accent?: "purple" | "cyan" | "amber";
}

export function Timeline({ timeline, accent = "purple" }: TimelineProps) {
  const theme = ACCENTS[accent];

  return (
    <div className="relative pl-6">
      <div
        className={cn(
          "absolute left-[11px] top-1 bottom-1 w-px",
          theme.rail,
        )}
      />
      <ol className="flex flex-col gap-4">
        {timeline.steps.map((step) => {
          const isTurning = Boolean(step.turningPoint);
          const metricEntries = Object.entries(step.metrics).filter(
            ([, v]) => typeof v === "number",
          ) as [string, number][];
          return (
            <li key={step.stepIndex} className="relative">
              <span
                className={cn(
                  "absolute -left-6 top-2.5 h-3 w-3 rounded-full ring-4 ring-[var(--background)]",
                  theme.dot,
                  isTurning && "h-3.5 w-3.5 -left-[25px]",
                )}
              />
              <div
                className={cn(
                  "rounded-xl border bg-[var(--card)]/70 p-4",
                  isTurning && theme.border,
                  isTurning && theme.glow,
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wider text-[var(--muted)]">
                      {step.label}
                    </span>
                    {isTurning && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs font-medium",
                          theme.star,
                        )}
                      >
                        <Star className="h-3 w-3 fill-current" />
                        Turning point
                      </span>
                    )}
                  </div>
                </div>
                <h4 className="mt-1 text-sm font-semibold text-foreground">
                  {step.headline}
                </h4>
                <p className="mt-1.5 text-sm text-[var(--muted)] leading-relaxed">
                  {step.narrative}
                </p>
                {metricEntries.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {metricEntries.map(([dim, val]) => (
                      <Badge
                        key={dim}
                        variant="muted"
                        className="gap-1"
                      >
                        <span className="text-[var(--muted)]">
                          {labelForDim(dim)}
                        </span>
                        <span className="text-foreground font-semibold">
                          {Math.round(val)}
                        </span>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default Timeline;
