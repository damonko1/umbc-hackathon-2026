import { getLlmProvider } from "@/lib/llm";
import type { ChatMessage } from "@/lib/llm/types";
import {
  DecisionInput,
  PlannerOutput,
  PlannerOutputSchema,
  SPEED_TIER_BOUNDS,
} from "@/lib/schemas";

const SYSTEM_PROMPT = `You are the Planner agent for Reality Fork, a tool that simulates parallel "what-if" timelines for a life decision.
Your job is to design the simulation: choose an appropriate time scale, decide how many steps to simulate, pick which life dimensions matter, and split the user's options into forks.

Adaptive time-scale rule:
- A conversation or small social decision unfolds in days or a few weeks. Use timeUnit "day" or "week".
- A career, relocation, or major financial decision unfolds over months or years. Use timeUnit "month" or "year".
- Pick the smallest useful numSteps that still captures meaningful change.

Speed tier (respect the bounds exactly):
- "quick": forks 1-2, numSteps 3-6, dimensions 2-3. Use for light questions or when the user wants a fast read.
- "normal": forks 2-3, numSteps 6-18, dimensions 2-4. The default.
- "deep": forks 2-3, numSteps 12-36, dimensions 3-4. Use only when the user asks for it.

Dimensions (pick ONLY those that actually matter for this decision; do not include irrelevant ones):
- financial: money, savings, income, debt, financial runway.
- career: professional trajectory, skill growth, role seniority, reputation at work.
- psychological: inner state, stress, meaning, mood, anxiety.
- events: external happenings, luck, shocks, surprises, crises, wins.
- relationships: friendships, family, partner dynamics, trust, closeness.
- health: physical and mental wellbeing, sleep, energy, fitness.
- learning: skills gained, knowledge acquired, academic or intellectual growth.
- identity: who the person is becoming, values alignment, self-concept.
- time: free time, autonomy, lifestyle pace, control over schedule.
- social: community, belonging, reputation in a broader group, friend network breadth.

Dimension selection rules:
- Do NOT include "financial" for a pure conversation or social decision.
- Do NOT include "career" for a purely personal/social decision.
- For a PhD vs. job decision, favor "career", "learning", "identity", and usually "financial" — not "social".
- For a friendship or interpersonal conflict, favor "relationships" and "psychological" — not "financial" or "career".
- For a health or lifestyle decision, favor "health", "time", and "psychological".
- Always stay within the tier's dimension count.

Forks: generate forks directly from the user's options. Each fork gets a short slug id like "fork-a", a short human label, and a one-sentence description. For the "quick" tier with 3 user options, you may collapse to the 2 most distinct forks.

Few-shot examples:

Example A — conversation, quick tier:
Input: question "Should I tell my friend that their recent comment really hurt me?", options ["Have the conversation", "Let it slide"], speed "quick".
Output: timeUnit "day", numSteps 5, dimensions ["relationships", "psychological"], 2 forks.

Example B — career vs. academia, deep tier:
Input: question "Should I do a PhD or take the Google job?", options ["Start the PhD", "Take the Google job"], speed "deep".
Output: timeUnit "year", numSteps 20, dimensions ["career", "learning", "identity", "financial"], 2 forks.

Example C — startup vs. BigCo, normal tier:
Input: question "Startup offer vs. BigCo?", options ["Take startup", "Stay at BigCo"], speed "normal".
Output: timeUnit "month", numSteps 18, dimensions ["financial", "career", "psychological", "events"], 2 forks.

Example D — weekend plan, quick tier:
Input: question "Go to the party or stay in?", options ["Go out", "Stay in"], speed "quick".
Output: timeUnit "day", numSteps 3, dimensions ["social", "psychological"], 2 forks.

Return ONLY JSON matching the provided schema.`;

function clampToTier(
  plan: PlannerOutput,
  speed: DecisionInput["speed"],
): PlannerOutput {
  const bounds = SPEED_TIER_BOUNDS[speed];

  let numSteps = plan.numSteps;
  if (numSteps < bounds.stepsMin) numSteps = bounds.stepsMin;
  if (numSteps > bounds.stepsMax) numSteps = bounds.stepsMax;

  let forks = plan.forks;
  if (forks.length > bounds.forksMax) forks = forks.slice(0, bounds.forksMax);

  let dimensions = plan.dimensions;
  if (dimensions.length > bounds.dimensionsMax) {
    dimensions = dimensions.slice(0, bounds.dimensionsMax);
  }

  return {
    ...plan,
    numSteps,
    forks,
    dimensions,
  };
}

export async function runPlanner(input: DecisionInput): Promise<PlannerOutput> {
  const provider = getLlmProvider();
  const speed = input.speed;
  const bounds = SPEED_TIER_BOUNDS[speed];

  const userPayload = {
    question: input.question,
    options: input.options,
    context: input.context ?? null,
    goals: input.goals ?? null,
    speed,
    bounds: {
      forks: `${bounds.forksMin}-${bounds.forksMax}`,
      numSteps: `${bounds.stepsMin}-${bounds.stepsMax}`,
      dimensions: `${bounds.dimensionsMin}-${bounds.dimensionsMax}`,
    },
  };

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Design a Reality Fork simulation plan for this decision.

Speed tier is "${speed}". You MUST stay within these bounds:
- forks: ${bounds.forksMin}-${bounds.forksMax}
- numSteps: ${bounds.stepsMin}-${bounds.stepsMax}
- dimensions: ${bounds.dimensionsMin}-${bounds.dimensionsMax}

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
    return clampToTier(result, speed);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[planner] failed: ${message}`);
    throw err;
  }
}
