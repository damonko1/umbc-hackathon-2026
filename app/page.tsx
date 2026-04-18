import * as React from "react";
import { Sparkles, GitBranch, LineChart } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DecisionPresets } from "@/components/decision-presets";
import { DecisionForm } from "@/components/decision-form";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-14 sm:py-20 flex flex-col gap-12">
      <section className="flex flex-col items-start gap-4">
        <Badge variant="accent" className="gap-1.5">
          <Sparkles className="h-3 w-3" />
          Foresight engine
        </Badge>
        <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight leading-[1.05]">
          <span className="bg-gradient-to-r from-white via-white to-[var(--accent-2)] bg-clip-text text-transparent">
            Reality Fork
          </span>
        </h1>
        <p className="max-w-xl text-lg text-[var(--muted)] leading-relaxed">
          See the futures your decisions unlock. Describe a crossroads and
          watch parallel timelines play out, side by side.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Start from an example</CardTitle>
          <CardDescription>
            One click simulates a common decision. You can also write your
            own below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DecisionPresets />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Describe your decision</CardTitle>
          <CardDescription>
            Two or three options work best. Add context if it feels relevant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DecisionForm />
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            Icon: Sparkles,
            title: "1. Describe the decision",
            blurb: "Give your question, options, and a little context.",
          },
          {
            Icon: GitBranch,
            title: "2. We fork reality",
            blurb:
              "Parallel agents simulate each path across relevant life dimensions.",
          },
          {
            Icon: LineChart,
            title: "3. Compare futures",
            blurb:
              "Read narrated timelines and see how your metrics diverge.",
          },
        ].map(({ Icon, title, blurb }) => (
          <Card key={title}>
            <CardHeader className="flex flex-col gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)]/15 text-[var(--accent)]">
                <Icon className="h-4 w-4" />
              </span>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="mt-0">{blurb}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <footer className="text-xs text-[var(--muted)] text-center pt-4">
        Reality Fork is a speculative tool, not a prediction. Use it for
        reflection, not certainty.
      </footer>
    </main>
  );
}
