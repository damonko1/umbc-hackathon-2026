import * as React from "react";
import type { SimulationResult } from "@/lib/schemas";
import { ForkCard } from "@/components/fork-card";
import { Timeline } from "@/components/timeline";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ACCENT_CYCLE = ["purple", "cyan", "amber"] as const;
type Accent = (typeof ACCENT_CYCLE)[number];

export interface CompareViewProps {
  result: SimulationResult;
}

export function CompareView({ result }: CompareViewProps) {
  const { input, plan, timelines } = result;
  const n = timelines.length;
  const gridCols =
    n >= 3
      ? "grid-cols-1 lg:grid-cols-3"
      : n === 2
        ? "grid-cols-1 lg:grid-cols-2"
        : "grid-cols-1";

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Badge variant="accent" className="self-start">
          Simulated futures
        </Badge>
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
          {input.question}
        </h2>
        <p className="text-sm text-[var(--muted)] max-w-3xl">
          {plan.rationale} A {plan.numSteps}-{plan.timeUnit} horizon across{" "}
          {plan.dimensions.join(", ")}.
        </p>
      </header>

      <div className={cn("grid gap-5", gridCols)}>
        {timelines.map((timeline, idx) => {
          const accent: Accent = ACCENT_CYCLE[idx % ACCENT_CYCLE.length];
          return (
            <div key={timeline.forkId} className="flex flex-col gap-4">
              <ForkCard timeline={timeline} accent={accent} />
              <Timeline
                timeline={timeline}
                timeUnit={plan.timeUnit}
                accent={accent}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default CompareView;
