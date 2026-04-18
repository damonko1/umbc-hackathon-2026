"use client";

import type { SimulationResult } from "@/lib/schemas";
import { UnifiedTree } from "@/components/unified-tree";
import { Badge } from "@/components/ui/badge";

export interface CompareViewProps {
  result: SimulationResult;
}

export function CompareView({ result }: CompareViewProps) {
  const { input, plan, timelines } = result;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Badge variant="accent" className="self-start">
          Simulated futures
        </Badge>
        <p className="text-sm text-[var(--muted)] max-w-3xl">
          {plan.rationale} A {plan.numSteps}-{plan.timeUnit} horizon across{" "}
          {plan.dimensions.join(", ")}.
        </p>
      </header>

      <UnifiedTree
        question={input.question}
        timelines={timelines}
        timeUnit={plan.timeUnit}
      />
    </section>
  );
}

export default CompareView;
