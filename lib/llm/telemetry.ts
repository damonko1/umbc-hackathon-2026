import { AsyncLocalStorage } from "node:async_hooks";
import type { ZodTypeAny, z } from "zod";
import type { ClarifyingQuestion, DecisionInput, SimulationResult } from "@/lib/schemas";
import type { CallMeta, LlmProvider, StructuredRequest } from "./types";

export type AgentLabel = "planner" | "dimensional" | "narrator" | "other";

export type SimulationStage =
  | "planner"
  | "dimensional"
  | "narrator"
  | "awaiting_answers"
  | "done";

export type CallRecord = {
  simulationId: string | null;
  agent: AgentLabel;
  provider: string;
  model: string;
  schemaName: string;
  promptChars: number;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  ok: boolean;
  error?: string;
  retries: number;
  usage?: { inputTokens?: number; outputTokens?: number };
};

type SimulationState = {
  id: string;
  startedAt: number;
  endedAt: number | null;
  stage: SimulationStage;
  plannedForks: number | null;
  plannedDimensions: number | null;
  callsDone: number;
  callsExpected: number | null;
  perAgent: Record<AgentLabel, { count: number; totalMs: number; maxMs: number }>;
  maxInFlight: number;
  rate429: number;
  errors: number;
  originalInput: DecisionInput | null;
  pausedQuestions: ClarifyingQuestion[] | null;
  result: SimulationResult | null;
};

type SimulationContext = { simulationId: string; startedAt: number };

const storage = new AsyncLocalStorage<SimulationContext>();

export function runWithSimulation<T>(
  simulationId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run({ simulationId, startedAt: Date.now() }, fn);
}

export function currentSimulationId(): string | null {
  return storage.getStore()?.simulationId ?? null;
}

function classifyAgent(schemaName: string): AgentLabel {
  if (schemaName.startsWith("PlannerOutput")) return "planner";
  if (schemaName.startsWith("DimensionalOutput")) return "dimensional";
  if (schemaName.startsWith("TimelineOutput")) return "narrator";
  return "other";
}

function zeroPerAgent(): SimulationState["perAgent"] {
  return {
    planner: { count: 0, totalMs: 0, maxMs: 0 },
    dimensional: { count: 0, totalMs: 0, maxMs: 0 },
    narrator: { count: 0, totalMs: 0, maxMs: 0 },
    other: { count: 0, totalMs: 0, maxMs: 0 },
  };
}

function enabled(): boolean {
  return process.env.LLM_TELEMETRY !== "0";
}

class TelemetryRecorder {
  private sims = new Map<string, SimulationState>();
  private recent: CallRecord[] = [];
  private recentCap = 500;
  private globalInFlight = 0;
  private globalInFlightByAgent: Record<AgentLabel, number> = {
    planner: 0,
    dimensional: 0,
    narrator: 0,
    other: 0,
  };

  startSimulation(id: string, input?: DecisionInput): SimulationState {
    const existing = this.sims.get(id);
    if (existing) {
      if (input && !existing.originalInput) existing.originalInput = input;
      return existing;
    }
    const state: SimulationState = {
      id,
      startedAt: Date.now(),
      endedAt: null,
      stage: "planner",
      plannedForks: null,
      plannedDimensions: null,
      callsDone: 0,
      callsExpected: null,
      perAgent: zeroPerAgent(),
      maxInFlight: 0,
      rate429: 0,
      errors: 0,
      originalInput: input ?? null,
      pausedQuestions: null,
      result: null,
    };
    this.sims.set(id, state);
    if (this.sims.size > 50) {
      const oldestId = this.sims.keys().next().value;
      if (oldestId) this.sims.delete(oldestId);
    }
    return state;
  }

  endSimulation(id: string): void {
    const s = this.sims.get(id);
    if (!s) return;
    s.endedAt = Date.now();
    s.stage = "done";
    this.emitSummary(s);
  }

  setPlan(id: string, forks: number, dimensions: number): void {
    const s = this.sims.get(id);
    if (!s) return;
    s.plannedForks = forks;
    s.plannedDimensions = dimensions;
    s.callsExpected = 1 + forks * dimensions + forks;
  }

  setAwaitingAnswers(id: string, questions: ClarifyingQuestion[]): void {
    const s = this.sims.get(id);
    if (!s) return;
    s.stage = "awaiting_answers";
    s.pausedQuestions = questions;
  }

  clearAwaitingAnswers(id: string): void {
    const s = this.sims.get(id);
    if (!s) return;
    s.pausedQuestions = null;
    if (s.stage === "awaiting_answers") s.stage = "planner";
  }

  setResult(id: string, result: SimulationResult): void {
    const s = this.sims.get(id);
    if (!s) return;
    s.result = result;
  }

  getSim(id: string): SimulationState | null {
    return this.sims.get(id) ?? null;
  }

  noteRate429(): void {
    const id = currentSimulationId();
    if (id) {
      const s = this.sims.get(id);
      if (s) s.rate429++;
    }
  }

  private inFlightSnapshot(): number {
    return this.globalInFlight;
  }

  private advanceStage(s: SimulationState, agent: AgentLabel) {
    if (agent === "dimensional" && s.stage === "planner") s.stage = "dimensional";
    else if (agent === "narrator" && s.stage !== "done") s.stage = "narrator";
  }

