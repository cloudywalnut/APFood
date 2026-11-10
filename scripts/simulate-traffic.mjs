import { runTrafficScenario } from "./traffic-scenario.mjs";

try {
  if (process.argv.length !== 3) throw new Error("Usage: npm run simulate:traffic -- <light|medium|heavy>");
  const report = await runTrafficScenario(process.argv[2]);
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
