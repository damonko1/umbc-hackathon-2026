import { getLlmProvider } from "@/lib/llm";
import type { ChatMessage } from "@/lib/llm/types";
import {
  DecisionInput,
  Dimension,
  DimensionalOutput,
  DimensionalOutputSchema,
  PlannerFork,
  PlannerOutput,
} from "@/lib/schemas";

export const DIMENSION_BRIEFS: Record<Dimension, string> = {
  financial:
    "Track money flow: income, savings, expenses, debt, and financial runway. Scores near 100 mean strong, stable finances; near 0 mean financial crisis. Note concrete drivers like salary changes, big purchases, or lost income.",
  career:
    "Track professional trajectory: skill growth, reputation, role seniority, and career momentum. Scores near 100 mean strong upward momentum and opportunity; near 0 mean stalled or damaged career. Note tangible milestones like promotions, new skills, or burnout.",
  psychological:
    "Track the person's inner state: stress, meaning, mood, and self-image. Scores near 100 mean thriving and aligned with values; near 0 mean burnt out, anxious, or lost. Focus on felt inner experience, not external events.",
  events:
    "Track notable external events and situational developments that happen because of this path: encounters, surprises, crises, wins. Scores near 100 mean meaningful positive events are landing; near 0 mean bad luck or crisis events dominate.",
  relationships:
    "Track the health of close bonds: friends, family, partner, key people in the person's life. Scores near 100 mean trust is deepening and connection is strong; near 0 mean ruptured trust, distance, or loss. Note concrete interactions that shifted the tie.",
  health:
    "Track physical and mental wellbeing: sleep, energy, fitness, recovery, mental load. Scores near 100 mean vital, rested, and resilient; near 0 mean sick, exhausted, or in crisis. Note tangible drivers like routine changes, stress load, or illness.",
  learning:
    "Track skills and knowledge gained through this path: formal study, on-the-job growth, craft mastery. Scores near 100 mean rapid meaningful learning; near 0 mean stagnation or skill decay. Note concrete things learned or capabilities unlocked.",
  identity:
    "Track who the person is becoming: values alignment, self-concept, sense of direction. Scores near 100 mean living in alignment with who they want to be; near 0 mean drifting, performing, or losing themselves. Note moments that reinforce or rattle their self-sense.",
  time:
    "Track autonomy and lifestyle: free time, pace, control over the schedule, recovery space. Scores near 100 mean spacious, self-directed days; near 0 mean overbooked, reactive, or trapped. Note what the week actually feels like.",
  social:
    "Track the broader social surface: community, belonging, reputation in a wider group, network breadth. Scores near 100 mean embedded and visible in a community; near 0 mean isolated or socially invisible. Distinct from close relationships — this is the wider circle.",
};

function buildSystemPrompt(dimension: Dimension): string {
  const brief = DIMENSION_BRIEFS[dimension];
  return `You are the ${dimension.toUpperCase()} dimension agent for Reality Fork.
${brief}

You ONLY produce per-step scores + notes for the ${dimension} dimension. Do not narrate other dimensions.
Each step's note is ONE sentence describing what happened on the ${dimension} axis at that step.
Scores are integers or floats from 0 to 100. Let them evolve realistically over time - they should not be flat, but also should not oscillate randomly.
Tell a coherent arc for this fork on this single dimension.

Return ONLY JSON matching the provided schema.`;
}

export async function runDimensional({
  dimension,
  fork,
  plan,
  input,
}: {
  dimension: Dimension;
  fork: PlannerFork;
  plan: PlannerOutput;
  input: DecisionInput;
}): Promise<DimensionalOutput> {
  const provider = getLlmProvider();

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
    },
    fork: {
      id: fork.id,
      label: fork.label,
      description: fork.description,
    },
    dimension,
  };

  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(dimension) },
    {
      role: "user",
      content: `Simulate the ${dimension} dimension for this fork.
Produce EXACTLY ${plan.numSteps} entries in perStep, with stepIndex from 0 to ${plan.numSteps - 1}.
Each entry needs score (0-100) and a one-sentence note.

CONTEXT:
${JSON.stringify(userPayload, null, 2)}

Return ONLY JSON matching the provided schema.`,
    },
  ];

  try {
    const result = await provider.generateStructured({
      messages,
      schema: DimensionalOutputSchema,
      schemaName: `DimensionalOutput_${dimension}`,
      temperature: 0.7,
      maxRetries: 2,
    });

    // Defensive: ensure dimension field matches.
    const normalized: DimensionalOutput = {
      dimension,
      perStep: result.perStep.slice(),
    };

    // Pad or truncate to exactly plan.numSteps.
    if (normalized.perStep.length > plan.numSteps) {
      normalized.perStep = normalized.perStep.slice(0, plan.numSteps);
    } else if (normalized.perStep.length < plan.numSteps) {
      const last =
        normalized.perStep[normalized.perStep.length - 1] ?? {
          stepIndex: 0,
          score: 50,
          note: `No data for ${dimension}.`,
        };
      while (normalized.perStep.length < plan.numSteps) {
        normalized.perStep.push({
          stepIndex: normalized.perStep.length,
          score: last.score,
          note: last.note,
        });
      }
    }

    // Normalize stepIndex values in order.
    normalized.perStep = normalized.perStep.map((step, i) => ({
      ...step,
      stepIndex: i,
    }));

    return normalized;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[dimensional:${dimension}] fork=${fork.id} failed: ${message}`,
    );
    throw err;
  }
}