  private emitSummary(s: SimulationState) {
    if (!enabled()) return;
    const wall = ((s.endedAt ?? Date.now()) - s.startedAt) / 1000;
    const parts: string[] = [];
    for (const agent of ["planner", "dimensional", "narrator", "other"] as const) {
      const a = s.perAgent[agent];
      if (a.count === 0) continue;
      const avg = (a.totalMs / a.count / 1000).toFixed(1);
      const max = (a.maxMs / 1000).toFixed(1);
      parts.push(`${agent}=${a.count}(avg ${avg}s max ${max}s)`);
    }
    console.log(
      `[llm] sim=${s.id.slice(0, 8)} DONE calls=${s.callsDone}/${
        s.callsExpected ?? "?"
      } wall=${wall.toFixed(1)}s ${parts.join(" ")} maxInFlight=${s.maxInFlight} rate429=${s.rate429} errors=${s.errors}`,
    );
  }

  async record<S extends ZodTypeAny>(
    base: LlmProvider,
    req: StructuredRequest<S>,
  ): Promise<z.infer<S>> {
    if (!enabled()) return base.generateStructured(req);

    const agent = classifyAgent(req.schemaName);
    const simId = currentSimulationId();
    const sim = simId ? this.sims.get(simId) ?? null : null;
    if (sim) this.advanceStage(sim, agent);

    const promptChars = req.messages.reduce(
      (n, m) => n + (m.content?.length ?? 0),
      0,
    );

    this.globalInFlight++;
    this.globalInFlightByAgent[agent]++;
    if (sim) {
      const total = this.globalInFlight;
      if (total > sim.maxInFlight) sim.maxInFlight = total;
    }

    const startedAt = Date.now();
    let meta: CallMeta = {};
    const originalOnMeta = req.onMeta;
    const wrapped: StructuredRequest<S> = {
      ...req,
      onMeta: (m) => {
        meta = m;
        originalOnMeta?.(m);
      },
    };

    let ok = true;
    let error: string | undefined;
    let value: z.infer<S> | undefined;
    try {
      value = await base.generateStructured(wrapped);
    } catch (err) {
      ok = false;
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      const endedAt = Date.now();
      const durationMs = endedAt - startedAt;

      this.globalInFlight--;
      this.globalInFlightByAgent[agent]--;

      const rec: CallRecord = {
        simulationId: simId,
        agent,
        provider: base.name,
        model: base.model,
        schemaName: req.schemaName,
        promptChars,
        startedAt,
        endedAt,
        durationMs,
        ok,
        error,
        retries: meta.retries ?? 0,
        usage: meta.usage,
      };
      this.recent.push(rec);
      if (this.recent.length > this.recentCap) {
        this.recent.splice(0, this.recent.length - this.recentCap);
      }

      if (sim) {
        sim.callsDone++;
        if (!ok) sim.errors++;
        const a = sim.perAgent[agent];
        a.count++;
        a.totalMs += durationMs;
        if (durationMs > a.maxMs) a.maxMs = durationMs;
      }

      this.emit(rec, simId, sim?.startedAt);
    }

    return value as z.infer<S>;
  }

  private emit(rec: CallRecord, simId: string | null, simStartedAt?: number) {
    const rel = simStartedAt ? `+${Date.now() - simStartedAt}ms` : `@${rec.endedAt}`;
    const tok = rec.usage
      ? ` tok=${rec.usage.inputTokens ?? "?"}+${rec.usage.outputTokens ?? "?"}`
      : "";
    const tag = rec.ok ? "ok" : `FAIL err="${(rec.error ?? "").slice(0, 80)}"`;
    console.log(
      `[llm] ${rel} sim=${simId ? simId.slice(0, 8) : "-"} ag=${rec.agent} prov=${rec.provider} model=${rec.model} sch=${rec.schemaName} chars=${rec.promptChars} dur=${rec.durationMs}ms ${tag} retry=${rec.retries}${tok} inflight=${this.inFlightSnapshot()}`,
    );
  }

  globalSnapshot() {
    const now = Date.now();
    const oneMinAgo = now - 60_000;
    const lastMin = this.recent.filter((r) => r.endedAt >= oneMinAgo);
    const recentErrors = this.recent
      .slice(-20)
      .filter((r) => !r.ok)
      .map((r) => ({
        schemaName: r.schemaName,
        agent: r.agent,
        error: r.error,
        endedAt: r.endedAt,
      }));
    return {
      inFlight: this.globalInFlight,
      inFlightByAgent: { ...this.globalInFlightByAgent },
      lastMinuteCalls: lastMin.length,
      lastMinuteErrors: lastMin.filter((r) => !r.ok).length,
      recentErrors,
      totalRecorded: this.recent.length,
    };
  }
}

export const telemetry = new TelemetryRecorder();

export class TelemetryProvider implements LlmProvider {
  name: string;
  model: string;
  private inner: LlmProvider;

  constructor(inner: LlmProvider) {
    this.inner = inner;
    this.name = inner.name;
    this.model = inner.model;
  }

  generateStructured<S extends ZodTypeAny>(
    req: StructuredRequest<S>,
  ): Promise<z.infer<S>> {
    return telemetry.record(this.inner, req);
  }
}
