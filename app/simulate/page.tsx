"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertTriangle, RotateCw } from "lucide-react";
import {
  DecisionInputSchema,
  SimulationResultSchema,
  type DecisionInput,
  type SimulationResult,
} from "@/lib/schemas";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingStates, type SimulationProgress } from "@/components/loading-states";
import { CompareView } from "@/components/compare-view";
import { MetricChart } from "@/components/metric-chart";

type Stage = 0 | 1 | 2 | 3;

function newSimulationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `sim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export default function SimulatePage() {
  const router = useRouter();
  const [stage, setStage] = React.useState<Stage>(1);
  const [result, setResult] = React.useState<SimulationResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<SimulationProgress | null>(null);
  const startedRef = React.useRef(false);

  React.useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem("realityfork:input");
    } catch {
      raw = null;
    }
    if (!raw) {
      router.replace("/");
      return;
    }

    let input: DecisionInput;
    try {
      const parsed = DecisionInputSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        router.replace("/");
        return;
      }
      input = parsed.data;
    } catch {
      router.replace("/");
      return;
    }

    const simulationId = newSimulationId();

    const t1 = setTimeout(() => {
      setStage((s) => (s < 2 ? 2 : s));
    }, 6000);

    let cancelled = false;
    const pollStats = async () => {
      while (!cancelled) {
        try {
          const r = await fetch(
            `/api/simulate/stats?id=${encodeURIComponent(simulationId)}`,
            { cache: "no-store" },
          );
          if (r.ok) {
            const j = (await r.json()) as {
              found?: boolean;
              stage?: "planner" | "dimensional" | "narrator" | "done";
              callsDone?: number;
              callsExpected?: number | null;
              maxInFlight?: number;
              rate429?: number;
              errors?: number;
            };
            if (j.found) {
              setProgress({
                stage: j.stage ?? "planner",
                callsDone: j.callsDone ?? 0,
                callsExpected: j.callsExpected ?? null,
                maxInFlight: j.maxInFlight ?? 0,
                rate429: j.rate429 ?? 0,
                errors: j.errors ?? 0,
              });
              if (j.stage === "dimensional" || j.stage === "narrator") {
                setStage((s) => (s < 2 ? 2 : s));
              }
            }
          }
        } catch {
          // ignore transient errors
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
    };
    void pollStats();

    (async () => {
      try {
        const res = await fetch("/api/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...input, simulationId }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(
            text ||
              `Simulation failed (${res.status} ${res.statusText}).`,
          );
        }
        const json = await res.json();
        const validated = SimulationResultSchema.safeParse(json);
        if (!validated.success) {
          throw new Error("Received an unexpected response shape.");
        }
        setResult(validated.data);
        setStage(3);
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Unknown error running simulation.";
        setError(msg);
      } finally {
        cancelled = true;
        clearTimeout(t1);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(t1);
    };
  }, [router]);

  if (error) {
    return (
      <main className="mx-auto w-full max-w-2xl px-5 py-16">
        <Card>
          <CardHeader className="flex flex-col gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/15 text-red-400">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <CardTitle>Simulation failed</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => router.push("/")}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button onClick={() => window.location.reload()}>
              <RotateCw className="h-4 w-4" />
              Try again
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!result || stage < 3) {
    return (
      <main className="mx-auto w-full max-w-2xl px-5 py-16 flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Forking reality
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Hold tight — this usually takes 10-20 seconds.
          </p>
        </header>
        <LoadingStates stage={stage} progress={progress} />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:py-14 flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/")}
        >
          <ArrowLeft className="h-4 w-4" />
          New decision
        </Button>
      </div>
      <MetricChart result={result} />
      <CompareView result={result} />
    </main>
  );
}
