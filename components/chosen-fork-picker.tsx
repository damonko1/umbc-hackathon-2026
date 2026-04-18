"use client";

import * as React from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Option = {
  forkId: string;
  label: string;
  description: string | null;
};

export interface ChosenForkPickerProps {
  decisionRunId: string;
  options: Option[];
  initialChosenForkId: string | null;
}

export function ChosenForkPicker({
  decisionRunId,
  options,
  initialChosenForkId,
}: ChosenForkPickerProps) {
  const [selected, setSelected] = React.useState<string | null>(initialChosenForkId);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function updateChoice(nextChoice: string | null) {
    const previous = selected;
    setSelected(nextChoice);
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/history/${decisionRunId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chosenForkId: nextChoice }),
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Failed to save your choice.");
        }
      } catch (err) {
        setSelected(previous);
        setError(err instanceof Error ? err.message : "Failed to save your choice.");
      }
    });
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/70 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">What did you choose?</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Save the option you actually picked so you can revisit it later.
          </p>
        </div>
        {pending && <LoaderCircle className="h-4 w-4 animate-spin text-[var(--muted)]" />}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => {
          const active = selected === option.forkId;
          return (
            <button
              key={option.forkId}
              type="button"
              onClick={() => updateChoice(option.forkId)}
              disabled={pending}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                active
                  ? "border-[var(--accent)] bg-[var(--accent)]/12"
                  : "border-[var(--border)] bg-[var(--background)]/40 hover:bg-[var(--card)]"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">{option.label}</span>
                {active && <CheckCircle2 className="h-4 w-4 text-[var(--accent)]" />}
              </div>
              {option.description && (
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{option.description}</p>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => updateChoice(null)}
          disabled={pending || selected === null}
        >
          Clear selection
        </Button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </section>
  );
}

export default ChosenForkPicker;
