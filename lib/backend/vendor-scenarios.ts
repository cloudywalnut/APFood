import { createHash } from "node:crypto";
import { z } from "zod";
import type { RequestClient } from "./supabase";
import { readReportPages } from "./read-report-pages";
import { adminReport } from "./reports";
import { privilegedClient } from "./auth";
import { unwrap } from "./errors";
import { fetchCampusWeather } from "./campus-weather";
import { operatingRecommendations } from "./vendor-operating-signals";
import { generateVendorRecommendations } from "./vendor-recommendation-writer";
import { dayKey, money } from "../orders";
import {
  analyzeSalesPatterns,
  computeVendorBenchmark,
  scenarioInput,
  scenarioOutput,
  type PatternMenuRow,
  type PatternOrder,
  type PeerVendorStat,
  type ScenarioAction,
  type ScenarioBenchmark,
  type ScenarioProduct,
  type ScenarioResult,
} from "../fif-scenarios";

const cache = new Map<string, { expires: number; result: ScenarioResult }>();
const productName = (value: string) => value.replace(/^\[Demo [^\]]+\]\s*/, "");

async function fetchApuCampusContext() {
  const klNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" }));
  const day = klNow.getDay();
  const hour = klNow.getHours();
  const weekday = day >= 1 && day <= 5;
  const classHours = weekday && hour >= 8 && hour <= 18;
  const audience = (classHours ? "students" : "mixed") as "students" | "mixed";
  const audienceLabel = classHours
    ? "Students & campus staff (APU class hours)"
    : weekday
      ? "Evening campus crowd"
      : "Weekend campus visitors";

  return {
    location: "APU Campus - Bukit Jalil, KL",
    ...(await fetchCampusWeather()),
    audience,
    audienceLabel: audienceLabel + " (estimated from campus hours)",
  };
}

async function fetchPeerBenchmark(
  vendorId: string,
  since: string,
  asOf: string,
): Promise<ScenarioBenchmark | undefined> {
  try {
    const admin = privilegedClient();
    const [vendorsRes, ordersRes] = await Promise.all([
      admin.from("vendors").select("id").eq("status", "approved"),
      readReportPages((from, to) =>
        admin
          .from("orders")
          .select("vendor_id,status,total_sen", { count: from === 0 ? "exact" : undefined })
          .gte("created_at", since)
          .lte("created_at", asOf)
          .order("created_at")
          .order("id")
          .range(from, to),
      ),
    ]);
    if (vendorsRes.error || ordersRes.error || ordersRes.count === null || ordersRes.count !== ordersRes.data?.length)
      return undefined;
    const approvedIds = new Set((vendorsRes.data ?? []).map((v) => v.id));
    if (!approvedIds.size) return undefined;
    const map = new Map<string, PeerVendorStat>();
    for (const id of approvedIds) {
      map.set(id, { vendorId: id, revenueSen: 0, orders: 0, collectedOrders: 0, totalOrders: 0 });
    }
    for (const order of ordersRes.data ?? []) {
      const stat = map.get(order.vendor_id);
      if (!stat) continue;
      stat.totalOrders += 1;
      if (!["cancelled", "rejected"].includes(order.status)) stat.orders += 1;
      if (order.status === "collected") {
        stat.collectedOrders += 1;
        stat.revenueSen += order.total_sen;
      }
    }
    const activeStats = [...map.values()].filter((s) => s.totalOrders > 0 || s.vendorId === vendorId);
    return computeVendorBenchmark(vendorId, activeStats);
  } catch {
    return undefined;
  }
}

