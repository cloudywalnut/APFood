import assert from "node:assert/strict";
import test from "node:test";
import { fallbackReply, runAgent, runOpenAIAgent } from "../lib/backend/fif-agent.ts";

const reply = (parts) => Response.json({ candidates: [{ content: { role: "model", parts } }] });

test("Gemini retries one initial temporary service failure, but never retries invalid credentials", async () => {
  let calls = 0;
  const result = await runAgent({
    system: "test",
    messages: [],
    tools: [],
    key: "test",
    fetcher: async () => {
      calls++;
      return calls === 1
        ? Response.json({ error: { status: "UNAVAILABLE" } }, { status: 503 })
        : reply([{ text: "Hello" }]);
    },
  });
  assert.equal(result.ok, true);
  assert.equal(calls, 2);
  calls = 0;
  await runAgent({
    system: "test",
    messages: [],
    tools: [],
    key: "test",
    fetcher: async () => {
      calls++;
      return new Response(null, { status: 401 });
    },
  });
  assert.equal(calls, 1);
});

test("Gemini receives a response for every tool call while only four lookups execute", async () => {
  let executions = 0;
  const { fetcher, requests } = scripted([
    Array.from({ length: 5 }, (_, i) => ({ functionCall: { id: "c" + i, name: "lookup", args: {} } })),
    [{ text: "The lookup completed." }],
  ]);
  const result = await runAgent({
    system: "test",
    messages: [{ role: "user", text: "Check" }],
    key: "test",
    fetcher,
    tools: [
      {
        name: "lookup",
        description: "test",
        parameters: { type: "OBJECT", properties: {} },
        run: async () => {
          executions++;
          return {};
        },
      },
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(executions, 4);
  assert.equal(requests[1].contents.at(-1).parts.length, 5);
});

test("provider failures preserve safe diagnostic codes without logging response messages", async () => {
  const result = await runOpenAIAgent({
    system: "test",
    messages: [],
    tools: [],
    key: "test",
    fetcher: async () =>
      Response.json(
        { error: { code: "invalid_api_key", message: "secret-value-must-not-be-logged" } },
        { status: 401 },
      ),
  });
  assert.match(result.failure, /HTTP 401 invalid_api_key/);
  assert.doesNotMatch(result.failure, /secret-value/);
});

test("a stalled read-only tool cannot overrun the agent deadline", async () => {
  const fetcher = async () => reply([{ functionCall: { name: "stall", args: {} } }]);
  const result = await runAgent({
    system: "test",
    messages: [{ role: "user", text: "hello" }],
    key: "test",
    fetcher,
    deadlineMs: 1100,
    tools: [
      {
        name: "stall",
        description: "test",
        parameters: { type: "OBJECT", properties: {} },
        run: () => new Promise(() => {}),
      },
    ],
  });
  assert.equal(result.ok, false);
  assert.equal(result.reply, fallbackReply);
  assert.deepEqual(result.toolsUsed, ["stall"]);
});

function scripted(turns) {
  const requests = [];
  const fetcher = async (_url, init) => {
    requests.push(JSON.parse(init.body));
    const next = turns.shift();
    return typeof next === "function" ? next() : reply(next);
  };
  return { fetcher, requests };
}

const orderTool = (calls) => ({
  name: "get_my_orders",
  description: "orders",
  parameters: { type: "OBJECT", properties: {} },
  run: async (args) => {
    calls.push(args);
    return { orders: [{ ref: "abcd1234", status: "Ready for pickup" }] };
  },
});

test("Student FIF chat calls a tool, returns its result to the model and replies with text", async () => {
  const calls = [];
  const { fetcher, requests } = scripted([
    [{ functionCall: { id: "c1", name: "get_my_orders", args: { filter: "active" } }, thoughtSignature: "sig" }],
    [{ text: "Your order abcd1234 is ready for pickup." }],
  ]);
  const result = await runAgent({
    system: "test",
    messages: [{ role: "user", text: "Where is my order?" }],
    tools: [orderTool(calls)],
    key: "test",
    fetcher,
  });
  assert.equal(result.ok, true);
  assert.equal(result.reply, "Your order abcd1234 is ready for pickup.");
  assert.deepEqual(calls, [{ filter: "active" }]);
  assert.deepEqual(result.toolsUsed, ["get_my_orders"]);
  const second = requests[1].contents;
  assert.equal(second[1].role, "model");
  assert.equal(second[1].parts[0].thoughtSignature, "sig", "model turn is echoed unchanged");
  assert.deepEqual(second[2].parts[0].functionResponse, {
    id: "c1",
    name: "get_my_orders",
    response: { result: { orders: [{ ref: "abcd1234", status: "Ready for pickup" }] } },
  });
});

test("Student FIF chat maps history roles and declares tools without server code", async () => {
  const { fetcher, requests } = scripted([[{ text: "Hi" }]]);
  await runAgent({
    system: "test",
    messages: [
      { role: "user", text: "a" },
      { role: "assistant", text: "b" },
      { role: "user", text: "c" },
    ],
    tools: [orderTool([])],
    key: "test",
    fetcher,
  });
  assert.deepEqual(
    requests[0].contents.map((content) => content.role),
    ["user", "model", "user"],
  );
  assert.deepEqual(Object.keys(requests[0].tools[0].functionDeclarations[0]).sort(), [
    "description",
    "name",
    "parameters",
  ]);
});

test("Student FIF chat rejects unknown tools, contains tool failures and stops after the step limit", async () => {
  const { fetcher, requests } = scripted([
    [{ functionCall: { name: "drop_tables", args: {} } }],
    [{ functionCall: { name: "broken", args: {} } }],
    [{ text: "Sorry, I can’t see that." }],
  ]);
  const result = await runAgent({
    system: "test",
    messages: [{ role: "user", text: "x" }],
    tools: [
      {
        name: "broken",
        description: "fails",
        parameters: { type: "OBJECT", properties: {} },
        run: async () => {
          throw new Error("database down with secret details");
        },
      },
    ],
    key: "test",
    fetcher,
    maxSteps: 3,
  });
  assert.equal(result.reply, "Sorry, I can’t see that.");
  assert.deepEqual(requests[1].contents.at(-1).parts[0].functionResponse.response, {
    result: { error: "Unknown tool." },
  });
  assert.equal(
    JSON.stringify(requests[2].contents).includes("secret details"),
    false,
    "internal errors never reach the model",
  );
  assert.equal(requests[2].toolConfig.functionCallingConfig.mode, "NONE", "last step forces an answer");
});

test("Student FIF chat falls back on provider errors, timeouts, malformed and empty output", async () => {
  for (const turn of [
    () => new Response("rate limited", { status: 429 }),
    () => {
      throw new DOMException("Timeout", "TimeoutError");
    },
    () => Response.json({}),
    [{ text: "   " }],
  ]) {
    const { fetcher } = scripted([turn]);
    const result = await runAgent({
      system: "test",
      messages: [{ role: "user", text: "x" }],
      tools: [],
      key: "test",
      fetcher,
    });
    assert.equal(result.ok, false);
    assert.equal(result.reply, fallbackReply);
  }
});

test("Student FIF chat on OpenAI runs tools, converts schemas and answers every tool call", async () => {
  const calls = [];
  const bodies = [];
  const turns = [
    {
      role: "assistant",
      content: null,
      tool_calls: [
        { id: "t1", type: "function", function: { name: "get_my_orders", arguments: '{"filter":"active"}' } },
      ],
    },
    { role: "assistant", content: "Your order abcd1234 is ready." },
  ];
  const fetcher = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return Response.json({ choices: [{ message: turns.shift() }] });
  };
  const tool = { ...orderTool(calls), parameters: { type: "OBJECT", properties: { filter: { type: "STRING" } } } };
  const result = await runOpenAIAgent({
    system: "test",
    messages: [{ role: "user", text: "Where is my order?" }],
    tools: [tool],
    key: "test",
    fetcher,
  });
  assert.equal(result.ok, true);
  assert.equal(result.reply, "Your order abcd1234 is ready.");
  assert.deepEqual(calls, [{ filter: "active" }]);
  assert.deepEqual(bodies[0].tools[0].function.parameters, {
    type: "object",
    properties: { filter: { type: "string" } },
  });
  assert.equal(bodies[0].reasoning_effort, "none");
  assert.deepEqual(bodies[1].messages.at(-1), {
    role: "tool",
    tool_call_id: "t1",
    content: JSON.stringify({ result: { orders: [{ ref: "abcd1234", status: "Ready for pickup" }] } }),
  });
});

test("Student FIF chat turns app paths into buttons and keeps the text readable", async () => {
  const { extractStudentLinks: extractLinks } = await import("../lib/backend/student-fif-links.ts");
  const id = "c79df5ff-d5e1-4426-8880-8aba9c0dc917";
  assert.deepEqual(extractLinks("You can cancel it from its order page: [Open order](/app/orders/" + id + ")."), {
    text: "You can cancel it from its order page.",
    links: [{ href: "/app/orders/" + id, label: "Open order" }],
  });
  assert.deepEqual(extractLinks("You can [cancel it on its order page](/app/orders/" + id + ")."), {
    text: "You can cancel it on its order page.",
    links: [{ href: "/app/orders/" + id, label: "cancel it on its order page" }],
  });
  assert.equal(
    extractLinks("- Iced Kopi: RM 5.50. [View Iced Kopi](/app/vendors/a/item/b)\n- Next").text,
    "- Iced Kopi: RM 5.50.\n- Next",
  );
  assert.equal(extractLinks("Choose your pickup time in your /app/cart.").text, "Choose your pickup time below.");
  assert.deepEqual(extractLinks("Your cart is empty. You can view it in the app at /app/cart."), {
    text: "Your cart is empty. You can view it in the app.",
    links: [{ href: "/app/cart", label: "View cart" }],
  });
  assert.deepEqual(extractLinks("Open its order page in the app: /app/orders/" + id + "."), {
    text: "Open its order page in the app.",
    links: [{ href: "/app/orders/" + id, label: "Open order c79df5ff" }],
  });
  const unsafe = extractLinks("[Click](https://evil.example) or [Admin](/admin/users) or /app/../admin");
  assert.deepEqual(unsafe.links, [], "only student app pages become buttons");
  assert.equal(unsafe.text.includes("evil.example"), true, "unknown links are left as text, not buttons");
  const many = extractLinks(["a", "b", "c", "d", "e"].map((s) => "[" + s + "](/app/vendors/" + s + ")").join(" "));
  assert.equal(many.links.length, 4);
});

test("Student FIF chat allows help-page buttons but nothing outside the student app", async () => {
  const { extractStudentLinks: extractLinks } = await import("../lib/backend/student-fif-links.ts");
  assert.deepEqual(extractLinks("Change your email in [Account settings](/account).").links, [
    { href: "/account", label: "Account settings" },
  ]);
  assert.deepEqual(extractLinks("See [Current traffic](/app/traffic) and [Privacy](/privacy).").links, [
    { href: "/app/traffic", label: "Current traffic" },
    { href: "/privacy", label: "Privacy" },
  ]);
  for (const path of ["/admin", "/vendor/orders", "/accounts", "/account/delete", "//evil.example"])
    assert.deepEqual(extractLinks("[Go](" + path + ")").links, [], path + " must not become a button");
});

test("Student FIF chat removes link lead-ins and separators without touching normal text", async () => {
  const { extractStudentLinks: extractLinks } = await import("../lib/backend/student-fif-links.ts");
  const cases = [
    ["You can check them here: [My orders](/app/orders).", "You can check them."],
    ["- Kopi: **RM 5.50** — [View Kopi](/app/vendors/c/item/d)", "- Kopi: **RM 5.50**"],
    [
      "Ask the staff at the counter: [A order](/app/orders/a1) · [B order](/app/orders/b2)",
      "Ask the staff at the counter",
    ],
    ["Deals:\n- One\n- Two\nCome check in.", "Deals:\n- One\n- Two\nCome check in."],
  ];
  for (const [input, expected] of cases) assert.equal(extractLinks(input).text, expected);
});

test("Student FIF chat history is stored per student and cleared for anyone else", async () => {
  const store = new Map();
  globalThis.sessionStorage = {
    get length() {
      return store.size;
    },
    key: (index) => [...store.keys()][index] ?? null,
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  const { chatStorageKey, clearStudentFifChats, readStoredChat } = await import("../lib/student-fif-chat-storage.ts");
  const chat = [
    { id: "1", role: "user", text: "Where is my order?" },
    { id: "2", role: "assistant", text: "Ready.", links: [{ href: "/app/orders", label: "My orders" }] },
  ];
  sessionStorage.setItem(chatStorageKey("alice"), JSON.stringify(chat));
  sessionStorage.setItem(chatStorageKey("bob"), JSON.stringify(chat));
  sessionStorage.setItem("other-app-key", "kept");
  assert.deepEqual(readStoredChat("alice"), chat);

  clearStudentFifChats("alice");
  assert.deepEqual(readStoredChat("bob"), undefined, "another student's chat is removed");
  assert.deepEqual(readStoredChat("alice"), chat, "the current student's chat is kept");
  clearStudentFifChats();
  assert.equal(readStoredChat("alice"), undefined, "sign-out removes every saved chat");
  assert.equal(sessionStorage.getItem("other-app-key"), "kept");

  sessionStorage.setItem(
    chatStorageKey("eve"),
    JSON.stringify([
      { id: "1", role: "assistant", text: "x", links: [{ href: "https://evil.example", label: "Go" }] },
      { id: "2", role: "system", text: "y" },
      { id: "3", role: "user", text: "kept" },
    ]),
  );
  assert.deepEqual(readStoredChat("eve"), [{ id: "3", role: "user", text: "kept" }], "tampered entries are dropped");
  sessionStorage.setItem(chatStorageKey("eve"), "{not json");
  assert.equal(readStoredChat("eve"), undefined);
  delete globalThis.sessionStorage;
});
