import { getLlmProvider } from "@/lib/llm";
import type { ChatMessage } from "@/lib/llm/types";
import {
  DecisionInput,
  DimensionalOutput,
  PlannerFork,
  PlannerOutput,
  TimelineOutput,
  TimelineOutputSchema,
  TimelineStep,
} from "@/lib/schemas";

const SYSTEM_PROMPT = `You are the Narrator agent for Reality Fork.
You receive the per-dimension scores and notes for ONE fork of a decision. Your job is to stitch them into a step-by-step narrative with cause-and-effect: how does what happened on one axis lead to what happens on the next step or another axis?

Rules:
- Output EXACTLY one step per plan step (same number as the dimensional outputs).
- Each step has a label matching plan.timeUnit, like "Day 2", "Week 4", "Month 3", "Year 1".
- headline is a 3-8 word event title. narrative is 2-3 sentences of cause-and-effect story.
- metrics on each step carry the per-dimension scores for that step (copy from the dimensional outputs; slight interpolation/smoothing is fine, but stay close to the provided scores).
- Mark turningPoint: true on 1-2 pivotal steps where the story clearly pivots. Leave it false or omitted on the others.
- summary is 3-4 sentences describing the whole arc.
- finalMetrics equals the metrics of the last step.

Return ONLY JSON matching the provided schema.`;

function labelFor(timeUnit: string, i: number): string {
  const unit = timeUnit.charAt(0).toUpperCase() + timeUnit.slice(1);
  return `${unit} ${i + 1}`;
}

export async function runNarrator({
  fork,
  plan,
  input,
  dimensionalOutputs,
}: {
  fork: PlannerFork;
  plan: PlannerOutput;
  input: DecisionInput;
  dimensionalOutputs: DimensionalOutput[];
}): Promise<TimelineOutput> {
  const provider = getLlmProvider();

  // Build a compact per-step table of per-dimension scores + notes for the model.
  const perStepTable = Array.from({ length: plan.numSteps }, (_, i) => {
    const entry: {
      stepIndex: number;
      label: string;
      scores: Record<string, number>;
      notes: Record<string, string>;
    } = {
      stepIndex: i,
      label: labelFor(plan.timeUnit, i),
      scores: {},
      notes: {},
    };
    for (const dim of dimensionalOutputs) {
      const step = dim.perStep[i];
      if (step) {
        entry.scores[dim.dimension] = step.score;
        entry.notes[dim.dimension] = step.note;
      }
    }
    return entry;
  });

  const userPayload = {
    decision: {
      question: input.question,
      context: input.context ?? null,
      goals: input.goals ?? null,
    },
    plan: {
      timeUnit: plan.timeUnit,
      numSteps: plan.numSteps,
      rationale: plan.rationale,
      dimensions: plan.dimensions,
    },
    fork: {
      id: fork.id,
      label: fork.label,
      description: fork.description,
    },
    perStep: perStepTable,
  };

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Narrate this fork as a step-by-step timeline.
Produce EXACTLY ${plan.numSteps} steps, stepIndex 0 to ${plan.numSteps - 1}.
Use labels like "${labelFor(plan.timeUnit, 0)}", "${labelFor(plan.timeUnit, 1)}".
forkId must be "${fork.id}" and forkLabel must be "${fork.label}".

CONTEXT:
${JSON.stringify(userPayload, null, 2)}

Return ONLY JSON matching the provided schema.`,
    },
  ];

  try {
    const result = await provider.generateStructured({
      messages,
      schema: TimelineOutputSchema,
      schemaName: "TimelineOutput",
      temperature: 0.8,
      maxRetries: 2,
    });

    // Defensive: enforce step count and stepIndex / forkId / forkLabel.
    let steps: TimelineStep[] = result.steps.slice();

    if (steps.length > plan.numSteps) {
      steps = steps.slice(0, plan.numSteps);
    } else if (steps.length < plan.numSteps) {
      const last =
        steps[steps.length - 1] ??
        ({
          stepIndex: 0,
          label: labelFor(plan.timeUnit, 0),
          headline: fork.label,
          narrative: fork.description,
          metrics: {},
          turningPoint: false,
        } as TimelineStep);
      while (steps.length < plan.numSteps) {
        steps.push({
          ...last,
          stepIndex: steps.length,
          label: labelFor(plan.timeUnit, steps.length),
          turningPoint: false,
        });
      }
    }

    steps = steps.map((s, i) => ({
      ...s,
      stepIndex: i,
      label: s.label && s.label.trim().length > 0 ? s.label : labelFor(plan.timeUnit, i),
    }));

    const finalMetrics =
      steps.length > 0 ? steps[steps.length - 1].metrics : result.finalMetrics;

    const normalized: TimelineOutput = {
      forkId: fork.id,
      forkLabel: fork.label,
      summary: result.summary,
      steps,
      finalMetrics,
    };

    return normalized;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[narrator] fork=${fork.id} failed: ${message}`);
    throw err;
  }
}
