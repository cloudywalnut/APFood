import { createHash } from "node:crypto";
import { z } from "zod";
import type { RequestClient } from "./supabase";
import { adminReport } from "./reports";
import { privilegedClient } from "./auth";
import { unwrap } from "./errors";
import { dayKey, money } from "../demo";
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
const weatherCache = { expires: 0, weather: "hot" as "rainy" | "hot", label: "Warm & humid", tempC: undefined as number | undefined, fetchedLive: false };
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
    : weekday ? "Evening campus crowd" : "Weekend campus visitors";

  if (Date.now() < weatherCache.expires) {
    return {
      location: "APU Campus · Bukit Jalil, KL",
      weather: weatherCache.weather,
      weatherLabel: weatherCache.label,
      temperatureC: weatherCache.tempC,
      audience,
      audienceLabel,
      fetchedLive: weatherCache.fetchedLive,
    };
  }
  try {
    const res = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=3.0554&longitude=101.7006&current=temperature_2m,precipitation,weather_code&timezone=Asia%2FKuala_Lumpur",
      { signal: AbortSignal.timeout(2500) },
    );
    if (!res.ok) throw new Error("Weather unavailable");
    const json = await res.json() as { current?: { temperature_2m?: number; precipitation?: number; weather_code?: number } };
    const temp = typeof json.current?.temperature_2m === "number" ? Math.round(json.current.temperature_2m * 10) / 10 : undefined;
    const precip = typeof json.current?.precipitation === "number" ? json.current.precipitation : 0;
    const code = typeof json.current?.weather_code === "number" ? json.current.weather_code : 0;
    const rainy = precip > 0 || code >= 51;
    const weather = (rainy ? "rainy" : "hot") as "rainy" | "hot";
    const label = rainy
      ? (code >= 95 ? "Thunderstorm" : "Rainy") + (temp !== undefined ? ` · ${temp}°C` : "")
      : (temp !== undefined && temp >= 30 ? "Warm & humid" : "Clear") + (temp !== undefined ? ` · ${temp}°C` : "");
    weatherCache.expires = Date.now() + 10 * 60_000;
    weatherCache.weather = weather;
    weatherCache.label = label;
    weatherCache.tempC = temp;
    weatherCache.fetchedLive = true;
  } catch {
    weatherCache.expires = Date.now() + 2 * 60_000;
    weatherCache.weather = "hot";
    weatherCache.label = "Tropical warm · Bukit Jalil";
    weatherCache.tempC = undefined;
    weatherCache.fetchedLive = false;
  }
  return {
    location: "APU Campus · Bukit Jalil, KL",
    weather: weatherCache.weather,
    weatherLabel: weatherCache.label,
    temperatureC: weatherCache.tempC,
    audience,
    audienceLabel,
    fetchedLive: weatherCache.fetchedLive,
  };
}

async function fetchPeerBenchmark(vendorId: string, since: string, asOf: string): Promise<ScenarioBenchmark | undefined> {
  try {
    const admin = privilegedClient();
    const [vendorsRes, ordersRes] = await Promise.all([
      admin.from("vendors").select("id").eq("status", "approved"),
      admin.from("orders").select("vendor_id,status,total_sen").gte("created_at", since).lte("created_at", asOf).limit(5000),
    ]);
    if (vendorsRes.error || ordersRes.error) return undefined;
    const approvedIds = new Set((vendorsRes.data ?? []).map(v => v.id));
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
    const activeStats = [...map.values()].filter(s => s.totalOrders > 0 || s.vendorId === vendorId);
    return computeVendorBenchmark(vendorId, activeStats);
  } catch {
    return undefined;
  }
}

