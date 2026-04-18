import { runDimensional } from "@/lib/agents/dimensional";
import { runNarrator } from "@/lib/agents/narrator";
import { runPlanner } from "@/lib/agents/planner";
import {
  DecisionInput,
  DimensionalOutput,
  SimulationResult,
  SimulationResultSchema,
  TimelineOutput,
} from "@/lib/schemas";

export async function runSimulation(
  input: DecisionInput,
): Promise<SimulationResult> {
  const plan = await runPlanner(input);

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
}
