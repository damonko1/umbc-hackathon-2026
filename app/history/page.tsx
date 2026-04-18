import Link from "next/link";
import { History, ArrowLeft, CheckCircle2, Clock3, AlertTriangle, Brain } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isHistoryPersistenceEnabled } from "@/lib/db";
import { getDeviceTokenFromCookies, resolveOrCreateDevice } from "@/lib/device";
import { listDecisionHistory } from "@/lib/history";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function statusLabel(status: "pending" | "completed" | "failed") {
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  return "Pending";
}

function StatusIcon({ status }: { status: "pending" | "completed" | "failed" }) {
  if (status === "completed") {
    return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  }
  if (status === "failed") {
    return <AlertTriangle className="h-4 w-4 text-red-400" />;
  }
  return <Clock3 className="h-4 w-4 text-amber-400" />;
}

export default async function HistoryPage() {
  if (!isHistoryPersistenceEnabled()) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 py-12 sm:py-16">
        <header className="flex flex-col gap-4">
          <Badge variant="accent" className="gap-1.5 self-start">
            <History className="h-3 w-3" />
            Decision history
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            History requires a database
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Set <code>DATABASE_URL</code> in your environment to enable persistent
            decision history.
          </p>
        </header>
        <Link href="/">
          <Button variant="secondary">
            <ArrowLeft className="h-4 w-4" />
            Back home
          </Button>
        </Link>
      </main>
    );
  }

  const device = await resolveOrCreateDevice(await getDeviceTokenFromCookies());
  const history = await listDecisionHistory({ deviceId: device.id, limit: 20 });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-12 sm:py-16">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <Badge variant="accent" className="gap-1.5 self-start">
            <History className="h-3 w-3" />
            Decision history
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Past decisions
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Revisit earlier simulations, inspect what each path predicted, and mark
            the option you actually chose.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/memory">
            <Button variant="ghost">
              <Brain className="h-4 w-4" />
              Memory
            </Button>
          </Link>
          <Link href="/">
            <Button variant="secondary">
              <ArrowLeft className="h-4 w-4" />
              New decision
            </Button>
          </Link>
        </div>
      </header>

      {history.items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No history yet</CardTitle>
            <CardDescription>
              Run your first simulation and it will appear here automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button>Simulate futures</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-4">
          {history.items.map((item) => (
            <Link key={item.id} href={`/history/${item.id}`}>
              <Card className="transition-colors hover:bg-[var(--card)]">
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <CardTitle className="text-xl">{item.title}</CardTitle>
                    <CardDescription className="mt-2 line-clamp-2">
                      {item.question}
                    </CardDescription>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-sm text-[var(--muted)]">
                    <StatusIcon status={item.status} />
                    <span>{statusLabel(item.status)}</span>
                    <span>·</span>
                    <span>{formatDate(item.createdAt)}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-2">
                    {item.forkOptions.map((option) => (
                      <Badge
                        key={option.forkId}
                        variant={item.chosenForkId === option.forkId ? "accent" : "muted"}
                      >
                        {option.label}
                      </Badge>
                    ))}
                  </div>
                  {item.chosenForkId && (
                    <p className="text-sm text-[var(--muted)]">
                      Chosen:{" "}
                      <span className="font-medium text-foreground">
                        {item.forkOptions.find((option) => option.forkId === item.chosenForkId)?.label ??
                          item.chosenForkId}
                      </span>
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
