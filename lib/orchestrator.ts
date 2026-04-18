import { randomUUID } from "node:crypto";
import { runDimensional } from "@/lib/agents/dimensional";
import { runNarrator } from "@/lib/agents/narrator";
import { runPlanner } from "@/lib/agents/planner";
import { runWithSimulation, telemetry } from "@/lib/llm/telemetry";
import {
  ClarifyingAnswer,
  ClarifyingQuestion,
  DecisionInput,
  DimensionalOutput,
  PlannerOutput,
  SimulationResult,
  SimulationResultSchema,
  TimelineOutput,
} from "@/lib/schemas";

export type SimulationStartResult =
  | { status: "questions"; simulationId: string; questions: ClarifyingQuestion[] }
  | { status: "complete"; simulationId: string; result: SimulationResult };

async function runForkPipeline(
  plan: PlannerOutput,
  input: DecisionInput,
): Promise<TimelineOutput[]> {
  return Promise.all(
    plan.forks.map(async (fork) => {
      const dimensionalOutputs: DimensionalOutput[] = await Promise.all(
        plan.dimensions.map((dimension) =>
          runDimensional({ dimension, fork, plan, input }),
        ),
      );

      return runNarrator({
        fork,
        plan,
        input,
        dimensionalOutputs,
      });
    }),
  );
}

function buildResult(
  input: DecisionInput,
  plan: PlannerOutput,
  timelines: TimelineOutput[],
): SimulationResult {
  const result: SimulationResult = {
    input,
    plan,
    timelines,
    generatedAt: new Date().toISOString(),
  };
  return SimulationResultSchema.parse(result);
}

export async function runSimulation(
  input: DecisionInput,
  opts: { simulationId?: string } = {},
): Promise<SimulationStartResult> {
  const simulationId = opts.simulationId ?? randomUUID();
  telemetry.startSimulation(simulationId, input);

  return runWithSimulation(simulationId, async () => {
    let pausedForQuestions = false;
    try {
      const plannerResp = await runPlanner(input, { mayAskQuestions: true });

      if (plannerResp.type === "questions") {
        pausedForQuestions = true;
        telemetry.setAwaitingAnswers(simulationId, plannerResp.questions);
        return {
          status: "questions",
          simulationId,
          questions: plannerResp.questions,
        };
      }

      const plan = plannerResp.plan;
      telemetry.setPlan(simulationId, plan.forks.length, plan.dimensions.length);

      const timelines = await runForkPipeline(plan, input);
      const result = buildResult(input, plan, timelines);
      telemetry.setResult(simulationId, result);
      return { status: "complete", simulationId, result };
    } finally {
      if (!pausedForQuestions) {
        telemetry.endSimulation(simulationId);
      }
    }
  });
}

export async function resumeSimulation(
  simulationId: string,
  answers: ClarifyingAnswer[],
): Promise<SimulationResult> {
  const sim = telemetry.getSim(simulationId);
  if (!sim) {
    throw new Error(`Unknown simulation: ${simulationId}`);
  }
  if (sim.stage !== "awaiting_answers" || !sim.pausedQuestions) {
    throw new Error(`Simulation ${simulationId} is not awaiting answers`);
  }
  if (!sim.originalInput) {
    throw new Error(`Simulation ${simulationId} has no stored input`);
  }

  const questionsById = new Map(sim.pausedQuestions.map((q) => [q.id, q]));
  const priorAnswers = answers
    .map((answer) => {
      const question = questionsById.get(answer.id);
      if (!question) return null;
      return { question, answer };
    })
    .filter((qa): qa is { question: ClarifyingQuestion; answer: ClarifyingAnswer } => qa !== null);

  if (priorAnswers.length === 0) {
    throw new Error(`No matching answers for paused questions on ${simulationId}`);
  }

  const input = sim.originalInput;
  telemetry.clearAwaitingAnswers(simulationId);

  return runWithSimulation(simulationId, async () => {
    try {
      const plannerResp = await runPlanner(input, {
        mayAskQuestions: false,
        priorAnswers,
      });
      if (plannerResp.type !== "plan") {
        throw new Error("Planner returned questions during resume; expected a plan");
      }
      const plan = plannerResp.plan;
      telemetry.setPlan(simulationId, plan.forks.length, plan.dimensions.length);

      const timelines = await runForkPipeline(plan, input);
      const result = buildResult(input, plan, timelines);
      telemetry.setResult(simulationId, result);
      return result;
    } finally {
      telemetry.endSimulation(simulationId);
    }
  });
}
