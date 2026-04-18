import { z } from "zod";
import { getLlmProvider } from "@/lib/llm";
import type { ChatMessage } from "@/lib/llm/types";
import {
  ClarifyingAnswer,
  ClarifyingQuestion,
  ClarifyingQuestionSchema,
  DecisionInput,
  DIMENSIONS,
  PlannerForkSchema,
  PlannerOutput,
  PlannerOutputSchema,
  PlannerResponse,
  TIME_UNITS,
  SPEED_TIER_BOUNDS,
} from "@/lib/schemas";

/**
 * Flat schema sent to the model when questions are allowed.
 * Discriminated unions confuse tool-use models (they sometimes string-ify
 * nested objects), so we keep the wire format flat and reshape after parsing.
 */
const FlatPlannerResponseSchema = z.object({
  type: z.enum(["plan", "questions"]).describe("'plan' to proceed; 'questions' to pause and ask the user"),
  rationale: z.string().optional().describe("[plan only] One sentence on why this horizon/granularity fits"),
  timeUnit: z.enum(TIME_UNITS).optional().describe("[plan only] Time unit"),
  numSteps: z.number().int().min(3).max(36).optional().describe("[plan only] How many timesteps"),
  dimensions: z.array(z.enum(DIMENSIONS)).min(1).max(4).optional().describe("[plan only] Which life dimensions matter"),
  forks: z.array(PlannerForkSchema).min(1).max(3).optional().describe("[plan only] Forks derived from the user's options or inferred from the decision when options are sparse"),
  questions: z.array(ClarifyingQuestionSchema).min(1).max(3).optional().describe("[questions only] 1-3 clarifying questions"),
});

const BASE_SYSTEM_PROMPT = `You are the Planner agent for Reality Fork, a tool that simulates parallel "what-if" timelines for a life decision.
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

Forks:
- If the user provides 2-3 clear options, use those directly.
- If the user provides only one option or leaves options blank, infer the missing plausible paths from the decision question, goals, and context.
- Context may include text extracted from uploaded files like resumes or job descriptions. Use that information when it is relevant.
- Each fork gets a short slug id like "fork-a", a short human label, and a one-sentence description.
- For the "quick" tier with 3 user options, you may collapse to the 2 most distinct forks.

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
Output: timeUnit "day", numSteps 3, dimensions ["social", "psychological"], 2 forks.`;

const QUESTIONS_ALLOWED_INSTRUCTIONS = `
You may, INSTEAD of returning a plan, return 1-3 clarifying questions when the input is genuinely ambiguous in ways that would meaningfully change the simulation (timeframe, priorities, constraints, what success looks like). Don't ask for the sake of asking — if the input is already specific enough to plan a useful simulation, just plan it.

When asking questions:
- Each question is either "multiple_choice" (with 2-5 distinct preset choices) or "free_text" (open-ended).
- Use multiple_choice when the answer space is naturally bounded (timeframe, priority, risk tolerance). Do NOT include an "Other" choice in your list — the UI appends it automatically.
- Use free_text only when canned options would be reductive (e.g. "what does success look like to you?").
- Ask at most 3 questions. Prefer the smallest number that resolves the real ambiguity.
- Each question's "why" should briefly name the ambiguity it resolves.

Response shape (FLAT — fill the relevant fields based on type):
- To proceed: set type="plan" and fill rationale, timeUnit, numSteps, dimensions, forks. Leave questions empty/omitted.
- To pause and ask: set type="questions" and fill questions. Leave plan fields (rationale, timeUnit, numSteps, dimensions, forks) empty/omitted.`;

const QUESTIONS_FORBIDDEN_INSTRUCTIONS = `
The user has already answered your earlier clarifying questions (see the PRIOR_ANSWERS section in the input). You MUST now produce a plan — do NOT ask more questions. Fold the answers into your planning decisions.

Response shape:
- { "type": "plan", "plan": { ...PlannerOutput } }`;

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

export type RunPlannerOptions = {
  mayAskQuestions?: boolean;
  priorAnswers?: Array<{ question: ClarifyingQuestion; answer: ClarifyingAnswer }>;
};

export async function runPlanner(
  input: DecisionInput,
  opts: RunPlannerOptions = {},
): Promise<PlannerResponse> {
  const provider = getLlmProvider();
  const speed = input.speed;
  const bounds = SPEED_TIER_BOUNDS[speed];
  const mayAskQuestions = opts.mayAskQuestions ?? false;

  const systemPrompt = mayAskQuestions
    ? `${BASE_SYSTEM_PROMPT}\n${QUESTIONS_ALLOWED_INSTRUCTIONS}`
    : `${BASE_SYSTEM_PROMPT}\n${QUESTIONS_FORBIDDEN_INSTRUCTIONS}`;

  const priorAnswersPayload = opts.priorAnswers?.map((qa) => ({
    question: qa.question.prompt,
    answer: qa.answer.value,
  }));

  const userPayload = {
    question: input.question,
    options: input.options ?? [],
    context: input.context ?? null,
    goals: input.goals ?? null,
    speed,
    bounds: {
      forks: `${bounds.forksMin}-${bounds.forksMax}`,
      numSteps: `${bounds.stepsMin}-${bounds.stepsMax}`,
      dimensions: `${bounds.dimensionsMin}-${bounds.dimensionsMax}`,
    },
    ...(priorAnswersPayload && priorAnswersPayload.length > 0
      ? { PRIOR_ANSWERS: priorAnswersPayload }
      : {}),
  };

  const userInstruction = mayAskQuestions
    ? `Design a Reality Fork simulation plan for this decision, OR return clarifying questions if the input is genuinely ambiguous.`
    : `The user has answered your earlier questions. Design the Reality Fork simulation plan now — questions are no longer permitted.`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `${userInstruction}

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
    if (mayAskQuestions) {
      const flat = await provider.generateStructured({
        messages,
        schema: FlatPlannerResponseSchema,
        schemaName: "PlannerResponse",
        temperature: 0.3,
        maxRetries: 2,
      });

      if (flat.type === "questions") {
        if (!flat.questions || flat.questions.length === 0) {
          throw new Error("Planner returned type=questions but no questions");
        }
        return { type: "questions", questions: flat.questions };
      }

      const planCandidate = {
        rationale: flat.rationale,
        timeUnit: flat.timeUnit,
        numSteps: flat.numSteps,
        dimensions: flat.dimensions,
        forks: flat.forks,
      };
      const parsedPlan = PlannerOutputSchema.parse(planCandidate);
      return { type: "plan", plan: clampToTier(parsedPlan, speed) };
    }

    const plan = await provider.generateStructured({
      messages,
      schema: PlannerOutputSchema,
      schemaName: "PlannerOutput",
      temperature: 0.3,
      maxRetries: 2,
    });
    return { type: "plan", plan: clampToTier(plan, speed) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[planner] failed: ${message}`);
    throw err;
  }
}