export async function vendorScenarios(
  client: RequestClient,
  userId: string,
  input: z.infer<typeof scenarioInput>,
): Promise<ScenarioResult> {
  const since = new Date(dayKey(1 - Number(input.days)) + "T00:00:00+08:00").toISOString();
  const asOf = new Date().toISOString();
  const [campus, report, menuResult, peersResult, ordersResult, benchmark, queueResult] = await Promise.all([
    fetchApuCampusContext(),
    adminReport(client, new URLSearchParams({ vendorId: input.vendorId, days: input.days })),
    client
      .from("menu_items")
      .select("id,name,price_sen,discount_sen,stock,active,work_units")
      .eq("vendor_id", input.vendorId),
    client
      .from("menu_items")
      .select("name,price_sen,discount_sen,vendor_id,vendors!inner(status)")
      .eq("active", true)
      .eq("vendors.status", "approved")
      .neq("vendor_id", input.vendorId)
      .limit(250),
    readReportPages((from, to) =>
      client
        .from("orders")
        .select("status,total_sen,lines,pickup_at,created_at", { count: from === 0 ? "exact" : undefined })
        .eq("vendor_id", input.vendorId)
        .gte("created_at", since)
        .lte("created_at", asOf)
        .order("created_at")
        .order("id")
        .range(from, to),
    ),
    fetchPeerBenchmark(input.vendorId, since, asOf),
    client
      .from("orders")
      .select("status,pickup_at", { count: "exact" })
      .eq("vendor_id", input.vendorId)
      .in("status", ["placed", "accepted", "preparing", "ready"]),
  ]);
  const weatherOverride = input.weather && input.weather !== "unknown";
  const effectiveWeather = weatherOverride ? (input.weather as "rainy" | "hot") : campus.weather;
  const weatherLabel = weatherOverride
    ? `${effectiveWeather === "rainy" ? "Rainy" : "Warm"} weather scenario (selected)`
    : campus.weatherLabel;
  const audienceLabel =
    input.audience && input.audience !== "unknown"
      ? `${input.audience} audience scenario (selected)`
      : campus.audienceLabel;
  const effectiveAudience = input.audience && input.audience !== "unknown" ? input.audience : campus.audience;
  const menu = (unwrap(menuResult) ?? []) as PatternMenuRow[];
  const peers = unwrap(peersResult) ?? [];
  const vendorOrders = (unwrap(ordersResult) ?? []) as PatternOrder[];
  if (ordersResult.count !== vendorOrders.length) {
    throw new Error("The sales history exceeds the complete-data limit. Choose a shorter period.");
  }
  const queue = queueResult.error ? [] : (queueResult.data ?? []);
  const queueComplete = !queueResult.error && queueResult.count === queue.length;
  const products: ScenarioProduct[] = report.products.map((product) => ({
    id: product.id,
    name: product.name,
    units: product.units,
    revenueSen: product.fulfilledValueSen,
    workUnits: product.units * (menu.find((item) => item.id === product.id)?.work_units ?? 0),
    currentPriceSen: Math.max(
      0,
      (menu.find((item) => item.id === product.id)?.price_sen ?? 0) -
        (menu.find((item) => item.id === product.id)?.discount_sen ?? 0),
    ),
  }));
  const patterns = analyzeSalesPatterns(vendorOrders, products, menu, effectiveWeather);
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify([
        "ai-authored-four-v1",
        userId,
        input.vendorId,
        input.days,
        effectiveWeather,
        effectiveAudience,
        weatherLabel,
        audienceLabel,
        products,
        menu,
        peers,
        patterns,
        benchmark,
        queue,
        queueComplete,
      ]),
    )
    .digest("hex");
  const cached = cache.get(fingerprint);
  if (cached && cached.expires > Date.now()) return { ...cached.result, cached: true };
  const candidates: ScenarioAction[] = [];
  const add = (action: Omit<ScenarioAction, "id">) =>
    candidates.push({ ...action, id: "proposal-" + candidates.length });
  operatingRecommendations({
    menu,
    products,
    days: Number(input.days),
    queue,
    queueComplete,
    nowMs: Date.parse(asOf),
  }).forEach(add);
  const saleable = menu.filter((item) => item.active && item.stock > 0);
  const sold = products.filter((product) => product.units > 0).sort((a, b) => b.units - a.units);
  const weatherPattern =
    effectiveWeather === "rainy"
      ? /soup|noodle|mee|rice|hot|tea|coffee|kopi|curry/i
      : /iced|cold|juice|salad|fruit|drink|teh|kopi/i;
  const seasonal = saleable
    .filter(
      (item) =>
        weatherPattern.test(productName(item.name)) &&
        (effectiveWeather !== "rainy" || !/iced|cold|chilled|ice\b/i.test(productName(item.name))),
    )
    .sort(
      (a, b) =>
        (products.find((product) => product.id === b.id)?.units ?? 0) -
        (products.find((product) => product.id === a.id)?.units ?? 0),
    )[0];
  if (seasonal)
    add({
      kind: "weather",
      itemId: seasonal.id,
      title: "Feature " + productName(seasonal.name),
      detail:
        effectiveWeather === "rainy"
          ? `Promote a warm-meal highlight for ${campus.location} (${weatherLabel}).`
          : `Promote a chilled or refreshing highlight for ${campus.location} (${weatherLabel}).`,
      evidence: [
        productName(seasonal.name) + " is published with " + seasonal.stock + " portions available.",
        `${campus.location} context: ${weatherLabel}.`,
      ],
      assumptions: ["Assume 8% more units for this item; this response is an FIF Optimized estimate."],
      volumeChangePct: 8,
      workSavingPct: 0,
    });
  for (const product of sold.slice(0, 3)) {
    const item = saleable.find((item) => item.id === product.id);
    if (!item || product.currentPriceSen < 200) continue;
    const keywords = productName(product.name)
      .toLowerCase()
      .split(/\W+/)
      .filter(
        (word) =>
          word.length > 3 &&
          !["bowl", "meal", "with", "demo", "signature", "special", "fresh", "house", "classic"].includes(word),
      );
    const comparable = peers
      .filter((peer) => keywords.some((word) => productName(peer.name).toLowerCase().includes(word.replace(/s$/, ""))))
      .map((peer) => peer.price_sen - peer.discount_sen)
      .filter((price) => price > 0)
      .sort((a, b) => a - b);
    const median = comparable.length >= 2 ? comparable[Math.floor(comparable.length / 2)] : undefined;
    const budgetTest =
      effectiveAudience === "students" || (median !== undefined && product.currentPriceSen > median * 1.1);
    const nextPrice = Math.max(100, Math.round((product.currentPriceSen * (budgetTest ? 0.95 : 1.05)) / 10) * 10);
    if (nextPrice === product.currentPriceSen) continue;
    add({
      kind: "price",
      itemId: item.id,
      proposedPriceSen: nextPrice,
      title: "Test " + productName(item.name) + " at " + money(nextPrice),
      detail: budgetTest
        ? "Run a student-friendly price experiment on a top seller before changing your regular price."
        : "Run a modest price experiment on a high-demand product; verify costs first.",
      evidence: [
        product.units + " units collected for " + money(product.revenueSen) + " in the selected period.",
        "Current menu price " + money(product.currentPriceSen) + ".",
        median !== undefined
          ? comparable.length + " comparable campus items have a median price of " + money(median) + "."
          : "Campus price comparison baseline unavailable; verify food cost margin.",
      ],
      assumptions: [
        budgetTest ? "Assume 6% more units after the price cut." : "Assume 2% fewer units after the price increase.",
        "Ingredient costs and margins are managed by the stall.",
      ],
      volumeChangePct: budgetTest ? 6 : -2,
      workSavingPct: 0,
    });
  }
  const slowMover = patterns.underperformers[0];
  const topSeller = patterns.topSellers[0];
  if (slowMover) {
    add({
      kind: "merchandising",
      itemId: slowMover.itemId,
      title: `Boost ${slowMover.name} with ${topSeller ? topSeller.name : "stall highlight"}`,
      detail: `${slowMover.name} is under-ordered (${slowMover.units} sold, ${slowMover.stock} in stock). Pair or feature it alongside your best sellers to lift conversion.`,
      evidence: [
        slowMover.reason + ".",
        topSeller
          ? `${topSeller.name} leads sales with ${topSeller.units} units (${topSeller.sharePct}% share) and can anchor a combo.`
          : "Active stock is ready for immediate promotion.",
      ],
      assumptions: ["Assume +10% unit lift on the featured slow-moving item through visibility or pairing."],
      volumeChangePct: 10,
      workSavingPct: 0,
    });
  }
  const peak = patterns.peakHours[0];
  const activeDays = patterns.dayPatterns.filter((d) => d.orders > 0);
  const busiestDay = activeDays.slice().sort((a, b) => b.orders - a.orders)[0];
  const quietestDay = activeDays.length >= 2 ? activeDays.slice().sort((a, b) => a.orders - b.orders)[0] : undefined;
  if (peak) {
    add({
      kind: "timing",
      itemId: topSeller?.itemId,
      title: `Pre-stage ${peak.topItemName ?? "top items"} for ${peak.label} rush`,
      detail:
        quietestDay && busiestDay && quietestDay.dayName !== busiestDay.dayName
          ? `Peak demand hits at ${peak.label} (${peak.orders} orders). Busiest day is ${busiestDay.dayName} (${busiestDay.orders} orders); run a ${quietestDay.dayName} midday special to balance weekly volume.`
          : `Peak demand hits at ${peak.label} (${peak.orders} orders). Pre-staging ingredients before this window speeds up handoffs and captures walk-up demand.`,
      evidence: [
        `${peak.label} MYT is your busiest window (${peak.orders} orders${peak.topItemName ? `, led by ${peak.topItemName}` : ""}).`,
        ...(busiestDay
          ? [
              `${busiestDay.dayName} is your strongest day (${busiestDay.orders} orders, ${money(busiestDay.revenueSen)}).`,
            ]
          : []),
        ...(quietestDay && quietestDay.dayName !== busiestDay?.dayName
          ? [`${quietestDay.dayName} is lighter (${quietestDay.orders} orders), suitable for a targeted campus deal.`]
          : []),
      ],
      assumptions: [
        "Assume +6% volume captured from faster peak-hour throughput and off-peak day balancing.",
        "Assume 5% preparation efficiency from pre-staging before peak.",
      ],
      volumeChangePct: 6,
      workSavingPct: 5,
    });
  }
  if (sold.length)
    add({
      kind: "preparation",
      title: "Trial shared preparation for repeat orders",
      detail:
        "Group common preparation steps for the busiest products while preserving food-safety handling and individual pickup times.",
      evidence: [
        sold.reduce((sum, product) => sum + product.units, 0) +
          " collected units are available as a historical replay baseline.",
      ],
      assumptions: [
        "Assume 8% less preparation effort per unit.",
        "No extra sales are assumed for preparation changes.",
      ],
      volumeChangePct: 0,
      workSavingPct: 8,
    });
  let chosen: ScenarioAction[] = [];
  let source: "rules" | "gemini" = "rules";
  const notes = [
    `Context: ${campus.location}; ${weatherLabel}; ${audienceLabel}.`,
    ...(peak
      ? [
          `Peak window: ${peak.label} MYT (${peak.orders} orders${peak.topItemName ? `, top: ${peak.topItemName}` : ""}).`,
        ]
      : []),
    ...(benchmark
      ? [benchmark.summary]
      : ["Peer benchmark unavailable or exceeds the complete-data limit; no ranking is shown."]),
    "Scenario estimates replay collected sales with recipe work units; no menu price changes automatically.",
    "Campus prices are published menu comparisons, not a survey of the wider market. Customer demographics, ingredient costs, campus events and personal timetables are not connected.",
    ...(!queueComplete
      ? ["Live queue could not be read completely; queue-specific recommendations are withheld."]
      : []),
  ];
  const key = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_FALLBACK;
  if (key && candidates.length) {
    const limit = await privilegedClient().rpc("consume_auth_request", {
      p_key: createHash("sha256")
        .update("scenario:" + userId)
        .digest("hex"),
      p_limit: 12,
      p_seconds: 3600,
    });
    if (!limit.error && limit.data === true) {
      try {
        chosen = await generateVendorRecommendations(
          candidates,
          {
            location: campus.location,
            weather: effectiveWeather,
            weatherLabel,
            audience: effectiveAudience,
            audienceLabel,
            peakWindow: patterns.peakHours[0]?.label,
            tier: benchmark?.ratingLabel,
            dataAsOf: report.asOf,
            days: input.days,
            dataNotice:
              "Sales and payment activity in this project are demonstration fixtures. Weather may be live; check its source label.",
          },
          {
            key,
            model: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
          },
        );
        source = "gemini";
      } catch {
        notes.push(
          "AI recommendations could not be generated or verified. No rule-written suggestions are substituted. Please retry.",
        );
      }
    } else
      notes.push(
        "AI generation limit reached or could not be checked. No recommendations were generated; please retry later.",
      );
  }
  if (!key) notes.push("Gemini is not configured; AI recommendations are unavailable.");
  if (!sold.length)
    notes.push(
      "No collected sales in this period. Collect orders or choose a longer period before interpreting projections.",
    );
  const result = scenarioOutput.parse({
    generatedAt: new Date().toISOString(),
    dataAsOf: report.asOf,
    days: input.days,
    weather: effectiveWeather,
    audience: effectiveAudience,
    source,
    cached: false,
    context: {
      location: campus.location,
      weatherLabel,
      temperatureC: weatherOverride ? undefined : campus.temperatureC,
      audienceLabel,
      fetchedLive: !weatherOverride && campus.fetchedLive,
    },
    products,
    actions: chosen,
    notes,
    patterns,
    benchmark,
    signals: [
      {
        id: "sales",
        label: "Sales and demand",
        source: "sales",
        available: true,
        summary: `${vendorOrders.length} orders over ${input.days} days; ${sold.length} products with collected sales.`,
      },
      {
        id: "timing",
        label: "Peak periods",
        source: "sales",
        available: !!peak,
        summary: peak
          ? `${peak.label} MYT is the busiest observed pickup window (${peak.orders} orders).`
          : "Not enough order history to identify a peak.",
      },
      {
        id: "stock",
        label: "Stock and menu",
        source: "operations",
        available: true,
        summary: `${menu.filter((item) => item.active && item.stock <= 5).length} active items with five or fewer portions; ${menu.filter((item) => !item.active).length} unpublished items.`,
      },
      {
        id: "queue",
        label: "Live kitchen demand",
        source: "operations",
        available: queueComplete,
        summary: queueComplete
          ? `${queue.length} active orders; ${queue.filter((order) => Date.parse(order.pickup_at) < Date.parse(asOf) && order.status !== "ready").length} past pickup time and not ready.`
          : "The full queue is unavailable; no queue-based estimate is used.",
      },
      {
        id: "prices",
        label: "Campus pricing",
        source: "campus",
        available: peers.length > 0,
        summary: `${peers.length} published items from other approved campus stalls checked. Similar-name items are approximate comparisons.`,
      },
      { id: "audience", label: "Campus timing", source: "campus", available: true, summary: audienceLabel },
      {
        id: "weather",
        label: "Local conditions",
        source: "weather",
        available: !weatherOverride && campus.fetchedLive,
        summary: weatherLabel,
      },
    ],
  });
  if (cache.size >= 200) cache.clear();
  cache.set(fingerprint, { expires: Date.now() + (source === "gemini" ? 300_000 : 30_000), result });
  return result;
}
