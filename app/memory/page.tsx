import Link from "next/link";
import { ArrowLeft, Brain } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isHistoryPersistenceEnabled } from "@/lib/db";
import { getDeviceTokenFromCookies, resolveOrCreateDevice } from "@/lib/device";
import { listMemoryItems } from "@/lib/memory";
import { MemoryList } from "@/components/memory-list";

export default async function MemoryPage() {
  if (!isHistoryPersistenceEnabled()) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 py-12 sm:py-16">
        <header className="flex flex-col gap-4">
          <Badge variant="accent" className="gap-1.5 self-start">
            <Brain className="h-3 w-3" />
            Memory
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Memory requires a database
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Set <code>DATABASE_URL</code> in your environment to enable saved decision memory.
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
  const memory = await listMemoryItems({
    deviceId: device.id,
    status: "active",
    limit: 20,
  });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-12 sm:py-16">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <Badge variant="accent" className="gap-1.5 self-start">
            <Brain className="h-3 w-3" />
            Memory
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Remembered decisions
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Curated summaries of specific things you asked, with quick links back to the full simulation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/history">
            <Button variant="ghost">History</Button>
          </Link>
          <Link href="/">
            <Button variant="secondary">
              <ArrowLeft className="h-4 w-4" />
              New decision
            </Button>
          </Link>
        </div>
      </header>

      <MemoryList initialItems={memory.items} />
    </main>
  );
}
