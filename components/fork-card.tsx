import * as React from "react";
import { GitBranch } from "lucide-react";
import type { TimelineOutput, Dimension } from "@/lib/schemas";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const DIMENSION_LABELS: Record<Dimension, string> = {
  financial: "Financial",
  career: "Career",
  psychological: "Mind",
  events: "Events",
};

export interface ForkCardProps {
  timeline: TimelineOutput;
  accent?: "purple" | "cyan" | "amber";
}

const ACCENTS = {
  purple: {
    ring: "ring-[var(--accent)]/40",
    bar: "from-[var(--accent)] to-[var(--accent)]/0",
    chip: "bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/30",
  },
  cyan: {
    ring: "ring-[var(--accent-2)]/40",
    bar: "from-[var(--accent-2)] to-[var(--accent-2)]/0",
    chip: "bg-[var(--accent-2)]/15 text-[var(--accent-2)] border-[var(--accent-2)]/30",
  },
  amber: {
    ring: "ring-amber-500/40",
    bar: "from-amber-500 to-amber-500/0",
    chip: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
} as const;

export function ForkCard({ timeline, accent = "purple" }: ForkCardProps) {
  const theme = ACCENTS[accent];
  const metricEntries = Object.entries(timeline.finalMetrics).filter(
    ([, v]) => typeof v === "number",
  ) as [Dimension, number][];

  return (
    <Card className={cn("ring-1 overflow-hidden", theme.ring)}>
      <div className={cn("h-1 w-full bg-gradient-to-r", theme.bar)} />
      <CardHeader className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-md border",
              theme.chip,
            )}
          >
            <GitBranch className="h-3.5 w-3.5" />
          </span>
          <CardTitle className="text-base">{timeline.forkLabel}</CardTitle>
        </div>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          {timeline.summary}
        </p>
      </CardHeader>
      {metricEntries.length > 0 && (
        <CardContent className="flex flex-wrap gap-2 pt-0">
          {metricEntries.map(([dim, val]) => (
            <Badge
              key={dim}
              variant="muted"
              className="gap-1.5"
            >
              <span className="text-[var(--muted)]">
                {DIMENSION_LABELS[dim]}
              </span>
              <span className="text-foreground font-semibold">
                {Math.round(val)}
              </span>
            </Badge>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

export default ForkCard;
