"use client";

import * as React from "react";
import { HelpCircle, Sparkles } from "lucide-react";
import type { ClarifyingAnswer, ClarifyingQuestion } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const OTHER_VALUE = "__other__";

type AnswerState = {
  selected: string | null;
  otherText: string;
  freeText: string;
};

function emptyAnswer(): AnswerState {
  return { selected: null, otherText: "", freeText: "" };
}

function answerValue(q: ClarifyingQuestion, state: AnswerState): string {
  if (q.kind === "free_text") return state.freeText.trim();
  if (state.selected === OTHER_VALUE) return state.otherText.trim();
  return state.selected?.trim() ?? "";
}

export interface ClarifyingQuestionsProps {
  questions: ClarifyingQuestion[];
  onSubmit: (answers: ClarifyingAnswer[]) => void | Promise<void>;
  submitting?: boolean;
  error?: string | null;
}

export function ClarifyingQuestions({
  questions,
  onSubmit,
  submitting = false,
  error = null,
}: ClarifyingQuestionsProps) {
  const [answers, setAnswers] = React.useState<Record<string, AnswerState>>(
    () => Object.fromEntries(questions.map((q) => [q.id, emptyAnswer()])),
  );

  const allAnswered = questions.every((q) => answerValue(q, answers[q.id] ?? emptyAnswer()).length > 0);

  function update(id: string, patch: Partial<AnswerState>) {
    setAnswers((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? emptyAnswer()), ...patch },
    }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!allAnswered || submitting) return;
    const payload: ClarifyingAnswer[] = questions.map((q) => ({
      id: q.id,
      value: answerValue(q, answers[q.id] ?? emptyAnswer()),
    }));
    void onSubmit(payload);
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent-2)]/15 text-[var(--accent-2)]">
          <HelpCircle className="h-4 w-4" />
        </span>
        <CardTitle>A few quick things first</CardTitle>
        <CardDescription>
          Answering these helps me build a timeline that reflects your situation, not my assumptions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {questions.map((q, idx) => {
            const state = answers[q.id] ?? emptyAnswer();
            return (
              <div key={q.id} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <Label className="text-base">
                    <span className="text-[var(--muted)] mr-1.5">{idx + 1}.</span>
                    {q.prompt}
                  </Label>
                  {q.why && (
                    <p className="text-xs text-[var(--muted)]">
                      Why I&apos;m asking: {q.why}
                    </p>
                  )}
                </div>

                {q.kind === "multiple_choice" ? (
                  <MultipleChoice
                    questionId={q.id}
                    choices={q.choices ?? []}
                    state={state}
                    onChange={(patch) => update(q.id, patch)}
                  />
                ) : (
                  <Textarea
                    placeholder="Type your answer..."
                    value={state.freeText}
                    onChange={(e) => update(q.id, { freeText: e.target.value })}
                  />
                )}
              </div>
            );
          })}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" size="lg" disabled={!allAnswered || submitting}>
              <Sparkles className="h-4 w-4" />
              {submitting ? "Continuing simulation..." : "Continue with these answers"}
            </Button>
            {!allAnswered && (
              <span className="text-xs text-[var(--muted)]">
                Answer all {questions.length} to continue.
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

interface MultipleChoiceProps {
  questionId: string;
  choices: string[];
  state: AnswerState;
  onChange: (patch: Partial<AnswerState>) => void;
}

function MultipleChoice({ questionId, choices, state, onChange }: MultipleChoiceProps) {
  return (
    <div className="flex flex-col gap-2">
      {choices.map((choice) => {
        const id = `${questionId}-${choice}`;
        const checked = state.selected === choice;
        return (
          <label
            key={choice}
            htmlFor={id}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
              checked
                ? "border-[var(--accent-2)]/60 bg-[var(--accent-2)]/10"
                : "border-[var(--border)] hover:border-[var(--accent-2)]/30",
            )}
          >
            <input
              id={id}
              type="radio"
              name={questionId}
              value={choice}
              checked={checked}
              onChange={() => onChange({ selected: choice })}
              className="h-4 w-4 accent-[var(--accent-2)]"
            />
            <span className="text-sm">{choice}</span>
          </label>
        );
      })}

      <label
        htmlFor={`${questionId}-other`}
        className={cn(
          "flex flex-col gap-2 rounded-lg border p-3 cursor-pointer transition-colors",
          state.selected === OTHER_VALUE
            ? "border-[var(--accent-2)]/60 bg-[var(--accent-2)]/10"
            : "border-[var(--border)] hover:border-[var(--accent-2)]/30",
        )}
      >
        <div className="flex items-center gap-3">
          <input
            id={`${questionId}-other`}
            type="radio"
            name={questionId}
            value={OTHER_VALUE}
            checked={state.selected === OTHER_VALUE}
            onChange={() => onChange({ selected: OTHER_VALUE })}
            className="h-4 w-4 accent-[var(--accent-2)]"
          />
          <span className="text-sm">Other</span>
        </div>
        {state.selected === OTHER_VALUE && (
          <Input
            autoFocus
            placeholder="Type your own answer..."
            value={state.otherText}
            onChange={(e) => onChange({ otherText: e.target.value })}
          />
        )}
      </label>
    </div>
  );
}

export default ClarifyingQuestions;
