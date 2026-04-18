"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Sparkles } from "lucide-react";
import {
  DecisionInputSchema,
  type DecisionInput,
  type SpeedTier,
} from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const SPEED_OPTIONS: { value: SpeedTier; label: string; caption: string }[] = [
  { value: "quick", label: "Quick", caption: "~15s · 1-2 forks, 3-6 steps" },
  { value: "normal", label: "Normal", caption: "~45s · 2-3 forks, up to 18 steps" },
  { value: "deep", label: "Deep", caption: "~2 min · 2-3 forks, up to 36 steps" },
];

type FieldErrors = {
  question?: string;
  options?: (string | undefined)[];
  context?: string;
  goals?: string;
  _form?: string;
};

export interface DecisionFormProps {
  initial?: DecisionInput;
}

export function DecisionForm({ initial }: DecisionFormProps) {
  const router = useRouter();
  const [question, setQuestion] = React.useState(initial?.question ?? "");
  const [options, setOptions] = React.useState<string[]>(
    initial?.options ?? ["", ""],
  );
  const [context, setContext] = React.useState(initial?.context ?? "");
  const [goals, setGoals] = React.useState(initial?.goals ?? "");
  const [speed, setSpeed] = React.useState<SpeedTier>(
    initial?.speed ?? "normal",
  );
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (initial) {
      setQuestion(initial.question ?? "");
      setOptions(initial.options ?? ["", ""]);
      setContext(initial.context ?? "");
      setGoals(initial.goals ?? "");
      setSpeed(initial.speed ?? "normal");
    }
  }, [initial]);

  function updateOption(idx: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === idx ? value : o)));
  }

  function addOption() {
    if (options.length >= 3) return;
    setOptions((prev) => [...prev, ""]);
  }

  function removeOption(idx: number) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    const candidate: Record<string, unknown> = {
      question: question.trim(),
      options: options.map((o) => o.trim()).filter((o) => o.length > 0),
      speed,
    };
    if (context.trim()) candidate.context = context.trim();
    if (goals.trim()) candidate.goals = goals.trim();

    const parsed = DecisionInputSchema.safeParse(candidate);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const [head, sub] = issue.path;
        if (head === "question") next.question = issue.message;
        else if (head === "context") next.context = issue.message;
        else if (head === "goals") next.goals = issue.message;
        else if (head === "options") {
          if (typeof sub === "number") {
            const arr = next.options ?? [];
            arr[sub] = issue.message;
            next.options = arr;
          } else {
            next._form = issue.message;
          }
        } else {
          next._form = issue.message;
        }
      }
      setErrors(next);
      setSubmitting(false);
      return;
    }

    setErrors({});
    try {
      sessionStorage.setItem(
        "realityfork:input",
        JSON.stringify(parsed.data),
      );
    } catch {
      // ignore storage errors
    }
    router.push("/simulate");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="rf-question">The decision you're weighing</Label>
        <Input
          id="rf-question"
          placeholder="Should I take the startup offer or stay at BigCo?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className={cn(errors.question && "border-red-500/70")}
        />
        {errors.question && (
          <p className="text-xs text-red-400">{errors.question}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>Options (2-3)</Label>
          {options.length < 3 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addOption}
            >
              <Plus className="h-3.5 w-3.5" />
              Add option
            </Button>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {options.map((opt, idx) => (
            <div key={idx} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Input
                  placeholder={`Option ${idx + 1}`}
                  value={opt}
                  onChange={(e) => updateOption(idx, e.target.value)}
                  className={cn(
                    errors.options?.[idx] && "border-red-500/70",
                  )}
                />
                {options.length > 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOption(idx)}
                    aria-label="Remove option"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {errors.options?.[idx] && (
                <p className="text-xs text-red-400">
                  {errors.options[idx]}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="rf-context">
          Context <span className="text-[var(--muted)]">(optional)</span>
        </Label>
        <Textarea
          id="rf-context"
          placeholder="Age, situation, current state, constraints..."
          value={context}
          onChange={(e) => setContext(e.target.value)}
          className={cn(errors.context && "border-red-500/70")}
        />
        {errors.context && (
          <p className="text-xs text-red-400">{errors.context}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="rf-goals">
          Goals <span className="text-[var(--muted)]">(optional)</span>
        </Label>
        <Textarea
          id="rf-goals"
          placeholder="What do you want to optimize for?"
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          className={cn(errors.goals && "border-red-500/70")}
        />
        {errors.goals && (
          <p className="text-xs text-red-400">{errors.goals}</p>
        )}
      </div>

      {errors._form && (
        <p className="text-sm text-red-400">{errors._form}</p>
      )}

      <div className="flex flex-col gap-2">
        <Label>Simulation depth</Label>
        <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--card)]/50 p-1 w-fit">
          {SPEED_OPTIONS.map((opt) => {
            const active = speed === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSpeed(opt.value)}
                aria-pressed={active}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-md transition-colors",
                  active
                    ? "bg-[var(--accent)]/20 text-foreground"
                    : "text-[var(--muted)] hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-[var(--muted)]">
          {SPEED_OPTIONS.find((o) => o.value === speed)?.caption}
        </p>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" size="lg" disabled={submitting}>
          <Sparkles className="h-4 w-4" />
          {submitting ? "Forking reality..." : "Simulate futures"}
        </Button>
      </div>
    </form>
  );
}

export default DecisionForm;
