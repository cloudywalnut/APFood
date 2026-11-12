import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCopilotSystemPrompt,
  buildFallbackCopilotReply,
  runVendorCopilotModel,
  validateProposedAction,
} from "../lib/backend/vendor-copilot-core.ts";

const sampleContext = {
  stall: {
    id: "spice-kitchen",
    name: "Spice Kitchen",
    zoneId: "zone-a",
    zoneName: "Atrium Zone A",
    category: "Malaysian",
    description: "Warm rice bowls and iced drinks",
    status: "approved",
    paused: false,
    capacity: 24,
    leadMinutes: 10,
    opensAt: "08:00",
    closesAt: "18:00",
  },
  menu: [
    {
      id: "nasi-lemak",
      vendor_id: "spice-kitchen",
      name: "Nasi Lemak",
      description: "Coconut rice with sambal and egg",
      price_sen: 850,
      discount_sen: 0,
      stock: 4,
      active: true,
      work_units: 2,
      unitsSold14d: 42,
      fulfilledValueSen14d: 35700,
    },
    {
      id: "iced-teh-tarik",
      vendor_id: "spice-kitchen",
      name: "Iced Teh Tarik",
      description: "Chilled pulled milk tea",
      price_sen: 350,
      discount_sen: 50,
      stock: 18,
      active: true,
      work_units: 1,
      unitsSold14d: 29,
      fulfilledValueSen14d: 8700,
    },
  ],
  analytics: {
    daysCovered: 14,
    totalOrders: 55,
    activeOrders: 3,
    lateOrders: 1,
    netRevenueSen: 44400,
    orderedValueSen: 46000,
    outstandingCounterSen: 1500,
    peakHours: [{ hour: "12:00", count: 22 }, { hour: "13:00", count: 16 }],
    peakDays: [{ day: "2026-11-11", weekday: "Wed", count: 14 }],
    statuses: [{ status: "collected", count: 50 }, { status: "ready", count: 3 }],
  },
  campusContext: {
    nowMalaysia: "12 Nov 2026, 4:00 pm",
    currentMonth: "November",
    timezone: "Asia/Kuala_Lumpur",
    currency: "MYR",
    notes: "APU campus cafeteria",
  },
};

const geminiReply = value => async () =>
  Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] });

test("validateProposedAction enforces stall ownership, bounds, and non-noop changes", () => {
  const validItem = validateProposedAction(
    { type: "update_menu_item", summary: "Restock Nasi Lemak", itemId: "nasi-lemak", stock: 25 },
    sampleContext,
  );
  assert.equal(validItem?.type, "update_menu_item");
  assert.equal(validItem?.expectedStock, 4);
  assert.deepEqual(validItem?.changes, { stock: 25 });

  // Unowned or unknown itemId is rejected
  assert.equal(
    validateProposedAction({ type: "update_menu_item", summary: "Hack", itemId: "other-stall-item", stock: 10 }, sampleContext),
    null,
  );

  // Out-of-bounds stock, price, discount, or net price < 50 sen are rejected
  assert.equal(
    validateProposedAction({ type: "update_menu_item", summary: "Bad stock", itemId: "nasi-lemak", stock: -1 }, sampleContext),
    null,
  );
  assert.equal(
    validateProposedAction({ type: "update_menu_item", summary: "Huge stock", itemId: "nasi-lemak", stock: 5001 }, sampleContext),
    null,
  );
  assert.equal(
    validateProposedAction({ type: "update_menu_item", summary: "Free item", itemId: "nasi-lemak", priceSen: 20 }, sampleContext),
    null,
  );
  assert.equal(
    validateProposedAction({ type: "update_menu_item", summary: "Over-discount", itemId: "nasi-lemak", discountSen: 810 }, sampleContext),
    null,
  );

  // No-op change is rejected
  assert.equal(
    validateProposedAction({ type: "update_menu_item", summary: "Same stock", itemId: "nasi-lemak", stock: 4 }, sampleContext),
    null,
  );

  // Lowering priceSen below existing discount_sen + 50 without also lowering discountSen is rejected
  assert.equal(
    validateProposedAction({ type: "update_menu_item", summary: "Too cheap for discount", itemId: "iced-teh-tarik", priceSen: 80 }, sampleContext),
    null,
  );
  assert.equal(
    validateProposedAction({ type: "update_menu_item", summary: "Free after discount", itemId: "iced-teh-tarik", priceSen: 50 }, sampleContext),
    null,
  );

  // Stall settings bounds
  const validStall = validateProposedAction(
    { type: "update_stall_settings", summary: "Pause intake", paused: true, capacity: 30 },
    sampleContext,
  );
  assert.equal(validStall?.type, "update_stall_settings");
  assert.deepEqual(validStall?.changes, { paused: true, capacity: 30 });

  assert.equal(
    validateProposedAction({ type: "update_stall_settings", summary: "Bad cap", capacity: 301 }, sampleContext),
    null,
  );
});