export async function vendorScenarios(client: RequestClient, userId: string, input: z.infer<typeof scenarioInput>): Promise<ScenarioResult> {
  const since = new Date(dayKey(1 - Number(input.days)) + "T00:00:00+08:00").toISOString();
  const asOf = new Date().toISOString();
  const [campus, report, menuResult, peersResult, ordersResult, benchmark] = await Promise.all([
    fetchApuCampusContext(),
    adminReport(client, new URLSearchParams({ vendorId: input.vendorId, days: input.days })),
    client.from("menu_items").select("id,name,price_sen,discount_sen,stock,active,work_units").eq("vendor_id", input.vendorId),
    client.from("menu_items").select("name,price_sen,discount_sen,vendor_id,vendors!inner(status)").eq("active", true).eq("vendors.status", "approved").neq("vendor_id", input.vendorId).limit(250),
    client.from("orders").select("status,total_sen,lines,pickup_at,created_at").eq("vendor_id", input.vendorId).gte("created_at", since).lte("created_at", asOf),
    fetchPeerBenchmark(input.vendorId, since, asOf),
  ]);
  const effectiveWeather = input.weather && input.weather !== "unknown" ? input.weather : campus.weather;
  const effectiveAudience = input.audience && input.audience !== "unknown" ? input.audience : campus.audience;
  const menu = (unwrap(menuResult) ?? []) as PatternMenuRow[];
  const peers = unwrap(peersResult) ?? [];
  const vendorOrders = (unwrap(ordersResult) ?? []) as PatternOrder[];
  const products: ScenarioProduct[] = report.products.map(product => ({
    id: product.id, name: product.name, units: product.units, revenueSen: product.fulfilledValueSen,
    workUnits: product.units * (menu.find(item => item.id === product.id)?.work_units ?? 0),
    currentPriceSen: Math.max(0, (menu.find(item => item.id === product.id)?.price_sen ?? 0) - (menu.find(item => item.id === product.id)?.discount_sen ?? 0)),
  }));
  const patterns = analyzeSalesPatterns(vendorOrders, products, menu, effectiveWeather);
  const fingerprint = createHash("sha256").update(JSON.stringify([userId, input.vendorId, input.days, effectiveWeather, effectiveAudience, products, menu.map(item => [item.id, item.stock, item.active]), peers, patterns, benchmark])).digest("hex");
  const cached = cache.get(fingerprint);
  if (cached && cached.expires > Date.now()) return { ...cached.result, cached: true };
  const candidates: ScenarioAction[] = [];
  const add = (action: Omit<ScenarioAction, "id">) => candidates.push({ ...action, id: "proposal-" + candidates.length });
  const saleable = menu.filter(item => item.active && item.stock > 0);
  const sold = products.filter(product => product.units > 0).sort((a, b) => b.units - a.units);
  const weatherPattern = effectiveWeather === "rainy" ? /soup|noodle|mee|rice|hot|tea|coffee|kopi|curry/i : /iced|cold|juice|salad|fruit|drink|teh|kopi/i;
  const seasonal = saleable.filter(item => weatherPattern.test(productName(item.name)) && (effectiveWeather !== "rainy" || !/iced|cold|chilled|ice\b/i.test(productName(item.name))))
    .sort((a, b) => (products.find(product => product.id === b.id)?.units ?? 0) - (products.find(product => product.id === a.id)?.units ?? 0))[0];
  if (seasonal) add({ kind: "weather", itemId: seasonal.id, title: "Feature " + productName(seasonal.name),
    detail: effectiveWeather === "rainy"
      ? `Promote a warm-meal highlight for ${campus.location} (${campus.weatherLabel}).`
      : `Promote a chilled or refreshing highlight for ${campus.location} (${campus.weatherLabel}).`,
    evidence: [productName(seasonal.name) + " is published with " + seasonal.stock + " portions available.", `${campus.location} context: ${campus.weatherLabel}.`],
    assumptions: ["Assume 8% more units for this item; this response is an AI scenario estimate."], volumeChangePct: 8, workSavingPct: 0 });
  for (const product of sold.slice(0, 3)) {
    const item = saleable.find(item => item.id === product.id);
    if (!item || product.currentPriceSen < 200) continue;
    const keywords = productName(product.name).toLowerCase().split(/\W+/).filter(word => word.length > 3 && !["bowl", "meal", "with", "demo", "signature", "special", "fresh", "house", "classic"].includes(word));
    const comparable = peers.filter(peer => keywords.some(word => productName(peer.name).toLowerCase().includes(word.replace(/s$/, "")))).map(peer => peer.price_sen - peer.discount_sen).filter(price => price > 0).sort((a, b) => a - b);
    const median = comparable.length >= 2 ? comparable[Math.floor(comparable.length / 2)] : undefined;
    const budgetTest = effectiveAudience === "students" || median !== undefined && product.currentPriceSen > median * 1.1;
    const nextPrice = Math.max(100, Math.round(product.currentPriceSen * (budgetTest ? .95 : 1.05) / 10) * 10);
    if (nextPrice === product.currentPriceSen) continue;
    add({ kind: "price", itemId: item.id, proposedPriceSen: nextPrice, title: "Test " + productName(item.name) + " at " + money(nextPrice),
      detail: budgetTest ? "Run a student-friendly price experiment on a top seller before changing your regular price." : "Run a modest price experiment on a high-demand product; verify costs first.",
      evidence: [product.units + " units collected for " + money(product.revenueSen) + " in the selected period.", "Current menu price " + money(product.currentPriceSen) + ".", median !== undefined ? comparable.length + " comparable campus items have a median price of " + money(median) + "." : "Campus price comparison baseline unavailable; verify food cost margin."],
      assumptions: [budgetTest ? "Assume 6% more units after the price cut." : "Assume 2% fewer units after the price increase.", "Ingredient costs and margins are managed by the stall."],
      volumeChangePct: budgetTest ? 6 : -2, workSavingPct: 0 });
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
        topSeller ? `${topSeller.name} leads sales with ${topSeller.units} units (${topSeller.sharePct}% share) and can anchor a combo.` : "Active stock is ready for immediate promotion.",
      ],
      assumptions: ["Assume +10% unit lift on the featured slow-moving item through visibility or pairing."],
      volumeChangePct: 10,
      workSavingPct: 0,
    });
  }
  const peak = patterns.peakHours[0];
  const activeDays = patterns.dayPatterns.filter(d => d.orders > 0);
  const busiestDay = activeDays.slice().sort((a, b) => b.orders - a.orders)[0];
  const quietestDay = activeDays.length >= 2 ? activeDays.slice().sort((a, b) => a.orders - b.orders)[0] : undefined;
  if (peak) {
    add({
      kind: "timing",
      itemId: topSeller?.itemId,
      title: `Pre-stage ${peak.topItemName ?? "top items"} for ${peak.label} rush`,
      detail: quietestDay && busiestDay && quietestDay.dayName !== busiestDay.dayName
        ? `Peak demand hits at ${peak.label} (${peak.orders} orders). Busiest day is ${busiestDay.dayName} (${busiestDay.orders} orders); run a ${quietestDay.dayName} midday special to balance weekly volume.`
        : `Peak demand hits at ${peak.label} (${peak.orders} orders). Pre-staging ingredients before this window speeds up handoffs and captures walk-up demand.`,
      evidence: [
        `${peak.label} MYT is your busiest window (${peak.orders} orders${peak.topItemName ? `, led by ${peak.topItemName}` : ""}).`,
        ...(busiestDay ? [`${busiestDay.dayName} is your strongest day (${busiestDay.orders} orders · ${money(busiestDay.revenueSen)}).`] : []),
        ...(quietestDay && quietestDay.dayName !== busiestDay?.dayName ? [`${quietestDay.dayName} is lighter (${quietestDay.orders} orders) — ideal for a targeted campus deal.`] : []),
      ],
      assumptions: ["Assume +6% volume captured from faster peak-hour throughput and off-peak day balancing.", "Assume 5% preparation efficiency from pre-staging before peak."],
      volumeChangePct: 6,
      workSavingPct: 5,
    });
  }
  if (sold.length) add({ kind: "preparation", title: "Trial shared preparation for repeat orders", detail: "Group common preparation steps for the busiest products while preserving food-safety handling and individual pickup times.",
    evidence: [sold.reduce((sum, product) => sum + product.units, 0) + " collected units are available as a historical replay baseline."],
    assumptions: ["Assume 8% less preparation effort per unit.", "No extra sales are assumed for preparation changes."], volumeChangePct: 0, workSavingPct: 8 });
  let chosen = (["weather", "price", "merchandising", "timing", "preparation"] as const).flatMap(kind => {
    const candidate = candidates.find(action => action.kind === kind);
    return candidate ? [candidate] : [];
  });
  let source: "rules" | "gemini" = "rules";
  const notes = [
    `Live context: ${campus.location} · ${campus.weatherLabel} · ${campus.audienceLabel}.`,
    ...(peak ? [`Peak window: ${peak.label} MYT (${peak.orders} orders${peak.topItemName ? `, top: ${peak.topItemName}` : ""}).`] : []),
    ...(benchmark ? [benchmark.summary] : []),
    "Scenario estimates replay collected sales with recipe work units; no menu price changes automatically.",
  ];
  const key = process.env.GEMINI_API_KEY;
  if (key && candidates.length) {
    const limit = await privilegedClient().rpc("consume_auth_request", { p_key: createHash("sha256").update("scenario:" + userId).digest("hex"), p_limit: 12, p_seconds: 3600 });
    if (!limit.error && limit.data === true) {
      try {
        const compactCandidates = candidates.map(c => ({ id: c.id, kind: c.kind, title: c.title, detail: c.detail, volumeChangePct: c.volumeChangePct, workSavingPct: c.workSavingPct }));
        const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(process.env.GEMINI_MODEL || "gemini-3.1-flash-lite") + ":generateContent", {
          method: "POST", signal: AbortSignal.timeout(15000), headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({ systemInstruction: { parts: [{ text: "Select up to five distinct, useful cafeteria experiment IDs from the supplied candidates for an APU Campus (Bukit Jalil, Malaysia) food stall. Prefer evidence-supported variety across weather, pricing, merchandising (slow movers), timing (peak hours/days), and preparation. Do not invent IDs or facts. Return JSON actionIds only." }] }, contents: [{ role: "user", parts: [{ text: JSON.stringify({ location: campus.location, weather: effectiveWeather, weatherLabel: campus.weatherLabel, audience: effectiveAudience, audienceLabel: campus.audienceLabel, peakWindow: patterns.peakHours[0]?.label, tier: benchmark?.ratingLabel, candidates: compactCandidates }) }] }], generationConfig: { responseMimeType: "application/json", responseSchema: { type: "OBJECT", properties: { actionIds: { type: "ARRAY", items: { type: "STRING", enum: candidates.map(candidate => candidate.id) }, minItems: 1, maxItems: 5 } }, required: ["actionIds"] }, maxOutputTokens: 256, thinkingConfig: { thinkingLevel: "low" } } }),
        });
        if (!response.ok) throw new Error("Provider unavailable");
        const payload = await response.json();
        const text = payload.candidates?.[0]?.content?.parts?.filter((part: { text?: string; thought?: boolean }) => part.text && !part.thought).map((part: { text: string }) => part.text).join("");
        const selected = z.object({ actionIds: z.array(z.string()).min(1).max(5) }).strict().parse(JSON.parse(text));
        const ids = [...new Set(selected.actionIds)];
        if (ids.length !== selected.actionIds.length || ids.some(id => !candidates.some(candidate => candidate.id === id))) throw new Error("Unknown proposal");
        chosen = ids.map(id => candidates.find(candidate => candidate.id === id)!); source = "gemini";
      } catch { notes.push("Gemini was unavailable or returned an invalid selection; deterministic recommendations are shown."); }
    } else notes.push("AI generation limit reached; deterministic recommendations are shown.");
  }
  if (!sold.length) notes.push("No collected sales in this period. Collect orders or choose a longer period before interpreting projections.");
  const result = scenarioOutput.parse({
    generatedAt: new Date().toISOString(), dataAsOf: report.asOf, days: input.days,
    weather: effectiveWeather, audience: effectiveAudience, source, cached: false,
    context: {
      location: campus.location,
      weatherLabel: campus.weatherLabel,
      temperatureC: campus.temperatureC,
      audienceLabel: campus.audienceLabel,
      fetchedLive: campus.fetchedLive,
    },
    products, actions: chosen, notes, patterns, benchmark,
  });
  if (cache.size >= 200) cache.clear();
  cache.set(fingerprint, { expires: Date.now() + (source === "gemini" ? 300_000 : 30_000), result });
  return result;
}
