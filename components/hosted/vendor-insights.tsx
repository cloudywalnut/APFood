"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Award,
  ClipboardList,
  CloudSun,
  Package,
  RefreshCw,
  Sparkles,
  WalletCards,
} from "lucide-react";
import type { OrderRow } from "../../lib/backend/contracts";
import { money } from "../../lib/orders";
import { projectScenario, type ScenarioProduct, type ScenarioResult } from "../../lib/fif-scenarios";
import { pickupWindow } from "../../lib/pickup-time";
import { FifPanel } from "../workspace/fif";
import { RemoteStatus, messageOf, useApi, useRemote } from "../workspace/common";
import { useAnimatedNumber } from "./use-animated-number";
import { VendorScenarioStudio } from "./vendor-scenario-studio";
import { VendorSalesOverview } from "./vendor-sales-overview";

export function VendorInsights({
  vendorId,
  active,
  orders,
  detailed = false,
}: {
  vendorId: string;
  active: OrderRow[];
  orders: OrderRow[];
  detailed?: boolean;
}) {
  const api = useApi();
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
      setSelected(value.actions.map((action) => action.id));
      setDemandScale(1);
      setEffortScale(1);
    } catch (problem) {
      if (version === aiGen.current) setAiError(messageOf(problem));
    } finally {
      if (version === aiGen.current) setAiBusy(false);
    }
  }, [api, vendorId, days]);

  const [projectionsOpen, setProjectionsOpen] = useState(false);

  useEffect(() => {
    if (analysis) setProjectionsOpen(true);
  }, [analysis]);

  useEffect(() => {
    const onActionApplied = () => {
      result.reload();
    };
    window.addEventListener("apfood:vendor-action-applied", onActionApplied);
    return () => window.removeEventListener("apfood:vendor-action-applied", onActionApplied);
  }, [result.reload]);

  useEffect(() => {
    aiGen.current += 1;
    setAnalysis(undefined);
    setSelected([]);
    setAiError("");
    setAiBusy(false);
  }, [vendorId, days]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") result.reload();
    };
    const timer = window.setInterval(refresh, 60_000);
    return () => clearInterval(timer);
  }, [result.reload]);

  const lowStock =
    result.value?.menu.filter((item) => item.active && item.stock <= 5).sort((a, b) => a.stock - b.stock) ?? [];
  const next = active.slice().sort((a, b) => Date.parse(a.pickup_at) - Date.parse(b.pickup_at));
  const nowMs = Date.now();
  const dueNextHour = active.filter((order) => {
    const pickupMs = Date.parse(order.pickup_at);
    return Number.isFinite(pickupMs) && pickupMs + 900_000 >= nowMs && pickupMs <= nowMs + 3_600_000;
  }).length;
  const overduePickups = active.filter((order) => {
    const pickupMs = Date.parse(order.pickup_at);
    return Number.isFinite(pickupMs) && pickupMs + 900_000 < nowMs;
  }).length;
  const report = result.value?.report;
  const receipts = report ? report.finance.demo + report.finance.counter + report.finance.duitnow_qr : undefined;
  const products =
    report?.products
      .slice()
      .sort((a, b) => b.units - a.units)
      .slice(0, 5) ?? [];
  const daysNum = Number(days);
  const stockPaceText = (stock: number, itemId: string) => {
    if (stock <= 0) return "Out of stock";
    const units = report?.products.find((product) => product.id === itemId)?.units ?? 0;
    if (units <= 0 || daysNum <= 0) return `${stock} portions left · no recent sales`;
    const daysLeft = stock / (units / daysNum);
    if (daysLeft < 1) return `${stock} portions left · <1 day at recent pace`;
    if (daysLeft < 10) return `${stock} portions left · ~${daysLeft.toFixed(1)}d at recent pace`;
    return `${stock} portions left · ~${Math.round(daysLeft)}d at recent pace`;
  };

  const baseline: ScenarioProduct[] =
    report?.products.map((product) => ({
      id: product.id,
      name: product.name,
      units: product.units,
      revenueSen: product.fulfilledValueSen,
      workUnits: product.units * (result.value?.menu.find((item) => item.id === product.id)?.work_units ?? 0),
      currentPriceSen: Math.max(
        0,
        (result.value?.menu.find((item) => item.id === product.id)?.price_sen ?? 0) -
          (result.value?.menu.find((item) => item.id === product.id)?.discount_sen ?? 0),
      ),
    })) ?? [];
  const scenarioProducts = analysis?.products ?? baseline;
  const observed = projectScenario(scenarioProducts, []);
  const activeActions = analysis?.actions.filter((action) => selected.includes(action.id)) ?? [];
  const projected = projectScenario(scenarioProducts, activeActions, demandScale, effortScale);
  const revenueDelta = projected.revenueSen - observed.revenueSen;
  const revenuePct = observed.revenueSen > 0 ? Math.round((revenueDelta / observed.revenueSen) * 1000) / 10 : 0;
  const volumePct =
    observed.units > 0 ? Math.round(((projected.units - observed.units) / observed.units) * 1000) / 10 : 0;
  const effortDelta = observed.workUnits - projected.workUnits;
  const effortPct =
    observed.workUnits > 0
      ? Math.round(((projected.workUnits - observed.workUnits) / observed.workUnits) * 1000) / 10
      : 0;
  const animatedRevDelta = useAnimatedNumber(analysis ? revenueDelta : 0, Boolean(analysis), 950);
  const animatedRevPct = useAnimatedNumber(analysis ? revenuePct : 0, Boolean(analysis), 950);
  const animatedEffortPct = useAnimatedNumber(analysis ? effortPct : 0, Boolean(analysis), 950);

  return (
    <div className="vendor-intelligence">
      <div className="vendor-insight-intro">
        <p>
          {detailed
            ? "Recommendations grounded in your sales, stock and campus conditions."
            : "Your sales, kitchen and stock in one place."}
        </p>
        <div className="vendor-report-actions">
          <label className="field compact">
            <span>Period</span>
            <select value={days} onChange={(event) => setDays(event.target.value as typeof days)}>
              <option value="1">Today</option>
              <option value="7">Last 7 days</option>
              <option value="14">Last 14 days</option>
            </select>
          </label>
          <button
            type="button"
            className="button primary"
            disabled={aiBusy || !result.value}
            onClick={() => void runAi()}
          >
            {aiBusy ? <RefreshCw size={15} className="spin" aria-hidden /> : <Sparkles size={15} aria-hidden />}
            {aiBusy ? "Analysing..." : analysis ? "Refresh insights" : "Generate insights"}
          </button>
        </div>
      </div>
      {aiError && (
        <div className="vendor-insight-error" role="alert">
          <span>{aiError}</span>
          <button type="button" disabled={aiBusy || !result.value} onClick={() => void runAi()}>
            Try again
          </button>
        </div>
      )}
      <section className="vendor-overview-metrics" aria-label="Stall performance summary">
        {[
          {
            label: "Net cashflow",
            value: report ? money(report.finance.netSen) : "—",
            note: "Net cashflow · after refunds and expenses",
            href: "/vendor/reports",
          },
          {
            label: "Orders collected",
            value: report
              ? new Set(
                  report.ledger
                    .filter((entry) => ["counter", "duitnow_qr", "demo"].includes(entry.kind) && entry.order_id)
                    .map((entry) => entry.order_id),
                ).size
              : "—",
            note: "Collection receipts in this period",
            href: "/vendor/reports",
          },
          {
            label: "In the kitchen",
            value: active.length,
            note: `${active.filter((order) => order.status === "ready").length} ready for collection right now`,
            href: "/vendor/orders",
          },
          {
            label: "Low-stock items",
            value: result.value ? lowStock.length : "—",
            note: "Published items with 5 or fewer portions",
            href: "/vendor/menu",
          },
        ].map((metric) => (
          <Link href={metric.href} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.note}</small>
          </Link>
        ))}
      </section>
      {analysis && (
        <section className="ai-campus-bar" aria-label="Live AI campus context">
          <div className="ai-campus-pills">
            <span className="ai-pill is-brand">
              <i className={"ai-status-dot " + (analysis ? "is-live" : aiBusy ? "is-busy" : "is-ready")} aria-hidden />
              {analysis
                ? analysis.source === "gemini"
                  ? "Gemini AI active"
                  : "FIF Smart Rules"
                : aiBusy
                  ? "Analysing stall…"
                  : "Baseline stats · AI ready"}
            </span>
            <span className="ai-pill">
              <CloudSun size={13} aria-hidden />
              {analysis?.context?.weatherLabel ?? "Live weather fetched on AI run"}
            </span>
            {analysis?.benchmark && (
              <span className="ai-pill is-rank">
                <Award size={13} aria-hidden />
                Rank #{analysis.benchmark.vendorRank}/{analysis.benchmark.totalVendors} ·{" "}
                {analysis.benchmark.ratingLabel}
              </span>
            )}
          </div>
          {analysis && observed.units > 0 && (
            <div className="ai-campus-deltas" aria-live="polite">
              <span className={"ai-delta-pill " + (revenueDelta >= 0 ? "is-positive" : "is-negative")}>
                Projected revenue{" "}
                <strong>
                  {animatedRevDelta >= 0 ? "+" : "−"}
                  {money(Math.round(Math.abs(animatedRevDelta)))} ({animatedRevPct >= 0 ? "+" : ""}
                  {animatedRevPct.toFixed(1)}%)
                </strong>
              </span>
              <span className={"ai-delta-pill " + (effortDelta >= 0 ? "is-positive" : "is-warn")}>
                Prep workload{" "}
                <strong>
                  {animatedEffortPct > 0 ? "+" : ""}
                  {animatedEffortPct.toFixed(1)}%
                </strong>
              </span>
            </div>
          )}
          <button
            type="button"
            className="vendor-insights-jump"
            onClick={() => {
              setProjectionsOpen(true);
              requestAnimationFrame(() =>
                document.getElementById("vendor-ai-insights")?.scrollIntoView({
                  behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
                  block: "start",
                }),
              );
            }}
          >
            View {analysis.actions.length} recommendations <ArrowDown size={14} aria-hidden />
          </button>
        </section>
      )}
      {analysis?.signals?.length ? (
        <details className="vendor-auto-signals">
          <summary>
            <span className="vendor-section-label">AUTOMATICALLY CHECKED · {analysis.signals.length} INPUTS</span>
            <span>Sales, stock, queue, campus pricing and local context · View evidence</span>
          </summary>
          <div>
            {analysis.signals.map((signal) => (
              <article key={signal.id} data-available={signal.available}>
                <div>
                  <strong>{signal.label}</strong>
                  <span>{signal.available ? "Available" : "Unavailable"}</span>
                </div>
                <p>{signal.summary}</p>
                <small>{signal.source}</small>
              </article>
            ))}
          </div>
        </details>
      ) : null}
      <VendorSalesOverview
        report={report}
        priority={<FifPanel role="vendor" vendorId={vendorId} />}
        menu={result.value?.menu ?? []}
        orders={orders}
        days={Number(days)}
        vendorId={vendorId}
        ai={
          analysis
            ? { actions: activeActions, revenuePct, volumePct, revenueDeltaSen: revenueDelta, effortPct }
            : undefined
        }
      >
        <details
          className="vendor-projections"
          open={projectionsOpen}
          onToggle={(event) => setProjectionsOpen(event.currentTarget.open)}
        >
          <summary>
            <span>AI recommendations &amp; projections</span>
            <small>
              {analysis
                ? `${analysis.actions.length} recommendations ready`
                : "Generate insights to explore possible changes"}
            </small>
          </summary>
          <VendorScenarioStudio
            vendorId={vendorId}
            days={days}
            baseline={baseline}
            loading={!result.value}
            analysis={analysis}
            selected={selected}
            onToggleAction={(id, checked) =>
              setSelected((ids) => (checked ? [...ids, id] : ids.filter((item) => item !== id)))
            }
            demandScale={demandScale}
            effortScale={effortScale}
            onDemandScale={setDemandScale}
            onEffortScale={setEffortScale}
            busy={aiBusy}
            error={aiError}
            onRegenerate={() => void runAi()}
          />
        </details>
      </VendorSalesOverview>
      {detailed && (
        <div className="vendor-kpis">
          {[
            ["Active kitchen orders", active.length],
            ["Awaiting acceptance", active.filter((order) => order.status === "placed").length],
            ["Products needing stock", result.value ? lowStock.length : "—"],
            ["Recorded receipts", receipts !== undefined ? money(receipts) : "—"],
          ].map(([label, value]) => (
            <section key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>
                {label === "Recorded receipts"
                  ? "Collected orders · selected period"
                  : label === "Products needing stock"
                    ? "Published products with 5 or fewer portions"
                    : label === "Active kitchen orders"
                      ? `${dueNextHour} due next 60m · ${overduePickups} overdue`
                      : "Current kitchen activity"}
              </small>
            </section>
          ))}
        </div>
      )}
      {result.error != null && <RemoteStatus error={result.error} reload={result.reload} />}
      {detailed && (
        <div className="vendor-insight-columns">
          <section className="vendor-insight-panel">
            <header>
              <div>
                <span className="vendor-section-label">ACTION QUEUE</span>
                <h2>Stock requiring attention</h2>
              </div>
              <Package size={19} aria-hidden />
            </header>
            {!result.value ? (
              <p className="vendor-insight-empty">Loading stock signals…</p>
            ) : lowStock.length ? (
              <ul className="vendor-attention-list">
                {lowStock.slice(0, detailed ? 12 : 5).map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <span>{stockPaceText(item.stock, item.id)}</span>
                    </div>
                    <Link href={"/vendor/menu?stall=" + vendorId + "&dish=" + encodeURIComponent(item.name)}>
                      Review stock
                      <ArrowUpRight size={15} aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="vendor-insight-empty">No published product is at or below the low-stock threshold.</p>
            )}
            <footer>Pace estimates divide current stock by recent daily units sold; not a demand guarantee.</footer>
          </section>
          <section className="vendor-insight-panel">
            <header>
              <div>
                <span className="vendor-section-label">FULFILMENT</span>
                <h2>Next scheduled pickups</h2>
              </div>
              <ClipboardList size={19} aria-hidden />
            </header>
            {next.length ? (
              <ul className="vendor-attention-list">
                {next.slice(0, detailed ? 12 : 5).map((order) => (
                  <li key={order.id}>
                    <div>
                      <strong>#{order.id.slice(0, 8).toUpperCase()}</strong>
                      <span>{pickupWindow(order.pickup_at)}</span>
                    </div>
                    <Link href={"/vendor/orders/" + order.id}>
                      {order.status === "ready" ? "Verify pickup" : "Open order"}
                      <ArrowUpRight size={15} aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="vendor-insight-empty">
                There are no active kitchen orders. New paid QR and counter orders appear here.
              </p>
            )}
            <footer>Paid QR orders and counter orders · earliest pickup first</footer>
          </section>
        </div>
      )}
      {detailed && (
        <section className="vendor-insight-panel">
          <header>
            <div>
              <span className="vendor-section-label">MENU PERFORMANCE</span>
              <h2>Products by collected sales</h2>
            </div>
            <WalletCards size={19} aria-hidden />
          </header>
          {products.some((item) => item.units > 0) ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Units collected</th>
                    <th>Fulfilled value</th>
                    <th>Stock remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {products
                    .filter((item) => item.units > 0)
                    .map((item) => (
                      <tr key={item.id}>
                        <th scope="row">{item.name}</th>
                        <td>{item.units}</td>
                        <td>{money(item.fulfilledValueSen)}</td>
                        <td>{item.stock}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="vendor-insight-empty">
              No collected sales in this period yet. Performance appears after orders are collected.
            </p>
          )}
          <footer>Selected reporting period · cancelled orders do not count as collected sales</footer>
        </section>
      )}
      <div className="vendor-dashboard-links">
        <Link href="/vendor/orders">
          Open kitchen
          <ArrowRight size={16} aria-hidden />
        </Link>
        <Link href="/vendor/menu">
          Manage menu and stock
          <ArrowRight size={16} aria-hidden />
        </Link>
        <Link href="/vendor/reports">
          View reports
          <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
    </div>
  );
}
