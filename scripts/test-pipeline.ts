import fs from "node:fs";
import path from "node:path";

async function main() {
  const envText = fs.readFileSync(path.resolve(".env.local"), "utf-8");
  for (const line of envText.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2];
  }

  const { runSimulation } = await import("../lib/orchestrator");

  const input = {
    question:
      "Should I tell my close friend that their recent comment really hurt me?",
    options: ["Have the honest conversation", "Let it slide and move on"],
    context:
      "We have been friends 8 years. This is the second time something like this happened.",
  };

  console.log("Running simulation...");
  const start = Date.now();
  try {
    const result = await runSimulation(input);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\nDONE in ${elapsed}s\n`);
    console.log("plan:", JSON.stringify(result.plan, null, 2));
    console.log(`\ntimelines: ${result.timelines.length}`);
    for (const t of result.timelines) {
      console.log(`  - ${t.forkLabel}: ${t.steps.length} steps`);
      console.log(`    summary: ${t.summary.slice(0, 120)}...`);
    }
    fs.writeFileSync(
      "/tmp/rf-result.json",
      JSON.stringify(result, null, 2),
    );
    console.log("\nSaved full result to /tmp/rf-result.json");
  } catch (err: unknown) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\nFAILED in ${elapsed}s:`);
    console.log(err instanceof Error ? err.message : String(err));
    if (err && typeof err === "object" && "issues" in err) {
      console.log(
        "issues:",
        JSON.stringify((err as { issues: unknown }).issues, null, 2),
      );
    }
    process.exit(1);
  }
}

main();
