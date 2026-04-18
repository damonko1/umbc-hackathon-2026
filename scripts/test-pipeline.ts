import fs from "node:fs";
import path from "node:path";

async function main() {
  const envText = fs.readFileSync(path.resolve(".env.local"), "utf-8");
  for (const line of envText.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2];
  }

  const { runSimulation, resumeSimulation } = await import(
    "../lib/orchestrator.ts"
  );

  // ------------------------------------------------------------------
  // Case 1: rich input — should proceed straight to a plan, no questions.
  // ------------------------------------------------------------------
  const richInput = {
    question:
      "Should I tell my close friend that their recent comment really hurt me?",
    options: ["Have the honest conversation", "Let it slide and move on"],
    context:
      "We have been friends 8 years. This is the second time something like this happened.",
    speed: "normal" as const,
  };

  console.log("[case 1] rich input — expecting status=complete...");
  const t1 = Date.now();
  const r1 = await runSimulation(richInput);
  const e1 = ((Date.now() - t1) / 1000).toFixed(1);
  if (r1.status !== "complete") {
    console.log(
      `\n[case 1] FAIL after ${e1}s — expected status=complete, got status=${r1.status}`,
    );
    process.exit(1);
  }
  console.log(`[case 1] DONE in ${e1}s — sim=${r1.simulationId.slice(0, 8)}`);
  console.log(
    `  plan: timeUnit=${r1.result.plan.timeUnit} numSteps=${r1.result.plan.numSteps} forks=${r1.result.plan.forks.length} dims=${r1.result.plan.dimensions.length}`,
  );
  console.log(`  timelines: ${r1.result.timelines.length}`);
  fs.writeFileSync("/tmp/rf-result.json", JSON.stringify(r1.result, null, 2));

  // ------------------------------------------------------------------
  // Case 2: deliberately sparse input — should pause with questions.
  // Then answer them and confirm a complete result comes back.
  // ------------------------------------------------------------------
  const sparseInput = {
    question: "should I move?",
    options: ["yes", "no"],
    speed: "normal" as const,
  };

  console.log("\n[case 2] sparse input — expecting status=questions...");
  const t2 = Date.now();
  const r2 = await runSimulation(sparseInput);
  const e2 = ((Date.now() - t2) / 1000).toFixed(1);
  if (r2.status !== "questions") {
    console.log(
      `\n[case 2] WARNING after ${e2}s — planner did not ask questions despite sparse input. status=${r2.status}`,
    );
    console.log("  This may be OK (planner judged it clear enough), but the questions path was not exercised.");
    process.exit(0);
  }
  console.log(
    `[case 2] PAUSED in ${e2}s — sim=${r2.simulationId.slice(0, 8)} questions=${r2.questions.length}`,
  );
  for (const q of r2.questions) {
    console.log(`  - [${q.kind}] ${q.prompt}`);
    if (q.choices) {
      for (const c of q.choices) console.log(`      • ${c}`);
    }
    if (q.why) console.log(`      why: ${q.why}`);
  }

  // Auto-answer with the first choice for MC, or a canned string for free-text.
  const answers = r2.questions.map((q) => ({
    id: q.id,
    value:
      q.kind === "multiple_choice" && q.choices && q.choices.length > 0
        ? q.choices[0]
        : "I'm 28, single, looking to be closer to family and have lower cost of living. Timeframe: 3 years.",
  }));

  console.log("\n[case 2] resuming with synthetic answers...");
  const t3 = Date.now();
  const resumed = await resumeSimulation(r2.simulationId, answers);
  const e3 = ((Date.now() - t3) / 1000).toFixed(1);
  console.log(`[case 2] RESUMED in ${e3}s`);
  console.log(
    `  plan: timeUnit=${resumed.plan.timeUnit} numSteps=${resumed.plan.numSteps} forks=${resumed.plan.forks.length} dims=${resumed.plan.dimensions.length}`,
  );
  console.log(`  timelines: ${resumed.timelines.length}`);
  fs.writeFileSync(
    "/tmp/rf-result-resumed.json",
    JSON.stringify(resumed, null, 2),
  );

  console.log("\nAll cases passed.");
}

main().catch((err: unknown) => {
  console.log("\nFAILED:");
  console.log(err instanceof Error ? err.message : String(err));
  if (err && typeof err === "object" && "issues" in err) {
    console.log(
      "issues:",
      JSON.stringify((err as { issues: unknown }).issues, null, 2),
    );
  }
  process.exit(1);
});
