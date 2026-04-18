import { getLlmProvider } from "@/lib/llm";
import type { ChatMessage } from "@/lib/llm/types";
import {
  DecisionInput,
  PlannerOutput,
  PlannerOutputSchema,
} from "@/lib/schemas";

const SYSTEM_PROMPT = `You are the Planner agent for Reality Fork, a tool that simulates parallel "what-if" timelines for a life decision.
Your job is to design the simulation: choose an appropriate time scale, decide how many steps to simulate, pick which life dimensions matter, and split the user's options into 2-3 forks.

Adaptive time-scale rule (important):
- A conversation or small social decision unfolds in days or a few weeks. Use timeUnit "day" or "week" and a small numSteps (like 5-10).
- A career, relocation, or major financial decision unfolds over months or years. Use timeUnit "month" with a numSteps like 12-24, or timeUnit "year" for very long horizons.
- Pick the smallest useful numSteps (3-36) that still captures meaningful change.

Dimensions rule: only include dimensions that actually matter for the decision. Do NOT include "financial" for a conversation decision. Do NOT include "career" for a purely personal/social decision. Always consider "psychological" and "events" for most decisions.

Forks: generate 2-3 forks directly from the user's options. Each fork gets a short slug id like "fork-a", a short human label, and a one-sentence description.

Few-shot examples:
Example 1 input: question "Should I tell my friend that their partner is cheating?", options ["Tell them directly", "Stay out of it"].
Example 1 output: timeUnit "day", numSteps 7, dimensions ["psychological", "events"], two forks.
Example 2 input: question "Should I join a startup or take the BigCo offer?", options ["Join the startup", "Take the BigCo offer"].
Example 2 output: timeUnit "month", numSteps 24, dimensions ["financial", "career", "psychological", "events"], two forks.

Return ONLY JSON matching the provided schema.`;

export async function runPlanner(input: DecisionInput): Promise<PlannerOutput> {
  const provider = getLlmProvider();

  const userPayload = {
    question: input.question,
    options: input.options,
    context: input.context ?? null,
    goals: input.goals ?? null,
  };

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Design a Reality Fork simulation plan for this decision.

INPUT:
${JSON.stringify(userPayload, null, 2)}

Return ONLY JSON matching the provided schema.`,
    },
  ];

  try {
    const result = await provider.generateStructured({
      messages,
      schema: PlannerOutputSchema,
      schemaName: "PlannerOutput",
      temperature: 0.3,
      maxRetries: 2,
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[planner] failed: ${message}`);
    throw err;
  }
}
