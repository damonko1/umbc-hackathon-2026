import { randomUUID } from "node:crypto";
import { runDimensional } from "@/lib/agents/dimensional";
import { runNarrator } from "@/lib/agents/narrator";
import { runPlanner } from "@/lib/agents/planner";
import { runWithSimulation, telemetry } from "@/lib/llm/telemetry";
import {
  DecisionInput,
  DimensionalOutput,
  SimulationResult,
  SimulationResultSchema,
  TimelineOutput,
} from "@/lib/schemas";

export async function runSimulation(
  input: DecisionInput,
  opts: { simulationId?: string } = {},
): Promise<SimulationResult> {
  const simulationId = opts.simulationId ?? randomUUID();
  telemetry.startSimulation(simulationId);

  return runWithSimulation(simulationId, async () => {
    try {
      const plan = await runPlanner(input);
      telemetry.setPlan(simulationId, plan.forks.length, plan.dimensions.length);

      const timelines: TimelineOutput[] = await Promise.all(
        plan.forks.map(async (fork) => {
          const dimensionalOutputs: DimensionalOutput[] = await Promise.all(
            plan.dimensions.map((dimension) =>
              runDimensional({ dimension, fork, plan, input }),
            ),
          );

          const timeline = await runNarrator({
            fork,
            plan,
            input,
            dimensionalOutputs,
          });

          return timeline;
        }),
      );

      const result: SimulationResult = {
        input,
        plan,
        timelines,
        generatedAt: new Date().toISOString(),
      };

      return SimulationResultSchema.parse(result);
    } finally {
      telemetry.endSimulation(simulationId);
    }
  });
}
