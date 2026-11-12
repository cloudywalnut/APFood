const assert = require("node:assert/strict");
const { test } = require("node:test");
const { loadTypescript } = require("./support/load-typescript.cjs");
const { prepareStudentCartAddition, parseCartAddition } = loadTypescript("lib/backend/student-fif-cart.ts");
const { confirmFifCart } = loadTypescript("lib/confirm-fif-cart.ts");
const owner = "00000000-0000-4000-8000-000000000001";
const menu = [
  {
    id: "dumplings",
    vendor_id: "chinese",
    name: "Steamed Vegetable Dumplings",
    price_sen: 750,
    discount_sen: 0,
    stock: 10,
    active: true,
  },
];
const vendors = [{ id: "chinese", status: "approved", paused: false }];
const initial = { vendor_id: "chinese", items: [{ itemId: "noodles", quantity: 1, extra: false }], revision: 3 };
function db(cart = initial, items = menu) {
  return {
    from(table) {
      const rows = table === "vendors" ? vendors : table === "menu_items" ? items : cart;
      const query = {
        select() {
          return query;
        },
        eq() {
          return query;
        },
        in() {
          return query;
        },
        maybeSingle() {
          return query;
        },
        then(resolve, reject) {
          return Promise.resolve({ data: rows, count: Array.isArray(rows) ? rows.length : 1, error: null }).then(
            resolve,
            reject,
          );
        },
      };
      return query;
    },
    rpc() {
      throw Error("Preparing must not write");
    },
  };
}
function apiFor(cart = initial) {
  let current = structuredClone(cart);
  let writes = 0;
  return {
    get writes() {
      return writes;
    },
    cart: async () => structuredClone(current),
    catalogue: async () => ({ items: menu, vendors, zones: [] }),
    saveCart: async (input) => {
      if (input.revision !== current.revision) throw Error("CART_CHANGED");
      writes++;
      current = { vendor_id: input.vendorId, items: structuredClone(input.items), revision: input.revision + 1 };
      return structuredClone(current);
    },
  };
}
test("the reported mixed request becomes an explicit partial proposal, preserving the existing cart", async () => {
  const request = parseCartAddition("Can you add steamed vegetable dumplings and pineapple");
  assert.deepEqual(request.items, [
    { name: "steamed vegetable dumplings", quantity: 1 },
    { name: "pineapple", quantity: 1 },
  ]);
  const result = await prepareStudentCartAddition(db(), owner, request);
  assert.match(result.reply, /pineapple was not found/);
  assert.match(result.reply, /has not changed yet/);
  assert.equal(result.cartAction.added.length, 1);
  assert.equal(result.cartAction.cart.items.length, 2);
  assert.equal(result.cartAction.cart.items[0].itemId, "noodles");
});
test("confirmation persists one addition and repeat confirmation cannot increment it twice", async () => {
  const { cartAction } = await prepareStudentCartAddition(db(), owner, {
    items: [{ name: menu[0].name, quantity: 1 }],
  });
  const api = apiFor();
  await confirmFifCart(api, owner, cartAction);
  await confirmFifCart(api, owner, cartAction);
  assert.equal(api.writes, 1);
  assert.equal((await api.cart()).items.find((item) => item.itemId === "dumplings").quantity, 1);
});
test("uncertain save responses recover the original saved cart without another write", async () => {
  const { cartAction } = await prepareStudentCartAddition(db(), owner, {
    items: [{ name: menu[0].name, quantity: 1 }],
  });
  const api = apiFor();
  const save = api.saveCart;
  api.saveCart = async (input) => {
    await save(input);
    throw Error("Connection lost after save");
  };
  await confirmFifCart(api, owner, cartAction);
  assert.equal(api.writes, 1);
});
test("newer cart changes, another account, changed stock and changed prices are not overwritten", async () => {
  const { cartAction } = await prepareStudentCartAddition(db(), owner, {
    items: [{ name: menu[0].name, quantity: 1 }],
  });
  const stale = apiFor({ ...initial, revision: 4 });
  await assert.rejects(confirmFifCart(stale, owner, cartAction), /cart changed/);
  const other = apiFor();
  await assert.rejects(confirmFifCart(other, "00000000-0000-4000-8000-000000000002", cartAction), /another account/);
  for (const changed of [{ stock: 0 }, { price_sen: 800 }]) {
    const api = apiFor();
    api.catalogue = async () => ({ items: [{ ...menu[0], ...changed }], vendors, zones: [] });
    await assert.rejects(confirmFifCart(api, owner, cartAction));
    assert.equal(api.writes, 0);
  }
});
test("missing, ambiguous and sold-out items cannot become successful additions", async () => {
  for (const items of [[], [{ ...menu[0], stock: 0 }], [menu[0], { ...menu[0], id: "other-dumplings" }]]) {
    const result = await prepareStudentCartAddition(db(initial, items), owner, {
      items: [{ name: menu[0].name, quantity: 1 }],
    });
    assert.equal(result.cartAction, undefined);
    assert.match(result.reply, /Nothing has been added/);
  }
});

test("combined option quantities and expired proposals cannot cause an unchecked addition", async () => {
  const cart = { vendor_id: "chinese", revision: 0, items: [{ itemId: "dumplings", quantity: 9, extra: true }] };
  assert.equal(
    (await prepareStudentCartAddition(db(cart), owner, { items: [{ name: menu[0].name, quantity: 2 }] })).cartAction,
    undefined,
  );
  const { cartAction } = await prepareStudentCartAddition(db(), owner, {
    items: [{ name: menu[0].name, quantity: 1 }],
  });
  const api = apiFor();
  await assert.rejects(confirmFifCart(api, owner, { ...cartAction, expiresAt: "2020-01-01T00:00:00.000Z" }), /expired/);
  assert.equal(api.writes, 0);
});

test("the handler cannot echo a model's unsupported claim that it added something", async () => {
  const { studentFifChat } = loadTypescript("lib/backend/student-fif-chat.ts", {
    "./auth": { privilegedClient: () => ({ rpc: async () => ({ data: true, error: null }) }) },
    "./fif-chat-runtime": {
      runFifChat: async () => ({ reply: "I have added the dumplings to your cart.", ok: true, failures: [] }),
    },
    "./student-fif-answers": { studentShortcut: async () => undefined },
  });
  const result = await studentFifChat({}, owner, { messages: [{ role: "user", text: "yes please" }] });
  assert.match(result.reply, /haven't changed your cart/);
  assert.equal(result.cartAction, undefined);
});
