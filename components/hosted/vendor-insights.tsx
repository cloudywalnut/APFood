"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUpRight, Award, ClipboardList, CloudSun, MapPin, Package, RefreshCw, Sparkles, Users, WalletCards } from "lucide-react";
import type { OrderRow } from "../../lib/backend/contracts";
import { money } from "../../lib/demo";
import { projectScenario, type ScenarioProduct, type ScenarioResult } from "../../lib/fif-scenarios";
import { pickupWindow } from "../../lib/pickup-time";
import { HostedFif } from "./fif";
import { RemoteStatus, messageOf, useHostedData, useRemote } from "./common";
import { useAnimatedNumber } from "./use-animated-number";
import { VendorScenarioStudio } from "./vendor-scenario-studio";
import { VendorSalesOverview } from "./vendor-sales-overview";

export function VendorInsights({ vendorId, active, orders, detailed = false }: { vendorId: string; active: OrderRow[]; orders: OrderRow[]; detailed?: boolean }) {
  const api = useHostedData();
  const [days, setDays] = useState<"1" | "7" | "14">("7");
  const load = useCallback(async () => {
    const [menu, report] = await Promise.all([api.vendorMenu(vendorId), api.vendorReport(vendorId, days)]);
    return { menu, report };
  }, [api, vendorId, days]);
  const result = useRemote(load);
  const [analysis, setAnalysis] = useState<ScenarioResult>();
  const [selected, setSelected] = useState<string[]>([]);
  const [demandScale, setDemandScale] = useState(1);
  const [effortScale, setEffortScale] = useState(1);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const aiGen = useRef(0);

  const runAi = useCallback(async () => {
    const version = ++aiGen.current;
    setAiBusy(true);
    setAiError("");
    try {
      const value = await api.vendorScenarios({ vendorId, days });
      if (version !== aiGen.current) return;
      setAnalysis(value);
      setSelected(value.actions.map(action => action.id));
      setDemandScale(1);
      setEffortScale(1);
    } catch (problem) {
      if (version === aiGen.current) setAiError(messageOf(problem));
    } finally {
      if (version === aiGen.current) setAiBusy(false);
    }
  }, [api, vendorId, days]);

  const [showFlyButton, setShowFlyButton] = useState(false);

  useEffect(() => {
    aiGen.current += 1;
    setAnalysis(undefined);
    setSelected([]);
    setAiError("");
    setAiBusy(false);
    setShowFlyButton(false);
  }, [vendorId, days]);

  useEffect(() => {
    if (!analysis) {
      setShowFlyButton(false);
      return;
    }
    const target = document.getElementById("vendor-ai-insights");
    if (!target || typeof IntersectionObserver === "undefined") {
      setShowFlyButton(true);
      return;
    }
    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        setShowFlyButton(!entry?.isIntersecting);
      },
      { threshold: 0.25, rootMargin: "0px 0px -120px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [analysis]);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") result.reload(); };
    const timer = window.setInterval(refresh, 60_000);
    return () => clearInterval(timer);
  }, [result.reload]);

  const lowStock = result.value?.menu.filter(item => item.active && item.stock <= 5).sort((a, b) => a.stock - b.stock) ?? [];
  const next = active.slice().sort((a, b) => Date.parse(a.pickup_at) - Date.parse(b.pickup_at));
  const report = result.value?.report;
  const receipts = report ? report.finance.demo + report.finance.counter + report.finance.duitnow_qr : undefined;
  const products = report?.products.slice().sort((a, b) => b.units - a.units).slice(0, 5) ?? [];

  const baseline: ScenarioProduct[] = report?.products.map(product => ({
    id: product.id, name: product.name, units: product.units, revenueSen: product.fulfilledValueSen,
    workUnits: product.units * (result.value?.menu.find(item => item.id === product.id)?.work_units ?? 0),
    currentPriceSen: Math.max(0, (result.value?.menu.find(item => item.id === product.id)?.price_sen ?? 0) - (result.value?.menu.find(item => item.id === product.id)?.discount_sen ?? 0)),
  })) ?? [];
  const scenarioProducts = analysis?.products ?? baseline;
  const observed = projectScenario(scenarioProducts, []);
  const activeActions = analysis?.actions.filter(action => selected.includes(action.id)) ?? [];
  const projected = projectScenario(scenarioProducts, activeActions, demandScale, effortScale);
  const revenueDelta = projected.revenueSen - observed.revenueSen;
  const revenuePct = observed.revenueSen > 0 ? Math.round((revenueDelta / observed.revenueSen) * 1000) / 10 : 0;
  const volumePct = observed.units > 0 ? Math.round(((projected.units - observed.units) / observed.units) * 1000) / 10 : 0;
  const effortDelta = observed.workUnits - projected.workUnits;
  const effortPct = observed.workUnits > 0 ? Math.round(((projected.workUnits - observed.workUnits) / observed.workUnits) * 1000) / 10 : 0;
  const animatedRevDelta = useAnimatedNumber(analysis ? revenueDelta : 0, Boolean(analysis), 950);
  const animatedRevPct = useAnimatedNumber(analysis ? revenuePct : 0, Boolean(analysis), 950);
  const animatedEffortPct = useAnimatedNumber(analysis ? effortPct : 0, Boolean(analysis), 950);

  return <div className="vendor-intelligence">
    <div className="vendor-insight-intro"><div><span className="vendor-section-label">FOOD INTELLIGENCE FRAMEWORK · APU BUKIT JALIL</span><h2>{detailed ? "Understand your stall. Act on live AI insights." : "Live AI operations & stall overview."}</h2><p>Your dashboard shows recorded stall stats by default. Run AI Insights to compare your stall against campus peers and preview animated growth projections.</p></div><div className="vendor-report-actions"><button type="button" className={"button " + (analysis ? "secondary" : "primary")} disabled={aiBusy} onClick={() => void runAi()}>{aiBusy ? <RefreshCw size={14} className="spin" aria-hidden /> : <Sparkles size={14} aria-hidden />}{aiBusy ? "Analysing AI…" : analysis ? "Refresh AI" : "Run AI Insights"}</button><label className="field compact">Reporting period<select value={days} onChange={event => setDays(event.target.value as typeof days)}><option value="1">Today</option><option value="7">Last 7 days</option><option value="14">Last 14 days</option></select></label></div></div>
    <section className="ai-campus-bar" aria-label="Live AI campus context">
      <div className="ai-campus-pills">
        <span className="ai-pill is-brand"><Sparkles size={13} aria-hidden />{analysis ? (analysis.source === "gemini" ? "Gemini AI active" : "FIF Smart Rules") : aiBusy ? "Analysing stall…" : "Baseline stats · AI ready"}</span>
        <span className="ai-pill"><MapPin size={13} aria-hidden />{analysis?.context?.location ?? "APU Campus · Bukit Jalil, KL"}</span>
        <span className="ai-pill"><CloudSun size={13} aria-hidden />{analysis?.context?.weatherLabel ?? "Live weather fetched on AI run"}</span>
        <span className="ai-pill"><Users size={13} aria-hidden />{analysis?.context?.audienceLabel ?? "Campus crowd context"}</span>
        {analysis?.benchmark && <span className="ai-pill is-rank"><Award size={13} aria-hidden />Rank #{analysis.benchmark.vendorRank}/{analysis.benchmark.totalVendors} · {analysis.benchmark.ratingLabel}</span>}
      </div>
      {analysis && observed.units > 0 && <div className="ai-campus-deltas" aria-live="polite">
        <span className={"ai-delta-pill " + (revenueDelta >= 0 ? "is-positive" : "is-negative")}>Projected revenue <strong>{animatedRevDelta >= 0 ? "+" : "−"}{money(Math.round(Math.abs(animatedRevDelta)))} ({animatedRevPct >= 0 ? "+" : ""}{animatedRevPct.toFixed(1)}%)</strong></span>
        <span className={"ai-delta-pill " + (effortDelta >= 0 ? "is-positive" : "is-warn")}>Prep workload <strong>{animatedEffortPct > 0 ? "+" : ""}{animatedEffortPct.toFixed(1)}%</strong></span>
      </div>}
    </section>
    <VendorSalesOverview
      report={report}
      menu={result.value?.menu ?? []}
      orders={orders}
      days={Number(days)}
      vendorId={vendorId}
      ai={analysis ? { actions: activeActions, revenuePct, volumePct, revenueDeltaSen: revenueDelta, effortPct } : undefined}
    >
      <VendorScenarioStudio
        vendorId={vendorId}
        days={days}
        baseline={baseline}
        loading={!result.value}
        analysis={analysis}
        selected={selected}
        onToggleAction={(id, checked) => setSelected(ids => checked ? [...ids, id] : ids.filter(item => item !== id))}
        demandScale={demandScale}
        effortScale={effortScale}
        onDemandScale={setDemandScale}
        onEffortScale={setEffortScale}
        busy={aiBusy}
        error={aiError}
        onRegenerate={() => void runAi()}
      />
    </VendorSalesOverview>
    <section className="vendor-fif-desk" aria-label="FIF operational recommendation"><header><span>FIF INSIGHTS DESK</span><span>Based on recorded app activity</span></header><HostedFif role="vendor" vendorId={vendorId} /></section>
    {detailed && <div className="vendor-kpis">{[["Active kitchen orders", active.length], ["Awaiting acceptance", active.filter(order => order.status === "placed").length], ["Products needing stock", result.value ? lowStock.length : "—"], ["Recorded receipts", receipts !== undefined ? money(receipts) : "—"]].map(([label, value]) => <section key={label}><span>{label}</span><strong>{value}</strong><small>{label === "Recorded receipts" ? "Collected orders · selected period" : label === "Products needing stock" ? "Published products with 5 or fewer portions" : "Current kitchen activity"}</small></section>)}</div>}
    {result.error != null && <RemoteStatus error={result.error} reload={result.reload} />}
    {detailed && <div className="vendor-insight-columns"><section className="vendor-insight-panel"><header><div><span className="vendor-section-label">ACTION QUEUE</span><h2>Stock requiring attention</h2></div><Package size={19} aria-hidden /></header>{!result.value ? <p className="vendor-insight-empty">Loading stock signals…</p> : lowStock.length ? <ul className="vendor-attention-list">{lowStock.slice(0, detailed ? 12 : 5).map(item => <li key={item.id}><div><strong>{item.name}</strong><span>{item.stock === 0 ? "Out of stock" : item.stock + " portions remaining"}</span></div><Link href={"/vendor/menu?stall=" + vendorId + "&dish=" + encodeURIComponent(item.name)}>Review stock<ArrowUpRight size={15} aria-hidden /></Link></li>)}</ul> : <p className="vendor-insight-empty">No published product is at or below the low-stock threshold.</p>}<footer>Stock alerts use current portions, not a prediction of future demand.</footer></section>
      <section className="vendor-insight-panel"><header><div><span className="vendor-section-label">FULFILMENT</span><h2>Next scheduled pickups</h2></div><ClipboardList size={19} aria-hidden /></header>{next.length ? <ul className="vendor-attention-list">{next.slice(0, detailed ? 12 : 5).map(order => <li key={order.id}><div><strong>#{order.id.slice(0, 8).toUpperCase()}</strong><span>{pickupWindow(order.pickup_at)}</span></div><Link href={"/vendor/orders/" + order.id}>{order.status === "ready" ? "Verify pickup" : "Open order"}<ArrowUpRight size={15} aria-hidden /></Link></li>)}</ul> : <p className="vendor-insight-empty">There are no active kitchen orders. New paid QR and counter orders appear here.</p>}<footer>Paid QR orders and counter orders · earliest pickup first</footer></section></div>}
    {detailed && <section className="vendor-insight-panel"><header><div><span className="vendor-section-label">MENU PERFORMANCE</span><h2>Products by collected sales</h2></div><WalletCards size={19} aria-hidden /></header>{products.some(item => item.units > 0) ? <div className="table-wrap"><table><thead><tr><th>Product</th><th>Units collected</th><th>Fulfilled value</th><th>Stock remaining</th></tr></thead><tbody>{products.filter(item => item.units > 0).map(item => <tr key={item.id}><th scope="row">{item.name}</th><td>{item.units}</td><td>{money(item.fulfilledValueSen)}</td><td>{item.stock}</td></tr>)}</tbody></table></div> : <p className="vendor-insight-empty">No collected sales in this period yet. Performance appears after orders are collected.</p>}<footer>Selected reporting period · cancelled orders do not count as collected sales</footer></section>}
    <div className="vendor-dashboard-links"><Link href="/vendor/orders">Open kitchen<ArrowRight size={16} aria-hidden /></Link><Link href="/vendor/menu">Manage menu and stock<ArrowRight size={16} aria-hidden /></Link><Link href="/vendor/reports">View reports<ArrowRight size={16} aria-hidden /></Link></div>
    {showFlyButton && analysis && <button type="button" className="ai-flying-cta" onClick={() => document.getElementById("vendor-ai-insights")?.scrollIntoView({ behavior: "smooth", block: "start" })}><Sparkles size={15} aria-hidden /><span>{analysis.actions.length > 0 ? `View ${analysis.actions.length} AI Recommendations` : "View AI Insights"}</span><ArrowDown size={15} aria-hidden /></button>}
  </div>;
}
