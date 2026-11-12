import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export function databaseTarget(env = process.env) {
  const ref = env.AP_FOOD_DEMO_PROJECT_REF;
  const url = env.DATABASE_URL;
  const api = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!ref || !url || !api || new URL(api).hostname !== `${ref}.supabase.co`) throw Error("Configure a dedicated demo project and database URL.");
  const parsed = new URL(url);
  if (!parsed.hostname.includes(ref) && parsed.username !== `postgres.${ref}`) throw Error("Database and demo project do not match.");
  return { ref, url };
}

export function findSupabaseCli() {
  if (process.env.SUPABASE_CLI_PATH) return process.env.SUPABASE_CLI_PATH;
  if (spawnSync("supabase", ["--version"], { encoding: "utf8" }).status === 0) return "supabase";
  const cache = process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "npm-cache", "_npx");
  if (cache && existsSync(cache)) for (const entry of readdirSync(cache)) {
    const binary = join(cache, entry, "node_modules", "@supabase", "cli-windows-x64", "bin", "supabase.exe");
    if (existsSync(binary)) return binary;
  }
  throw Error("Install the Supabase CLI or set SUPABASE_CLI_PATH to its executable.");
}

export function databaseCommand(cli, target, args) {
  const result = spawnSync(cli, ["db", "query", `--remote=${target.url}`, ...args], {
    encoding: "utf8", timeout: 60_000, maxBuffer: 4 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const parsed = new URL(target.url);
    const safe = (result.stdout || result.stderr || result.error?.code || "Database command failed")
      .replaceAll(target.url, "[DATABASE_URL]").replaceAll(parsed.password, "[REDACTED]");
    throw Error(safe.slice(0, 1600));
  }
  const output = result.stdout?.trim();
  if (!output) return undefined;
  if (output === "DO") return { command: "DO" };
  return JSON.parse(output);
}

export function readDatabase(cli, target, sql) {
  return databaseCommand(cli, target, ["--read-only", sql]).rows;
}
