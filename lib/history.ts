import { Prisma } from "@prisma/client";
import { getDb } from "@/lib/db";
import { syncMemoryChoiceForDecisionRun, upsertMemoryFromDecisionRun } from "@/lib/memory";
import {
  DecisionInputSchema,
  PlannerOutputSchema,
  SimulationResultSchema,
  type DecisionInput,
  type SimulationResult,
} from "@/lib/schemas";

const TITLE_MAX_LENGTH = 120;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

type JsonValue = Prisma.JsonObject | Prisma.JsonArray | string | number | boolean | null;

export function buildDecisionTitle(question: string) {
  const normalized = question.trim().replace(/\s+/g, " ");
  if (normalized.length <= TITLE_MAX_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, TITLE_MAX_LENGTH - 1).trimEnd()}…`;
}

export function getHistoryPageSize(raw: string | null) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(Math.floor(parsed), MAX_PAGE_SIZE);
}

export async function createPendingDecisionRun(args: {
  deviceId: string;
  input: DecisionInput;
}) {
  const { deviceId, input } = args;
  const db = getDb();

  return db.decisionRun.create({
    data: {
      deviceId,
      title: buildDecisionTitle(input.question),
      question: input.question,
      context: input.context ?? null,
      goals: input.goals ?? null,
      speed: input.speed,
      timeUnit: "pending",
      numSteps: 0,
      planRationale: "Simulation queued",
      status: "pending",
    },
  });
}

export async function markDecisionRunFailed(args: {
  decisionRunId: string;
  errorMessage: string;
}) {
  const db = getDb();
  return db.decisionRun.update({
    where: { id: args.decisionRunId },
    data: {
      status: "failed",
      errorMessage: args.errorMessage,
    },
  });
}

export async function finalizeDecisionRun(args: {
  decisionRunId: string;
  input: DecisionInput;
  deviceId: string;
  result: SimulationResult;
}) {
  const { decisionRunId, input, result, deviceId } = args;
  const { plan, timelines } = result;
  const db = getDb();

  await db.$transaction([
    db.decisionRun.update({
      where: { id: decisionRunId },
      data: {
        title: buildDecisionTitle(input.question),
        question: input.question,
        context: input.context ?? null,
        goals: input.goals ?? null,
        speed: input.speed,
        timeUnit: plan.timeUnit,
        numSteps: plan.numSteps,
        planRationale: plan.rationale,
        status: "completed",
        errorMessage: null,
      },
    }),
    db.decisionOption.deleteMany({
      where: { decisionRunId },
    }),
    db.decisionOption.createMany({
      data: timelines.map((timeline, index) => ({
        decisionRunId,
        forkId: timeline.forkId,
        label: timeline.forkLabel,
        description: plan.forks.find((fork) => fork.id === timeline.forkId)?.description ?? null,
        summary: timeline.summary,
        sortOrder: index,
      })),
    }),
    db.decisionRunPayload.upsert({
      where: { decisionRunId },
      update: {
        inputJson: input,
        planJson: plan,
        timelinesJson: timelines,
        resultJson: result,
      },
      create: {
        decisionRunId,
        inputJson: input,
        planJson: plan,
        timelinesJson: timelines,
        resultJson: result,
      },
    }),
  ]);

  await upsertMemoryFromDecisionRun({
    deviceId,
    decisionRunId,
    question: input.question,
    forkCount: timelines.length,
    timeUnit: plan.timeUnit,
  });
}

export async function listDecisionHistory(args: {
  deviceId: string;
  limit?: number;
  cursor?: string | null;
}) {
  const db = getDb();
  const take = args.limit ?? DEFAULT_PAGE_SIZE;
  const rows = await db.decisionRun.findMany({
    where: { deviceId: args.deviceId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(args.cursor
      ? {
          cursor: { id: args.cursor },
          skip: 1,
        }
      : {}),
    include: {
      memoryItem: {
        select: {
          id: true,
          title: true,
        },
      },
      options: {
        orderBy: { sortOrder: "asc" },
        select: {
          forkId: true,
          label: true,
        },
      },
    },
  });

  const hasMore = rows.length > take;
  const items = (hasMore ? rows.slice(0, take) : rows).map((row) => ({
    id: row.id,
    title: row.title,
    question: row.question,
    createdAt: row.createdAt.toISOString(),
    status: row.status,
    chosenForkId: row.chosenForkId,
    memoryItemId: row.memoryItem?.id ?? null,
    memoryItemTitle: row.memoryItem?.title ?? null,
    forkOptions: row.options,
  }));

  return {
    items,
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
  };
}

function parseResultJson(value: JsonValue) {
  return SimulationResultSchema.parse(value);
}

function parseInputJson(value: JsonValue) {
  return DecisionInputSchema.parse(value);
}

function parsePlanJson(value: JsonValue) {
  return PlannerOutputSchema.parse(value);
}

export async function getDecisionDetail(args: {
  deviceId: string;
  decisionRunId: string;
}) {
  const db = getDb();
  const row = await db.decisionRun.findFirst({
    where: {
      id: args.decisionRunId,
      deviceId: args.deviceId,
    },
    include: {
      memoryItem: {
        select: {
          id: true,
          title: true,
        },
      },
      options: {
        orderBy: { sortOrder: "asc" },
      },
      payload: true,
    },
  });

  if (!row) {
    return null;
  }

  const result = row.payload ? parseResultJson(row.payload.resultJson as JsonValue) : null;
  const input = row.payload ? parseInputJson(row.payload.inputJson as JsonValue) : null;
  const plan = row.payload ? parsePlanJson(row.payload.planJson as JsonValue) : null;

  return {
    id: row.id,
    title: row.title,
    question: row.question,
    context: row.context,
    goals: row.goals,
    speed: row.speed,
    status: row.status,
    chosenForkId: row.chosenForkId,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    memoryItemId: row.memoryItem?.id ?? null,
    memoryItemTitle: row.memoryItem?.title ?? null,
    options: row.options.map((option) => ({
      forkId: option.forkId,
      label: option.label,
      description: option.description,
      summary: option.summary,
      sortOrder: option.sortOrder,
    })),
    result,
    input,
    plan,
  };
}

export async function setChosenFork(args: {
  deviceId: string;
  decisionRunId: string;
  chosenForkId: string | null;
}) {
  const db = getDb();
  const row = await db.decisionRun.findFirst({
    where: {
      id: args.decisionRunId,
      deviceId: args.deviceId,
    },
    include: {
      options: {
        select: { forkId: true, label: true },
      },
    },
  });

  if (!row) {
    return { kind: "not_found" as const };
  }

  if (
    args.chosenForkId !== null &&
    !row.options.some((option) => option.forkId === args.chosenForkId)
  ) {
    return { kind: "invalid_choice" as const };
  }

  const updated = await db.decisionRun.update({
    where: { id: row.id },
    data: { chosenForkId: args.chosenForkId },
  });

  const chosenOption =
    args.chosenForkId === null
      ? null
      : row.options.find((option) => option.forkId === args.chosenForkId) ?? null;

  await syncMemoryChoiceForDecisionRun({
    decisionRunId: row.id,
    question: row.question,
    forkCount: row.options.length,
    timeUnit: row.timeUnit,
    chosenForkId: updated.chosenForkId,
    chosenForkLabel: chosenOption?.label ?? null,
  });

  return {
    kind: "ok" as const,
    chosenForkId: updated.chosenForkId,
  };
}
