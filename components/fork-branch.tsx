"use client";

import { GitBranch } from "lucide-react";
import type { TimelineOutput } from "@/lib/schemas";
import { StepNode } from "@/components/step-node";
import { cn } from "@/lib/utils";

const ACCENTS = {
  purple: {
    shell: "border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]",
    icon: "bg-[var(--accent)]/16 text-[var(--accent)] border-[var(--accent)]/30",
    rail: "bg-[var(--accent)]/20",
  },
  cyan: {
    shell: "border-[var(--accent-2)]/30 bg-[var(--accent-2)]/10 text-[var(--accent-2)]",
    icon: "bg-[var(--accent-2)]/16 text-[var(--accent-2)] border-[var(--accent-2)]/30",
    rail: "bg-[var(--accent-2)]/20",
  },
  amber: {
    shell: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    icon: "bg-amber-500/16 text-amber-400 border-amber-500/30",
    rail: "bg-amber-500/20",
  },
} as const;

type Accent = keyof typeof ACCENTS;

export interface ForkBranchProps {
  timeline: TimelineOutput;
  accent: Accent;
}

export function ForkBranch({ timeline, accent }: ForkBranchProps) {
  const theme = ACCENTS[accent];

  return (
    <section className="relative flex flex-col">
      <div className="px-4 sm:px-6">
        <div
          className={cn(
            "rounded-2xl border px-4 py-4 shadow-[0_16px_44px_-34px_rgba(15,23,42,1)]",
            theme.shell
          )}
        >
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-xl border",
                theme.icon
              )}
            >
              <GitBranch className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold leading-6 text-foreground sm:text-base">
                {timeline.forkLabel}
              </h3>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{timeline.summary}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative mt-5 flex-1 px-4 pb-1 sm:px-6">
        <span
          aria-hidden="true"
          className={cn("absolute left-[26px] top-0 bottom-0 w-px sm:left-[34px]", theme.rail)}
        />
        <ol className="flex flex-col gap-5">
          {timeline.steps.map((step, index) => (
            <StepNode
              key={`${timeline.forkId}-${step.stepIndex}`}
              step={step}
              accent={accent}
              isLast={index === timeline.steps.length - 1}
            />
          ))}
        </ol>
      </div>
    </section>
  );
}

export default ForkBranch;
