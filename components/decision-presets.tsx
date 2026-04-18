"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Briefcase, MessageCircle, Plane, ArrowRight } from "lucide-react";
import type { DecisionInput } from "@/lib/schemas";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Preset = {
  key: string;
  title: string;
  blurb: string;
  Icon: React.ComponentType<{ className?: string }>;
  input: DecisionInput;
};

const PRESETS: Preset[] = [
  {
    key: "career",
    title: "Career crossroads",
    blurb: "Startup risk vs. BigCo stability.",
    Icon: Briefcase,
    input: {
      question:
        "Should I take the early-stage startup offer or stay at my stable BigCo job?",
      options: ["Take the startup offer", "Stay at BigCo"],
      context:
        "28, 3 years experience, mid-level engineer, $180k salary, apartment in Brooklyn.",
      speed: "normal",
    },
  },
  {
    key: "conversation",
    title: "Tough conversation",
    blurb: "Speak up with a friend, or let it go.",
    Icon: MessageCircle,
    input: {
      question:
        "Should I tell my close friend that their recent comment really hurt me?",
      options: ["Have the honest conversation", "Let it slide and move on"],
      context:
        "We've been friends 8 years. It's the second time something like this happened.",
      speed: "quick",
    },
  },
  {
    key: "relocation",
    title: "Relocation",
    blurb: "A year abroad vs. staying put.",
    Icon: Plane,
    input: {
      question: "Should I move to Lisbon for a year to work remotely?",
      options: ["Move to Lisbon for a year", "Stay put in my current city"],
      context:
        "Remote-first job, no dependents, partner is supportive but staying home.",
      speed: "normal",
    },
  },
];

export interface DecisionPresetsProps {
  onSelect?: (input: DecisionInput) => void;
}

export function DecisionPresets({ onSelect }: DecisionPresetsProps) {
  const router = useRouter();

  function handleClick(input: DecisionInput) {
    if (onSelect) {
      onSelect(input);
      return;
    }
    try {
      sessionStorage.setItem(
        "realityfork:input",
        JSON.stringify(input),
      );
    } catch {
      // ignore
    }
    router.push("/simulate");
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {PRESETS.map(({ key, title, blurb, Icon, input }) => (
        <Card
          key={key}
          className="flex flex-col hover:border-[var(--accent)]/60 transition-colors"
        >
          <CardHeader className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)]/15 text-[var(--accent)]">
                <Icon className="h-4 w-4" />
              </span>
              <CardTitle className="text-base">{title}</CardTitle>
            </div>
            <CardDescription className="mt-0">{blurb}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-between gap-4">
            <p className="text-sm text-[var(--muted)] line-clamp-3">
              {input.question}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleClick(input)}
              className="self-start"
            >
              Try this
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default DecisionPresets;