test("runVendorCopilotModel validates Gemini output and strips ungrounded proposed actions", async () => {
  const prompt = buildCopilotSystemPrompt(sampleContext);
  assert.ok(prompt.includes("STRICT GUARDRAILS"));
  assert.ok(prompt.includes("Spice Kitchen"));

  const ok = await runVendorCopilotModel(
    { message: "Restock Nasi Lemak to 30", context: sampleContext },
    {
      key: "test-key",
      fetcher: geminiReply({
        reply: "Ready to restock Nasi Lemak from 4 to 30 portions. Confirm below to apply.",
        proposedAction: {
          type: "update_menu_item",
          summary: "Restock Nasi Lemak to 30",
          itemId: "nasi-lemak",
          stock: 30,
        },
      }),
    },
  );
  assert.equal(ok.source, "gemini");
  assert.equal(ok.proposedAction?.type, "update_menu_item");
  assert.equal(ok.proposedAction?.changes.stock, 30);

  // Hallucinated itemId from Gemini is stripped cleanly
  const stripped = await runVendorCopilotModel(
    { message: "Update other item", context: sampleContext },
    {
      key: "test-key",
      fetcher: geminiReply({
        reply: "I tried to update another item.",
        proposedAction: {
          type: "update_menu_item",
          summary: "Update unknown item",
          itemId: "foreign-item",
          stock: 10,
        },
      }),
    },
  );
  assert.equal(stripped.source, "gemini");
  assert.equal(stripped.proposedAction, null);
});

test("runVendorCopilotModel falls back deterministically on missing key, 429, timeout, or bad JSON", async () => {
  const july = await runVendorCopilotModel({
    message: "Which item in my inventory would sell the most in July?",
    context: sampleContext,
  });
  assert.equal(july.source, "rules");
  assert.ok(july.reply.includes("Nasi Lemak"));
  assert.equal(july.proposedAction, null);

  for (const fetcher of [
    async () => new Response("rate limited", { status: 429 }),
    async () => { throw new DOMException("Timeout", "TimeoutError"); },
    async () => Response.json({}),
    geminiReply({ invalid: true }),
  ]) {
    const res = await runVendorCopilotModel(
      { message: "Set stock of Nasi Lemak to 20", context: sampleContext },
      { key: "test-key", fetcher },
    );
    assert.equal(res.source, "rules");
    assert.equal(res.proposedAction?.type, "update_menu_item");
    assert.equal(res.proposedAction?.changes.stock, 20);
  }
});

test("buildFallbackCopilotReply handles discount, price-only RM, and reopen phrasing", () => {
  const discount = buildFallbackCopilotReply("Discount Nasi Lemak to RM 1.50", sampleContext);
  assert.equal(discount.proposedAction?.type, "update_menu_item");
  assert.deepEqual(discount.proposedAction?.changes, { discountSen: 150 });

  const price = buildFallbackCopilotReply("Set Nasi Lemak to RM 9.50", sampleContext);
  assert.equal(price.proposedAction?.type, "update_menu_item");
  assert.deepEqual(price.proposedAction?.changes, { priceSen: 950 });

  const pausedContext = { ...sampleContext, stall: { ...sampleContext.stall, paused: true } };
  const reopen = buildFallbackCopilotReply("Reopen my stall", pausedContext);
  assert.equal(reopen.proposedAction?.type, "update_stall_settings");
  assert.deepEqual(reopen.proposedAction?.changes, { paused: false });
});
