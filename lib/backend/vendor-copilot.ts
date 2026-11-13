import { createHash } from "node:crypto";
import { privilegedClient } from "./auth";
import type { CopilotExecuteInput, CopilotHistoryTurn } from "./contracts";
import { BackendError, unwrap } from "./errors";
import { adminReport } from "./reports";
import { fetchCampusWeather } from "./campus-weather";
import type { RequestClient } from "./supabase";
import {
  runVendorCopilotModel,
  validateProposedAction,
  type CopilotStallItem,
  type VendorCopilotContext,
} from "./vendor-copilot-core";

function weekdayOf(dayIso: string) {
  const date = new Date(dayIso + "T12:00:00+08:00");
  return Number.isNaN(date.getTime())
    ? dayIso
    : date.toLocaleDateString("en-MY", { weekday: "short", timeZone: "Asia/Kuala_Lumpur" });
}

export async function gatherVendorCopilotContext(
  client: RequestClient,
  vendorId: string,
): Promise<VendorCopilotContext> {
  const stall = unwrap(
    await client
      .from("vendors")
      .select("id,zone_id,name,description,category,status,paused,capacity,lead_minutes,opens_at,closes_at")
      .eq("id", vendorId)
      .maybeSingle(),
  );
  if (!stall) throw new BackendError(404, "STALL_UNAVAILABLE", "Stall unavailable.");

  const [zone, menuRows, activeOrders, campusWeather] = await Promise.all([
    client
      .from("zones")
      .select("id,name")
      .eq("id", stall.zone_id)
      .maybeSingle()
      .then((r) => unwrap(r)),
    client
      .from("menu_items")
      .select("id,vendor_id,name,description,price_sen,discount_sen,stock,active,work_units")
      .eq("vendor_id", vendorId)
      .order("name")
      .then((r) => unwrap(r) ?? []),
    client
      .from("orders")
      .select("id,status,pickup_at,lines")
      .eq("vendor_id", vendorId)
      .in("status", ["placed", "accepted", "preparing", "ready"])
      .order("pickup_at", { ascending: true })
      .limit(200)
      .then((r) => unwrap(r) ?? []),
    fetchCampusWeather(),
  ]);

  let daysCovered = 14;
  let report: Awaited<ReturnType<typeof adminReport>> | null = null;
  for (const candidateDays of ["14", "7", "1"] as const) {
    try {
      report = await adminReport(client, new URLSearchParams({ vendorId, days: candidateDays }));
      daysCovered = Number(candidateDays);
      break;
    } catch (error) {
      if (error instanceof BackendError && error.code === "REPORT_RANGE_TOO_LARGE" && candidateDays !== "1") continue;
      throw error;
    }
  }

  const productMap = new Map((report?.products ?? []).map((p) => [p.id, p]));
  const menu: CopilotStallItem[] = menuRows.map((item) => {
    const perf = productMap.get(item.id);
    return {
      ...item,
      unitsSold14d: perf?.units ?? 0,
      fulfilledValueSen14d: perf?.fulfilledValueSen ?? 0,
    };
  });

  const vendorStats = report?.vendors.find((v) => v.id === vendorId);
  const daily = report?.analytics?.daily ?? [];
  const hours = report?.analytics?.hours ?? [];
  const peakHours = [...hours]
    .filter((h) => h.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((h) => ({ hour: `${String(h.hour).padStart(2, "0")}:00`, count: h.count }));
  const peakDays = [...daily]
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((d) => ({ day: d.day, weekday: weekdayOf(d.day), count: d.count }));

  const now = new Date();
  const nowMs = now.getTime();
  const in60MinMs = nowMs + 60 * 60_000;
  const nowMalaysia = now.toLocaleString("en-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    dateStyle: "medium",
    timeStyle: "short",
  });
  const currentMonth = now.toLocaleDateString("en-MY", { month: "long", timeZone: "Asia/Kuala_Lumpur" });

  let placed = 0;
  let accepted = 0;
  let preparing = 0;
  let ready = 0;
  let overduePickups = 0;
  let next60MinPickups = 0;
  const queuedItemCounts = new Map<string, { itemId: string; name: string; quantity: number }>();

  for (const order of activeOrders) {
    if (order.status === "placed") placed += 1;
    else if (order.status === "accepted") accepted += 1;
    else if (order.status === "preparing") preparing += 1;
    else if (order.status === "ready") ready += 1;

    const pickupMs = Date.parse(order.pickup_at);
    if (Number.isFinite(pickupMs)) {
      if (pickupMs < nowMs) overduePickups += 1;
      else if (pickupMs <= in60MinMs) next60MinPickups += 1;
    }

    const lines = Array.isArray(order.lines) ? order.lines : [];
    for (const line of lines as Array<{ itemId?: string; name?: string; quantity?: number }>) {
      if (!line || typeof line.itemId !== "string" || typeof line.quantity !== "number") continue;
      const existing = queuedItemCounts.get(line.itemId);
      if (existing) existing.quantity += line.quantity;
      else
        queuedItemCounts.set(line.itemId, {
          itemId: line.itemId,
          name: line.name ?? line.itemId,
          quantity: line.quantity,
        });
    }
  }

  const topQueuedItems = [...queuedItemCounts.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5);

  return {
    stall: {
      id: stall.id,
      name: stall.name,
      zoneId: stall.zone_id,
      zoneName: zone?.name ?? stall.zone_id,
      category: stall.category,
      description: stall.description,
      status: stall.status,
      paused: stall.paused,
      capacity: stall.capacity,
      leadMinutes: stall.lead_minutes,
      opensAt: stall.opens_at,
      closesAt: stall.closes_at,
    },
    menu,
    analytics: {
      daysCovered,
      totalOrders: vendorStats?.orderCount ?? 0,
      activeOrders: vendorStats?.activeCount ?? 0,
      lateOrders: vendorStats?.lateCount ?? 0,
      netRevenueSen: report?.finance.netSen ?? 0,
      orderedValueSen: report?.finance.orderedValueSen ?? 0,
      outstandingCounterSen: report?.finance.outstandingCounterSen ?? 0,
      peakHours,
      peakDays,
      statuses: report?.analytics?.statuses ?? [],
    },
    kitchenQueue: {
      totalActive: activeOrders.length,
      placed,
      accepted,
      preparing,
      ready,
      overduePickups,
      next60MinPickups,
      topQueuedItems,
    },
    campusContext: {
      nowMalaysia,
      currentMonth,
      timezone: "Asia/Kuala_Lumpur",
      currency: "MYR",
      weather: campusWeather.weather,
      weatherLabel: campusWeather.weatherLabel,
      temperatureC: campusWeather.temperatureC,
      notes:
        "Asia Pacific University (APU) Malaysia campus cafeteria. Lunch rush typically peaks 12:00-14:00 on weekdays. Weather unavailable labels are assumptions, not live observations.",
    },
  };
}

