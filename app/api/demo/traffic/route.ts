import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { labReport, labScenario, trafficLabEnabled } from "../../../../lib/traffic-lab";

export const runtime = "nodejs";
const exec = promisify(execFile);
let running = false;

export async function POST(request: Request) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!trafficLabEnabled()) return Response.json({ message: "Traffic Lab is disabled." }, { status: 404 });
  if (!host || !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host) ||
    origin !== url.protocol + "//" + host || request.headers.get("x-ap-food-traffic-lab") !== "1") {
    return Response.json({ message: "Open Traffic Lab from the local app." }, { status: 403 });
  }
  const scenario = labScenario.safeParse(url.searchParams.get("scenario"));
  if (!scenario.success) return Response.json({ message: "Choose Light, Medium, or Heavy." }, { status: 400 });
  if (running) return Response.json({ message: "A scenario is already running. Try again shortly." }, { status: 409 });

  running = true;
  try {
    const root = process.cwd();
    const { stdout } = await exec(process.execPath, [join(root, "scripts", "simulate-traffic.mjs"), scenario.data], {
      cwd: root, timeout: 20_000, maxBuffer: 64 * 1024, windowsHide: true, signal: request.signal,
    });
    return Response.json(labReport.parse(JSON.parse(stdout)), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ message: "The scenario could not finish. Try again or run the local CLI." }, { status: 500 });
  } finally {
    running = false;
  }
}
