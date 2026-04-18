import { type MemoryItemStatus } from "@prisma/client";
import { z } from "zod";
import { getDb } from "@/lib/db";

const MemoryStatusSchema = z.enum(["active", "archived"]);
const UpdateMemoryItemSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  summary: z.string().trim().min(1).max(1000).optional(),
  pinned: z.boolean().optional(),
  status: MemoryStatusSchema.optional(),
});

export type UpdateMemoryItemInput = z.infer<typeof UpdateMemoryItemSchema>;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function getMemoryPageSize(raw: string | null) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(Math.floor(parsed), MAX_PAGE_SIZE);
}

function buildMemoryTitle(question: string) {
  const normalized = question.trim().replace(/\s+/g, " ");
  if (normalized.length <= 120) {
    return normalized;
  }
  return `${normalized.slice(0, 119).trimEnd()}…`;
}

function truncateQuestion(question: string) {
  const normalized = question.trim().replace(/\s+/g, " ");
  if (normalized.length <= 120) {
    return normalized;
  }
  return `${normalized.slice(0, 119).trimEnd()}…`;
}

function buildDecisionSummary(args: {
  question: string;
  forkCount: number;
  timeUnit: string;
  chosenForkLabel?: string | null;
}) {
  const base = `Asked: ${truncateQuestion(args.question)}. Simulated ${args.forkCount} path${
    args.forkCount === 1 ? "" : "s"
  } over ${args.timeUnit}.`;

  if (args.chosenForkLabel) {
    return `${base} Chose ${args.chosenForkLabel}.`;
  }

  return base;
}

function parseMemoryStatus(raw?: string | null): MemoryItemStatus {
  return MemoryStatusSchema.parse(raw ?? "active");
}

export function parseMemoryPinned(raw: string | null) {
  if (raw === null) return undefined;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return undefined;
}

export function parseUpdateMemoryItem(body: unknown) {
  return UpdateMemoryItemSchema.safeParse(body);
}

export async function upsertMemoryFromDecisionRun(args: {
  deviceId: string;
  decisionRunId: string;
  question: string;
  forkCount: number;
  timeUnit: string;
  chosenForkId?: string | null;
  chosenForkLabel?: string | null;
}) {
  const db = getDb();
  const generatedTitle = buildMemoryTitle(args.question);
  const generatedSummary = buildDecisionSummary({
    question: args.question,
    forkCount: args.forkCount,
    timeUnit: args.timeUnit,
    chosenForkLabel: args.chosenForkLabel,
  });

  const existing = await db.memoryItem.findUnique({
    where: { decisionRunId: args.decisionRunId },
  });

  if (!existing) {
    return db.memoryItem.create({
      data: {
        deviceId: args.deviceId,
        decisionRunId: args.decisionRunId,
        kind: "decision_summary",
        title: generatedTitle,
        summary: generatedSummary,
        question: args.question,
        chosenForkId: args.chosenForkId ?? null,
        chosenForkLabel: args.chosenForkLabel ?? null,
        status: "active",
      },
    });
  }

  return db.memoryItem.update({
    where: { id: existing.id },
    data: {
      question: args.question,
      chosenForkId: args.chosenForkId ?? null,
      chosenForkLabel: args.chosenForkLabel ?? null,
      title: existing.userEditedTitle ? undefined : generatedTitle,
      summary: existing.userEditedSummary ? undefined : generatedSummary,
    },
  });
}

export async function syncMemoryChoiceForDecisionRun(args: {
  decisionRunId: string;
  question: string;
  forkCount: number;
  timeUnit: string;
  chosenForkId: string | null;
  chosenForkLabel: string | null;
}) {
  const db = getDb();
  const existing = await db.memoryItem.findUnique({
    where: { decisionRunId: args.decisionRunId },
  });

  if (!existing) {
    return null;
  }

  return db.memoryItem.update({
    where: { id: existing.id },
    data: {
      chosenForkId: args.chosenForkId,
      chosenForkLabel: args.chosenForkLabel,
      summary: existing.userEditedSummary
        ? undefined
        : buildDecisionSummary({
            question: args.question,
            forkCount: args.forkCount,
            timeUnit: args.timeUnit,
            chosenForkLabel: args.chosenForkLabel,
          }),
    },
  });
}

export async function listMemoryItems(args: {
  deviceId: string;
  status?: string | null;
  pinned?: boolean;
  limit?: number;
  cursor?: string | null;
}) {
  const db = getDb();
  const take = args.limit ?? getMemoryPageSize(null);
  const rows = await db.memoryItem.findMany({
    where: {
      deviceId: args.deviceId,
      status: parseMemoryStatus(args.status),
      ...(typeof args.pinned === "boolean" ? { pinned: args.pinned } : {}),
    },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > take;
  const items = (hasMore ? rows.slice(0, take) : rows).map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    question: row.question,
    pinned: row.pinned,
    status: row.status,
    decisionRunId: row.decisionRunId,
    chosenForkId: row.chosenForkId,
    chosenForkLabel: row.chosenForkLabel,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));

  return {
    items,
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
  };
}

export async function updateMemoryItem(args: {
  deviceId: string;
  memoryItemId: string;
  patch: UpdateMemoryItemInput;
}) {
  const db = getDb();
  const existing = await db.memoryItem.findFirst({
    where: {
      id: args.memoryItemId,
      deviceId: args.deviceId,
    },
  });

  if (!existing) {
    return { kind: "not_found" as const };
  }

  const updated = await db.memoryItem.update({
    where: { id: existing.id },
    data: {
      title: args.patch.title,
      summary: args.patch.summary,
      pinned: args.patch.pinned,
      status: args.patch.status,
      userEditedTitle:
        typeof args.patch.title === "string" ? true : undefined,
      userEditedSummary:
        typeof args.patch.summary === "string" ? true : undefined,
    },
  });

  return {
    kind: "ok" as const,
    item: {
      id: updated.id,
      title: updated.title,
      summary: updated.summary,
      question: updated.question,
      pinned: updated.pinned,
      status: updated.status,
      decisionRunId: updated.decisionRunId,
      chosenForkId: updated.chosenForkId,
      chosenForkLabel: updated.chosenForkLabel,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  };
}
