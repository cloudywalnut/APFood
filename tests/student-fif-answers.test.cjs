const assert = require("node:assert/strict");
const { test } = require("node:test");
const { loadTypescript } = require("./support/load-typescript.cjs");
const { studentShortcut, renderStudentToolAnswer } = loadTypescript("lib/backend/student-fif-answers.ts");

test("menu search does not classify every dish as noodles or silently drop query constraints", async () => {
  const { studentTools } = loadTypescript("lib/backend/student-fif-chat.ts", {
    "./auth": { privilegedClient: () => ({}) },
  });
  const vendor = { id: "chinese", name: "Chinese", category: "Noodles & rice", paused: false };
  const items = [
    {
      id: "noodles",
      vendor_id: "chinese",
      name: "Chicken noodle bowl",
      description: "Chicken broth",
      price_sen: 1000,
      discount_sen: 100,
      stock: 10,
    },
    {
      id: "dumplings",
      vendor_id: "chinese",
      name: "Vegetarian dumplings",
      description: "Steamed vegetables",
      price_sen: 800,
      discount_sen: 0,
      stock: 10,
    },
  ];
  const client = {
    from(table) {
      const query = {
        select() {
          return query;
        },
        eq() {
          return query;
        },
        order() {
          return query;
        },
        in() {
          return query;
        },
        then(resolve, reject) {
          return Promise.resolve({ data: table === "vendors" ? [vendor] : items, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const tool = studentTools(client, "owner").find((tool) => tool.name === "search_menu");
  const result = await tool.run({ stall: "Chinese", query: "noodle" });
  assert.deepEqual(
    result.items.map((item) => item.name),
    ["Chicken noodle bowl"],
  );
  assert.equal((await tool.run({ query: "vegetarian noodle" })).items.length, 0);
});

test("greetings do not depend on a provider or database lookup", async () => {
  const answer = await studentShortcut([{ role: "user", text: "hiii!" }], []);
  assert.match(answer, /^Hi!/);
});

test("deals shortcut uses the authorized menu tool and preserves price and availability", async () => {
  const calls = [];
  const answer = await studentShortcut(
    [{ role: "user", text: "Meal deals today" }],
    [
      {
        name: "search_menu",
        run: async (args) => {
          calls.push(args);
          return {
            items: [
              {
                name: "Noodles",
                stall: "Chinese",
                price: "RM 9.00",
                was: "RM 11.00",
                availability: "in stock",
                stall_paused: false,
                page: "/app/vendors/chinese/item/noodles",
              },
            ],
          };
        },
      },
    ],
  );
  assert.deepEqual(calls, [{ deals_only: true }]);
  assert.match(answer, /RM 9.00 \(was RM 11.00\); in stock/);
  assert.equal(await studentShortcut([{ role: "user", text: "Meal deals today under RM 5" }], []), undefined);
});

test("lookup failures and malformed tool data cannot become fabricated answers", async () => {
  assert.equal(renderStudentToolAnswer("get_my_orders", { error: "unavailable" }), undefined);
  assert.equal(renderStudentToolAnswer("get_order_details", { stall: "Chinese", status: "Ready" }), undefined);
  const answer = await studentShortcut(
    [{ role: "user", text: "Where is my order?" }],
    [
      {
        name: "get_my_orders",
        run: async () => {
          throw Error("Database unavailable");
        },
      },
    ],
  );
  assert.equal(answer, undefined);
});

test("order summaries preserve the actual status instead of assuming an order is ready", () => {
  const answer = renderStudentToolAnswer("get_my_orders", {
    orders: [
      {
        stall: "Chinese",
        status: "Collected",
        pickup_window: "12:15-12:30 pm",
        total: "RM 9.00",
        page: "/app/orders/abc",
      },
    ],
  });
  assert.match(answer, /Collected/);
  assert.doesNotMatch(answer, /Ready/);
  assert.match(renderStudentToolAnswer("get_my_orders", { orders: [] }), /No orders matched/);
});

test("simple budget questions retain stall and strict less-than price constraints", async () => {
  const calls = [];
  const tools = [
    {
      name: "search_menu",
      run: async (args) => {
        calls.push(args);
        return { items: [] };
      },
    },
  ];
  await studentShortcut([{ role: "user", text: "Which Chinese meals cost less than RM 10?" }], tools);
  assert.deepEqual(calls, [{ stall: "chinese", max_price_rm: 9.99 }]);
  assert.equal(
    await studentShortcut([{ role: "user", text: "Which vegetarian Chinese meals cost less than RM 10?" }], tools),
    undefined,
  );
  assert.equal(calls.length, 1, "Unrecognized constraints must continue to the model");
});
