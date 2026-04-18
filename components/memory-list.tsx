"use client";

import * as React from "react";
import Link from "next/link";
import { Archive, Pin, PinOff, Save, LoaderCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";

type MemoryItem = {
  id: string;
  title: string;
  summary: string;
  question: string;
  pinned: boolean;
  status: "active" | "archived";
  decisionRunId: string | null;
  chosenForkId: string | null;
  chosenForkLabel: string | null;
  createdAt: string;
  updatedAt: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function MemoryList({ initialItems }: { initialItems: MemoryItem[] }) {
  const [items, setItems] = React.useState(initialItems);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function patchItem(id: string, patch: Partial<MemoryItem>) {
    setPendingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/memory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error ?? "Failed to update memory.");
      }
      setItems((current) =>
        current
          .map((item) => (item.id === id ? body : item))
          .filter((item) => item.status === "active")
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update memory.");
    } finally {
      setPendingId(null);
    }
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No memory yet</CardTitle>
          <CardDescription>
            Completed decisions will create reusable summaries here.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <section className="grid gap-4">
      {items.map((item) => (
      <MemoryCard
          key={`${item.id}:${item.updatedAt}`}
          item={item}
          pending={pendingId === item.id}
          onSave={patchItem}
        />
      ))}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </section>
  );
}

function MemoryCard({
  item,
  pending,
  onSave,
}: {
  item: MemoryItem;
  pending: boolean;
  onSave: (id: string, patch: Partial<MemoryItem>) => Promise<void>;
}) {
  const [title, setTitle] = React.useState(item.title);
  const [summary, setSummary] = React.useState(item.summary);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 border-b sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-xl">{item.title}</CardTitle>
            {item.pinned && <Badge variant="accent">Pinned</Badge>}
            {item.chosenForkLabel && <Badge variant="muted">Chose {item.chosenForkLabel}</Badge>}
          </div>
          <CardDescription className="mt-2 line-clamp-2">{item.question}</CardDescription>
        </div>
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <span>Updated {formatDate(item.updatedAt)}</span>
          {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
        </div>
      </CardHeader>

      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor={`memory-title-${item.id}`}>Title</Label>
          <Input
            id={`memory-title-${item.id}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={pending}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`memory-summary-${item.id}`}>Summary</Label>
          <Textarea
            id={`memory-summary-${item.id}`}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            disabled={pending}
            className="min-h-[96px]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="sm"
            onClick={() => void onSave(item.id, { title, summary })}
            disabled={pending || (title === item.title && summary === item.summary)}
          >
            <Save className="h-4 w-4" />
            Save
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void onSave(item.id, { pinned: !item.pinned })}
            disabled={pending}
          >
            {item.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            {item.pinned ? "Unpin" : "Pin"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void onSave(item.id, { status: "archived" })}
            disabled={pending}
          >
            <Archive className="h-4 w-4" />
            Archive
          </Button>
          {item.decisionRunId && (
            <Link href={`/history/${item.decisionRunId}`} className="text-sm text-[var(--muted)] hover:text-foreground">
              View related decision
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default MemoryList;
