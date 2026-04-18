"use client";

import type { TimelineOutput, TimeUnit } from "@/lib/schemas";
import { ForkBranch } from "@/components/fork-branch";
import { cn } from "@/lib/utils";

const ACCENT_CYCLE = ["purple", "cyan", "amber"] as const;
type Accent = (typeof ACCENT_CYCLE)[number];

export interface UnifiedTreeProps {
  question: string;
  timelines: TimelineOutput[];
  timeUnit: TimeUnit;
}

function getBranchEndpoint(index: number, total: number) {
  if (total === 2) {
    return index === 0 ? 33 : 66;
  }

  if (total === 3) {
    return [16.6, 50, 83.3][index] ?? 50;
  }

  return 50;
}

function getBranchPath(index: number, total: number) {
  const startX = 50;
  const startY = 6;
  const splitY = 18;
  const endX = getBranchEndpoint(index, total);
  const endY = 47;
  const controlY = 29;

  if (endX === startX) {
    return `M ${startX} ${startY} L ${startX} ${endY}`;
  }

  return [
    `M ${startX} ${startY}`,
    `L ${startX} ${splitY}`,
    `Q ${startX} ${controlY} ${endX} ${endY}`,
  ].join(" ");
}

export function UnifiedTree({ question, timelines, timeUnit }: UnifiedTreeProps) {
  const count = timelines.length;
  const gridCols =
    count >= 3
      ? "xl:grid-cols-3"
      : count === 2
        ? "xl:grid-cols-2"
        : "xl:grid-cols-1";

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--card)]/55 px-4 py-6 shadow-[0_30px_120px_-80px_rgba(15,23,42,0.9)] sm:px-6 sm:py-8 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_68%)]" />

      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-[24px] border border-[var(--border)] bg-[var(--background)]/90 px-5 py-5 text-center shadow-[0_20px_60px_-40px_rgba(15,23,42,1)] backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
              Decision
            </p>
            <h2 className="mt-3 text-lg font-semibold leading-8 text-foreground sm:text-[1.35rem]">
              {question}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Explore the {timeUnit}-by-{timeUnit} trajectory for each option.
            </p>
          </div>
        </div>

        {count > 1 && (
          <svg
            aria-hidden="true"
            viewBox="0 0 100 50"
            preserveAspectRatio="none"
            className="mx-auto hidden h-28 w-full max-w-5xl xl:block"
          >
            {timelines.map((timeline, index) => {
              const accent: Accent = ACCENT_CYCLE[index % ACCENT_CYCLE.length];
              const stroke =
                accent === "purple"
                  ? "var(--accent)"
                  : accent === "cyan"
                    ? "var(--accent-2)"
                    : "rgb(245 158 11)";

              return (
                <path
                  key={timeline.forkId}
                  d={getBranchPath(index, count)}
                  fill="none"
                  stroke={stroke}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="opacity-70"
                />
              );
            })}
          </svg>
        )}

        <div
          className={cn(
            "mt-6 grid grid-cols-1 gap-6 xl:mt-0",
            gridCols
          )}
        >
          {timelines.map((timeline, index) => (
            <ForkBranch
              key={timeline.forkId}
              timeline={timeline}
              accent={ACCENT_CYCLE[index % ACCENT_CYCLE.length]}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default UnifiedTree;
