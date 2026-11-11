import assert from "node:assert/strict";
import test from "node:test";
import { rankActions } from "../lib/backend/fif-ranking.ts";

const actions = ["a", "b"].map(id => ({ id, title: id, evidence: "server fact", href: "/app", action: "View", priority: 10, signals: { loadPercent: 20 } }));
const reply = value => async () => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] });

test("FIF only accepts eligible actions with matching evidence and keeps server facts", async () => {
  const ranked = await rankActions(actions, { key: "test", fetcher: reply({ actionId: "b", evidenceId: "b" }) });
  assert.equal(ranked.source, "gemini");
  assert.deepEqual(ranked.recommendation, actions[1]);
  for (const value of [{ actionId: "unknown", evidenceId: "unknown" }, { actionId: "b", evidenceId: "a" }, { actionId: "b", evidenceId: "b", title: "invented fact" }]) {
    assert.equal((await rankActions(actions, { key: "test", fetcher: reply(value) })).source, "rules");
  }
  const urgent = [{ ...actions[0], priority: 100 }, actions[1]];
  assert.equal((await rankActions(urgent, { key: "test", fetcher: reply({ actionId: "b", evidenceId: "b" }) })).recommendation.id, "a");
});

test("FIF missing key, unavailable provider, malformed output and timeout preserve fallback", async () => {
  assert.equal((await rankActions(actions)).source, "rules");
  for (const fetcher of [async () => new Response("rate limited", { status: 429 }), async () => { throw new DOMException("Timeout", "TimeoutError"); }, async () => Response.json({}), reply("not an object")]) {
    assert.equal((await rankActions(actions, { key: "test", fetcher })).recommendation.id, "a");
  }
});