export async function vendorCopilot(
  client: RequestClient,
  userId: string,
  input: { vendorId: string; message: string; history?: CopilotHistoryTurn[] },
) {
  const context = await gatherVendorCopilotContext(client, input.vendorId);
  const key = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_FALLBACK;
  let allowed = Boolean(key);
  if (key && process.env.SUPABASE_SECRET_KEY) {
    try {
      const hash = createHash("sha256")
        .update("fif-copilot:" + userId)
        .digest("hex");
      const limit = await privilegedClient().rpc("consume_auth_request", { p_key: hash, p_limit: 30, p_seconds: 3600 });
      allowed = !limit.error && limit.data === true;
    } catch {
      allowed = false;
    }
  }
  const output = await runVendorCopilotModel(
    { message: input.message, history: input.history, context },
    { key: allowed ? key : undefined, model: process.env.GEMINI_MODEL },
  );
  return {
    ...output,
    generatedAt: new Date().toISOString(),
  };
}

export async function executeVendorCopilotAction(client: RequestClient, input: CopilotExecuteInput) {
  const context = await gatherVendorCopilotContext(client, input.vendorId);
  const action = input.action;

  if (action.type === "update_menu_item") {
    const item = context.menu.find((entry) => entry.id === action.itemId);
    if (!item) throw new BackendError(404, "ITEM_UNAVAILABLE", "Menu item not found for this stall.");
    if (item.stock !== action.expectedStock) {
      throw new BackendError(
        409,
        "STOCK_CHANGED",
        "Item stock changed since this action was proposed. Ask FIF AI again.",
      );
    }
    if (
      item.stock !== action.before.stock ||
      item.price_sen !== action.before.priceSen ||
      item.discount_sen !== action.before.discountSen ||
      item.active !== action.before.active
    ) {
      throw new BackendError(409, "ACTION_CHANGED", "The item changed. Ask FIF AI for a new proposal.");
    }

    const validated = validateProposedAction(
      {
        type: "update_menu_item",
        summary: action.summary,
        itemId: item.id,
        stock: action.changes.stock ?? null,
        priceSen: action.changes.priceSen ?? null,
        discountSen: action.changes.discountSen ?? null,
        active: action.changes.active ?? null,
      },
      context,
    );
    if (!validated || validated.type !== "update_menu_item") {
      throw new BackendError(
        400,
        "INVALID_ACTION",
        "This proposed menu update is outside allowed guardrails or no longer changes anything.",
      );
    }

    unwrap(
      await client.rpc("apply_vendor_copilot_action", {
        p_vendor: input.vendorId,
        p_action: { ...validated, before: action.before, expectedStock: action.expectedStock },
      }),
    );

    return { ok: true as const, appliedSummary: validated.summary };
  }

  if (
    context.stall.paused !== action.before.paused ||
    context.stall.capacity !== action.before.capacity ||
    context.stall.leadMinutes !== action.before.leadMinutes
  ) {
    throw new BackendError(409, "ACTION_CHANGED", "The stall changed. Ask FIF AI for a new proposal.");
  }

  const validated = validateProposedAction(
    {
      type: "update_stall_settings",
      summary: action.summary,
      paused: action.changes.paused ?? null,
      capacity: action.changes.capacity ?? null,
      leadMinutes: action.changes.leadMinutes ?? null,
    },
    context,
  );
  if (!validated || validated.type !== "update_stall_settings") {
    throw new BackendError(
      400,
      "INVALID_ACTION",
      "This stall setting update is outside allowed guardrails or no longer changes anything.",
    );
  }

  unwrap(
    await client.rpc("apply_vendor_copilot_action", {
      p_vendor: input.vendorId,
      p_action: { ...validated, before: action.before },
    }),
  );

  return { ok: true as const, appliedSummary: validated.summary };
}
