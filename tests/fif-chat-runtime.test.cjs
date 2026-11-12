const assert = require("node:assert/strict");
const { test } = require("node:test");
const { loadTypescript } = require("./support/load-typescript.cjs");
const { runFifChat } = loadTypescript("lib/backend/fif-chat-runtime.ts");

const base = {
  system: "test",
  messages: [{ role: "user", text: "Show my orders" }],
  tools: [],
  gemini: { key: "test-gemini", model: "test-gemini-model" },
  openai: { key: "test-openai", model: "gpt-6-luna" },
};
const success = { reply: "A grounded answer", ok: true, toolsUsed: [] };
const failure = { reply: "Unavailable", ok: false, toolsUsed: [], failure: "HTTP 401 invalid_api_key at step 0" };

test("explicit Gemini mode ignores an invalid OpenAI configuration", async () => {
  const calls = [];
  const result = await runFifChat(
    { ...base, mode: "gemini" },
    {
      gemini: async (input) => {
        calls.push(input);
        return success;
      },
      openai: async () => {
        throw Error("OpenAI should be disabled");
      },
    },
  );
  assert.equal(result.provider, "gemini");
  assert.equal(result.ok, true);
  assert.equal(calls[0].model, base.gemini.model);
});

test("auto mode recovers through the second provider with the same scoped tools", async () => {
  const tools = [{ name: "owner_lookup" }];
  const calls = [];
  const result = await runFifChat(
    { ...base, tools, mode: "auto" },
    {
      gemini: async (input) => {
        calls.push(input);
        return failure;
      },
      openai: async (input) => {
        calls.push(input);
        return success;
      },
    },
  );
  assert.equal(result.provider, "openai");
  assert.equal(result.failures.length, 1);
  assert.equal(calls[0].tools, tools);
  assert.equal(calls[1].tools, tools);
  assert.equal(calls[1].model, "gpt-6-luna");
  assert.ok(calls[0].deadlineMs <= 10000);
  assert.ok(calls[1].deadlineMs <= 20000);
});

test("an outage still answers greetings and offers useful navigation without invented order facts", async () => {
  const runners = { gemini: async () => failure, openai: async () => failure };
  const hello = await runFifChat({ ...base, messages: [{ role: "user", text: "hiii" }] }, runners);
  assert.equal(hello.ok, true);
  assert.equal(hello.provider, "local");
  assert.match(hello.reply, /^Hi!/);
  const orders = await runFifChat(base, runners);
  assert.equal(orders.ok, false);
  assert.match(orders.reply, /Your orders/);
  assert.doesNotMatch(orders.reply, /is ready|was collected/);
});

test("a successful owned lookup survives a model follow-up timeout", async () => {
  let openaiCalls = 0;
  const result = await runFifChat(
    {
      ...base,
      tools: [{ name: "get_my_orders", run: async () => ({ orders: [{ status: "collected" }] }) }],
      renderToolResult: (name, output) =>
        name === "get_my_orders" && output.orders[0].status === "collected" ? "Your order was collected." : undefined,
    },
    {
      gemini: async (input) => {
        await input.tools[0].run({});
        return { ...failure, failure: "request TimeoutError at step 1" };
      },
      openai: async () => {
        openaiCalls++;
        return success;
      },
    },
  );
  assert.equal(result.ok, true);
  assert.equal(result.provider, "local");
  assert.equal(result.reply, "Your order was collected.");
  assert.equal(openaiCalls, 0);
});
