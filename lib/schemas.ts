import { z } from "zod";

export const DIMENSIONS = [
  "financial",
  "career",
  "psychological",
  "events",
  "relationships",
  "health",
  "learning",
  "identity",
  "time",
  "social",
] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const TIME_UNITS = ["hour", "day", "week", "month", "year"] as const;
export type TimeUnit = (typeof TIME_UNITS)[number];

export const SPEED_TIERS = ["quick", "normal", "deep"] as const;
export type SpeedTier = (typeof SPEED_TIERS)[number];

export type TierBounds = {
  forksMin: number;
  forksMax: number;
  stepsMin: number;
  stepsMax: number;
  dimensionsMin: number;
  dimensionsMax: number;
};

export const SPEED_TIER_BOUNDS: Record<SpeedTier, TierBounds> = {
  quick: { forksMin: 1, forksMax: 2, stepsMin: 3, stepsMax: 6, dimensionsMin: 2, dimensionsMax: 3 },
  normal: { forksMin: 2, forksMax: 3, stepsMin: 6, stepsMax: 18, dimensionsMin: 2, dimensionsMax: 4 },
  deep: { forksMin: 2, forksMax: 3, stepsMin: 12, stepsMax: 36, dimensionsMin: 3, dimensionsMax: 4 },
};

/* ------------------------------ input ------------------------------ */

export const DecisionInputSchema = z.object({
  question: z.string().min(3).max(500).describe("The decision the user is weighing"),
  options: z
    .array(z.string().min(1).max(300))
    .min(2)
    .max(3)
    .describe("The 2-3 options the user is choosing between"),
  context: z
    .string()
    .max(2000)
    .optional()
    .describe("Background context: age, situation, current state"),
  goals: z
    .string()
    .max(1000)
    .optional()
    .describe("What the user cares about / wants to optimize for"),
  speed: z
    .enum(SPEED_TIERS)
    .default("normal")
    .describe("Simulation depth: quick (fast, fewer forks/steps), normal, or deep"),
});
export type DecisionInput = z.infer<typeof DecisionInputSchema>;

/* ----------------------------- planner ---------------------------- */

export const PlannerForkSchema = z.object({
  id: z.string().describe("Short slug id for the fork, e.g. fork-a"),
  label: z.string().describe("Short human label for the fork"),
  description: z.string().describe("One-sentence description of this path"),
});

export const PlannerOutputSchema = z.object({
  rationale: z
    .string()
    .describe("One sentence explaining why this horizon/granularity fits the decision"),
  timeUnit: z.enum(TIME_UNITS),
  numSteps: z
    .number()
    .int()
    .min(3)
    .max(36)
    .describe("How many timesteps to simulate; choose the smallest useful number"),
  dimensions: z
    .array(z.enum(DIMENSIONS))
    .min(1)
    .max(4)
    .describe("Which life dimensions are relevant to this decision"),
  forks: z.array(PlannerForkSchema).min(1).max(3),
});
export type PlannerFork = z.infer<typeof PlannerForkSchema>;
export type PlannerOutput = z.infer<typeof PlannerOutputSchema>;

/* ------------------ clarifying questions (planner) ------------------ */

export const ClarifyingQuestionSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(40)
    .describe("Short slug id for this question, e.g. q-timeframe"),
  prompt: z
    .string()
    .min(3)
    .max(300)
    .describe("The question to ask the user, in plain language"),
  kind: z
    .enum(["multiple_choice", "free_text"])
    .describe("Render style: multiple_choice shows preset options + Other; free_text shows a textarea"),
  choices: z
    .array(z.string().min(1).max(160))
    .min(2)
    .max(5)
    .optional()
    .describe("2-5 preset options when kind=multiple_choice. Do NOT include an 'Other' choice; the UI appends it."),
  why: z
    .string()
    .max(200)
    .optional()
    .describe("Optional one-liner: which ambiguity in the user's input this question resolves"),
});
export type ClarifyingQuestion = z.infer<typeof ClarifyingQuestionSchema>;

export const PlannerResponseSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("plan"), plan: PlannerOutputSchema }),
  z.object({
    type: z.literal("questions"),
    questions: z.array(ClarifyingQuestionSchema).min(1).max(3),
  }),
]);
export type PlannerResponse = z.infer<typeof PlannerResponseSchema>;

export const ClarifyingAnswerSchema = z.object({
  id: z.string().min(1).max(40),
  value: z.string().min(1).max(1000),
});
export type ClarifyingAnswer = z.infer<typeof ClarifyingAnswerSchema>;

/* ----------------------- dimensional agent ------------------------- */

export const DimensionStepSchema = z.object({
  stepIndex: z.number().int().min(0),
  score: z
    .number()
    .min(0)
    .max(100)
    .describe("Score on this dimension at this step, 0-100"),
  note: z.string().describe("One sentence of what happened on this dimension"),
});

export const DimensionalOutputSchema = z.object({
  dimension: z.enum(DIMENSIONS),
  perStep: z.array(DimensionStepSchema),
});
export type DimensionalOutput = z.infer<typeof DimensionalOutputSchema>;

/* ------------------------------ narrator --------------------------- */

const MetricsRecordSchema = z.object(
  Object.fromEntries(
    DIMENSIONS.map((d) => [d, z.number().min(0).max(100).optional()]),
  ) as Record<Dimension, z.ZodOptional<z.ZodNumber>>,
);

export const TimelineStepSchema = z.object({
  stepIndex: z.number().int().min(0),
  label: z.string().describe("Human label e.g. 'Month 3' or 'Day 5'"),
  headline: z.string().describe("Short event title, 3-8 words"),
  narrative: z
    .string()
    .describe("2-3 sentences of cause-and-effect story for this step"),
  metrics: MetricsRecordSchema.describe(
    "Per-dimension scores at this step (0-100), keyed by the dimensions in the plan",
  ),
  turningPoint: z.boolean().optional(),
});
export type TimelineStep = z.infer<typeof TimelineStepSchema>;

export const TimelineOutputSchema = z.object({
  forkId: z.string(),
  forkLabel: z.string(),
  summary: z.string().describe("3-4 sentence summary of how this path unfolds"),
  steps: z.array(TimelineStepSchema),
  finalMetrics: MetricsRecordSchema,
});
export type TimelineOutput = z.infer<typeof TimelineOutputSchema>;

/* ----------------------------- simulation -------------------------- */

export const SimulationResultSchema = z.object({
  input: DecisionInputSchema,
  plan: PlannerOutputSchema,
  timelines: z.array(TimelineOutputSchema),
  generatedAt: z.string(),
});
export type SimulationResult = z.infer<typeof SimulationResultSchema>;
