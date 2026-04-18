import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, AlertTriangle, History, Brain } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CompareView } from "@/components/compare-view";
import { MetricChart } from "@/components/metric-chart";
import { ChosenForkPicker } from "@/components/chosen-fork-picker";
import { isHistoryPersistenceEnabled } from "@/lib/db";
import { getDeviceTokenFromCookies, resolveOrCreateDevice } from "@/lib/device";
import { getDecisionDetail } from "@/lib/history";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function StatusBadge({ status }: { status: "pending" | "completed" | "failed" }) {
  if (status === "completed") {
    return (
      <Badge variant="accent" className="gap-1.5">
        <CheckCircle2 className="h-3 w-3" />
        Completed
      </Badge>
    );
  }

  if (status === "failed") {
    return (
      <Badge className="gap-1.5 border border-red-500/30 bg-red-500/10 text-red-300">
        <AlertTriangle className="h-3 w-3" />
        Failed
      </Badge>
    );
  }

  return (
    <Badge className="gap-1.5 border border-amber-500/30 bg-amber-500/10 text-amber-300">
      <Clock3 className="h-3 w-3" />
      Pending
    </Badge>
  );
}

export default async function HistoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isHistoryPersistenceEnabled()) {
    notFound();
  }

  const { id } = await params;
  const device = await resolveOrCreateDevice(await getDeviceTokenFromCookies());
  const detail = await getDecisionDetail({
    deviceId: device.id,
    decisionRunId: id,
  });

  if (!detail) {
    notFound();
  }

  const chosenOption = detail.options.find((option) => option.forkId === detail.chosenForkId);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-10 sm:py-14">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/history">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              History
            </Button>
          </Link>
          <Badge variant="accent" className="gap-1.5">
            <History className="h-3 w-3" />
            Saved decision
          </Badge>
          {detail.memoryItemId && (
            <Link href="/memory">
              <Badge variant="muted" className="gap-1.5">
                <Brain className="h-3 w-3" />
                Saved to memory
              </Badge>
            </Link>
          )}
        </div>
        <StatusBadge status={detail.status} />
      </div>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{detail.question}</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2">
              <span>Saved {formatDate(detail.createdAt)}</span>
              <span>·</span>
              <span>Depth: {detail.speed}</span>
              {chosenOption && (
                <>
                  <span>·</span>
                  <span>Chosen: {chosenOption.label}</span>
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {detail.context && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                  Context
                </p>
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{detail.context}</p>
              </div>
            )}
            {detail.goals && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                  Goals
                </p>
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{detail.goals}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Saved options</CardTitle>
            <CardDescription>
              The fork labels stored with this simulation.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {detail.memoryItemId && (
              <Link href="/memory" className="text-sm text-[var(--muted)] hover:text-foreground">
                View in memory: {detail.memoryItemTitle ?? "remembered summary"}
              </Link>
            )}
            <div className="flex flex-wrap gap-2">
            {detail.options.map((option) => (
              <Badge
                key={option.forkId}
                variant={detail.chosenForkId === option.forkId ? "accent" : "muted"}
              >
                {option.label}
              </Badge>
            ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {detail.status === "completed" && detail.result ? (
        <>
          <ChosenForkPicker
            decisionRunId={detail.id}
            options={detail.options.map((option) => ({
              forkId: option.forkId,
              label: option.label,
              description: option.description,
            }))}
            initialChosenForkId={detail.chosenForkId}
          />
          <MetricChart result={detail.result} />
          <CompareView result={detail.result} />
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {detail.status === "failed" ? "Simulation failed" : "Simulation pending"}
            </CardTitle>
            <CardDescription>
              {detail.errorMessage ??
                "This run has not produced a complete result payload yet."}
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </main>
  );
}
