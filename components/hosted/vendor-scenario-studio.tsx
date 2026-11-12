"use client";

import { useState } from "react";
import {
  ArrowRight,
  Award,
  BarChart3,
  Clock,
  CloudSun,
  Flame,
  MapPin,
  MessageSquare,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
  Users,
} from "lucide-react";
import Link from "next/link";
import { money } from "../../lib/orders";
import { projectScenario, type ScenarioProduct, type ScenarioResult } from "../../lib/fif-scenarios";
import { useAnimatedNumber } from "./use-animated-number";

function ComparisonChart({
  title,
  before,
  after,
  format,
  generated,
  deltaPct,
}: {
  title: string;
  before: number;
  after: number;
  format: (value: number) => string;
  generated: boolean;
  deltaPct?: number;
}) {
  const animatedAfter = useAnimatedNumber(generated ? after : before, generated, 950);
  const animatedPct = useAnimatedNumber(generated ? (deltaPct ?? 0) : 0, generated, 950);
  const max = Math.max(1, before, after) * 1.12;
  return (
    <section className="scenario-comparison">
      <div className="scenario-comparison-head">
        <h3>{title}</h3>
        {generated && deltaPct !== undefined && deltaPct !== 0 && (
          <span
            className={
              "ai-inline-delta " +
              (title.includes("effort")
                ? deltaPct <= 0
                  ? "is-positive"
                  : "is-warn"
                : deltaPct >= 0
                  ? "is-positive"
                  : "is-negative")
            }
          >
            {animatedPct > 0 ? "+" : ""}
            {animatedPct.toFixed(1)}%
          </span>
        )}
      </div>
      <div
        className="scenario-bars"
        role="img"
        aria-label={
          title +
          ": recorded " +
          format(before) +
          (generated ? ", AI scenario " + format(after) : ". Run AI Insights to project.")
        }
      >
        <div>
          <span>Recorded</span>
          <div className="scenario-bar-track">
            <i style={{ width: (before / max) * 100 + "%" }} />
          </div>
          <strong>{format(before)}</strong>
        </div>
        <div className={generated ? "is-projected" : "is-pending"}>
          <span>AI Scenario</span>
          <div className="scenario-bar-track">
            <i style={{ width: generated ? (after / max) * 100 + "%" : "0%" }} />
          </div>
          <strong>{generated ? format(Math.round(animatedAfter * 10) / 10) : "—"}</strong>
        </div>
      </div>
    </section>
  );
}

type Props = {
  vendorId: string;
  days: "1" | "7" | "14";
  baseline: ScenarioProduct[];
  loading: boolean;
  analysis?: ScenarioResult;
  selected: string[];
  onToggleAction: (id: string, checked: boolean) => void;
  demandScale: number;
  effortScale: number;
  onDemandScale: (value: number) => void;
  onEffortScale: (value: number) => void;
  busy: boolean;
  error: string;
  onRegenerate: () => void;
};

export function VendorScenarioStudio({
  vendorId,
  days,
  baseline,
  loading,
  analysis,
  selected,
  onToggleAction,
  demandScale,
  effortScale,
  onDemandScale,
  onEffortScale,
  busy,
  error,
  onRegenerate,
}: Props) {
  const products = analysis?.products ?? baseline;
  const observed = projectScenario(products, []);
  const actions = analysis?.actions.filter((action) => selected.includes(action.id)) ?? [];
  const projected = projectScenario(products, actions, demandScale, effortScale);
  const revenueDelta = projected.revenueSen - observed.revenueSen;
  const revenuePct = observed.revenueSen > 0 ? Math.round((revenueDelta / observed.revenueSen) * 1000) / 10 : 0;
  const effortDelta = observed.workUnits - projected.workUnits;
  const effortPct =
    observed.workUnits > 0
      ? Math.round(((projected.workUnits - observed.workUnits) / observed.workUnits) * 1000) / 10
      : 0;
  const hasHistory = observed.units > 0;
  const fingerprint = (rows: ScenarioProduct[]) =>
    JSON.stringify(
      rows
        .map((row) => [row.id, row.units, row.revenueSen, row.workUnits, row.currentPriceSen])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    );
  const stale = Boolean(analysis && !loading && fingerprint(baseline) !== fingerprint(analysis.products));
  const formatWork = (value: number) => value.toLocaleString("en-MY", { maximumFractionDigits: 1 }) + " units";
  const animatedRevDelta = useAnimatedNumber(analysis ? revenueDelta : 0, Boolean(analysis), 950);
  const animatedRevPct = useAnimatedNumber(analysis ? revenuePct : 0, Boolean(analysis), 950);
  const animatedEffortDelta = useAnimatedNumber(analysis ? Math.abs(effortDelta) : 0, Boolean(analysis), 950);
  const animatedEffortPct = useAnimatedNumber(analysis ? effortPct : 0, Boolean(analysis), 950);

  const [sentActionId, setSentActionId] = useState<string | null>(null);
  const dispatchCopilotPrompt = (
    action: NonNullable<ScenarioResult["actions"]>[number],
    matchedProduct?: ScenarioProduct,
  ) => {
    if (typeof window === "undefined") return;
    const rawPrompt =
      action.kind === "price" && action.proposedPriceSen !== undefined && matchedProduct
        ? `Update ${matchedProduct.name} price to ${money(action.proposedPriceSen)} (${action.title})`
        : `Help me apply "${action.title}"${matchedProduct ? ` for ${matchedProduct.name}` : ""}: ${action.detail}`;
    const prompt = rawPrompt.length > 220 ? rawPrompt.slice(0, 217) + "..." : rawPrompt;
    window.dispatchEvent(
      new CustomEvent("apfood:copilot-prompt", {
        detail: {
          vendorId,
          actionId: action.id,
          kind: action.kind,
          itemId: action.itemId,
          itemName: matchedProduct?.name,
          proposedPriceSen: action.proposedPriceSen,
          prompt,
        },
      }),
    );
    setSentActionId(action.id);
    window.setTimeout(() => setSentActionId((current) => (current === action.id ? null : current)), 2500);
  };

  return (
    <section
      id="vendor-ai-insights"
      className="vendor-scenario-studio"
      aria-label="AI business insights and scenario preview"
      aria-busy={busy}
    >
      <header>
        <div>
          <span className="vendor-section-label">FIF · AI GROWTH &amp; OPERATIONS</span>
          <h2>AI-guided actions for your stall.</h2>
          <p>
            Tuned using live APU Campus (Bukit Jalil) weather, what is selling vs what should sell, peak hours,
            day-of-week patterns, and campus vendor benchmarks for the last {days === "1" ? "24 hours" : days + " days"}
            .
          </p>
        </div>
        <button type="button" className="button primary" disabled={busy || loading} onClick={onRegenerate}>
          {busy ? <RefreshCw size={15} className="spin" aria-hidden /> : <Sparkles size={15} aria-hidden />}
          {busy ? "Analysing…" : analysis ? "Refresh AI" : "Run AI Insights"}
        </button>
      </header>
      {analysis?.context && (
        <div className="scenario-live-context">
          <span>
            <MapPin size={13} aria-hidden />
            {analysis.context.location}
          </span>
          <span>
            <CloudSun size={13} aria-hidden />
            {analysis.context.weatherLabel}
          </span>
          <span>
            <Users size={13} aria-hidden />
            {analysis.context.audienceLabel}
          </span>
          <span>
            <BarChart3 size={13} aria-hidden />
            {analysis.source === "gemini" ? "Gemini-ranked" : "Rules-ranked"}
            {analysis.cached ? " · cached" : ""} ·{" "}
            {new Date(analysis.generatedAt).toLocaleTimeString("en-MY", {
              timeZone: "Asia/Kuala_Lumpur",
              hour: "numeric",
              minute: "2-digit",
            })}{" "}
            MYT
          </span>
        </div>
      )}
      {error && (
        <p className="error scenario-error" role="alert">
          {error} Your menu and prices have not changed.
        </p>
      )}
      <div className="scenario-chart-grid">
        <ComparisonChart
          title="Projected revenue · RM"
          before={observed.revenueSen}
          after={projected.revenueSen}
          format={money}
          generated={Boolean(analysis) && hasHistory}
          deltaPct={revenuePct}
        />
        <ComparisonChart
          title="Preparation effort · work units"
          before={observed.workUnits}
          after={projected.workUnits}
          format={formatWork}
          generated={Boolean(analysis) && hasHistory}
          deltaPct={effortPct}
        />
      </div>
      {!analysis && !busy && (
        <p className="scenario-limit">
          Stats above reflect your recorded baseline. Click <strong>Run AI Insights</strong> to generate live
          recommendations, peer vendor ratings, and animated projections.
        </p>
      )}
      {analysis && (
        <>
          {stale && (
            <p className="scenario-limit" role="status">
              Sales or menu data changed since this run. Click Refresh AI to update.
            </p>
          )}
          {hasHistory ? (
            <div className="scenario-impact-strip" aria-live="polite">
              <span>
                Revenue uplift{" "}
                <strong>
                  {animatedRevDelta >= 0 ? "+" : "−"}
                  {money(Math.round(Math.abs(animatedRevDelta)))}{" "}
                  <small>
                    ({animatedRevPct >= 0 ? "+" : ""}
                    {animatedRevPct.toFixed(1)}%)
                  </small>
                </strong>
              </span>
              <span>
                Prep workload {effortDelta >= 0 ? "saved" : "added"}{" "}
                <strong>
                  {formatWork(animatedEffortDelta)}{" "}
                  <small>
                    ({animatedEffortPct > 0 ? "+" : ""}
                    {animatedEffortPct.toFixed(1)}%)
                  </small>
                </strong>
              </span>
              <span>
                Sales baseline <strong>{observed.units} units</strong>
              </span>
            </div>
          ) : (
            <p className="scenario-limit">
              No collected sales in this period yet. Choose a longer period or complete orders to build a baseline.
            </p>
          )}
          {hasHistory && observed.units < 30 && (
            <p className="scenario-limit">
              Early baseline ({observed.units} collected units): treat these numbers as directional AI estimates.
            </p>
          )}
          {analysis.benchmark && (
            <section className="vendor-benchmark-card" aria-label="Campus vendor rating">
              <div className="vendor-benchmark-head">
                <div>
                  <span className="vendor-section-label">
                    <Award size={12} aria-hidden />
                    CAMPUS VENDOR RATING
                  </span>
                  <h3>
                    #{analysis.benchmark.vendorRank} of {analysis.benchmark.totalVendors} active stalls ·{" "}
                    {analysis.benchmark.ratingLabel}
                  </h3>
                  <p>{analysis.benchmark.summary}</p>
                </div>
                <div className="vendor-benchmark-score">
                  <strong>
                    {Math.round(analysis.benchmark.score)}
                    <span>/100</span>
                  </strong>
                  <small>Top {Math.max(1, 100 - analysis.benchmark.percentile)}%</small>
                </div>
              </div>
              <div className="vendor-benchmark-grid">
                <div>
                  <span>Revenue</span>
                  <strong>{money(analysis.benchmark.metrics.revenueSen)}</strong>
                  <small>Campus avg {money(analysis.benchmark.metrics.peerAvgRevenueSen)}</small>
                </div>
                <div>
                  <span>Orders</span>
                  <strong>{analysis.benchmark.metrics.orders}</strong>
                  <small>Campus avg {analysis.benchmark.metrics.peerAvgOrders}</small>
                </div>
                <div>
                  <span>Avg order value</span>
                  <strong>{money(analysis.benchmark.metrics.avgOrderValueSen)}</strong>
                  <small>Campus avg {money(analysis.benchmark.metrics.peerAvgOrderValueSen)}</small>
                </div>
                <div>
                  <span>Fulfilment rate</span>
                  <strong>{analysis.benchmark.metrics.fulfilmentRatePct}%</strong>
                  <small>Campus avg {analysis.benchmark.metrics.peerAvgFulfilmentRatePct}%</small>
                </div>
              </div>
            </section>
          )}
          {analysis.patterns && (
            <section className="vendor-patterns-grid" aria-label="Sales timing and product intelligence">
              <article className="vendor-pattern-card">
                <h4>
                  <Flame size={14} aria-hidden />
                  What&apos;s selling
                </h4>
                {analysis.patterns.topSellers.length ? (
                  <ul>
                    {analysis.patterns.topSellers.map((item) => (
                      <li key={item.itemId}>
                        <strong>{item.name}</strong>
                        <span>
                          {item.units} units · {item.sharePct}% share
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No collected sales yet.</p>
                )}
              </article>
              <article className="vendor-pattern-card">
                <h4>
                  <TrendingDown size={14} aria-hidden />
                  What should sell
                </h4>
                {analysis.patterns.underperformers.length ? (
                  <ul>
                    {analysis.patterns.underperformers.map((item) => (
                      <li key={item.itemId}>
                        <strong>{item.name}</strong>
                        <span>{item.reason}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>All active menu items are moving steadily.</p>
                )}
              </article>
              <article className="vendor-pattern-card">
                <h4>
                  <Clock size={14} aria-hidden />
                  Peak selling hours (MYT)
                </h4>
                {analysis.patterns.peakHours.length ? (
                  <ul>
                    {analysis.patterns.peakHours.map((slot) => (
                      <li key={slot.hour}>
                        <strong>{slot.label}</strong>
                        <span>
                          {slot.orders} orders{slot.topItemName ? ` · Top: ${slot.topItemName}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No hourly order data yet.</p>
                )}
              </article>
              <article className="vendor-pattern-card">
                <h4>
                  <BarChart3 size={14} aria-hidden />
                  Best days &amp; top items
                </h4>
                {analysis.patterns.dayPatterns.some((d) => d.orders > 0) ? (
                  <ul>
                    {analysis.patterns.dayPatterns
                      .filter((d) => d.orders > 0)
                      .map((day) => (
                        <li key={day.dayName}>
                          <strong>{day.dayName}</strong>
                          <span>
                            {day.orders} orders · {money(day.revenueSen)}
                            {day.topItemName ? ` · ${day.topItemName}` : ""}
                          </span>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p>No daily breakdown yet.</p>
                )}
              </article>
            </section>
          )}
          <div className="scenario-proposals">
            {analysis.actions.map((action) => {
              const matchedProduct = action.itemId
                ? products.find((product) => product.id === action.itemId)
                : undefined;
              const dishParam = matchedProduct ? "&dish=" + encodeURIComponent(matchedProduct.name) : "";
              const isMenuAction = action.kind === "price" || Boolean(action.itemId);
              return (
                <article key={action.id} className={selected.includes(action.id) ? "is-selected" : undefined}>
                  <div className="scenario-proposal-top">
                    <label className="scenario-proposal-select">
                      <input
                        type="checkbox"
                        checked={selected.includes(action.id)}
                        onChange={(event) => onToggleAction(action.id, event.target.checked)}
                      />
                      <span>{action.title}</span>
                    </label>
                    <div className="scenario-proposal-badges">
                      {action.volumeChangePct !== 0 && (
                        <span className={"ai-inline-delta " + (action.volumeChangePct > 0 ? "is-positive" : "is-warn")}>
                          {action.volumeChangePct > 0 ? "+" : ""}
                          {action.volumeChangePct}% vol
                        </span>
                      )}
                      {action.workSavingPct > 0 && (
                        <span className="ai-inline-delta is-positive">-{action.workSavingPct}% prep</span>
                      )}
                    </div>
                  </div>
                  <p>{action.detail}</p>
                  <ul>
                    {action.evidence.map((evidence) => (
                      <li key={evidence}>{evidence}</li>
                    ))}
                  </ul>
                  <details>
                    <summary>Assumptions &amp; model notes</summary>
                    {action.assumptions.map((assumption) => (
                      <p key={assumption}>{assumption}</p>
                    ))}
                  </details>
                  <div className="scenario-proposal-actions">
                    <button
                      type="button"
                      className="scenario-copilot-btn"
                      onClick={() => dispatchCopilotPrompt(action, matchedProduct)}
                    >
                      <MessageSquare size={13} aria-hidden />
                      {sentActionId === action.id ? "Sent to FIF AI" : "Ask FIF AI"}
                    </button>
                    {isMenuAction && (
                      <Link href={"/vendor/menu?stall=" + vendorId + dishParam}>
                        Review in menu
                        <ArrowRight size={14} aria-hidden />
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {!analysis.actions.length && (
            <p className="scenario-limit">
              There is not enough suitable menu or sales data for an AI recommendation yet.
            </p>
          )}
          <details className="scenario-method">
            <summary>
              <SlidersHorizontal size={15} aria-hidden />
              Tune AI sensitivity &amp; calculation formula
            </summary>
            <div className="scenario-assumption-controls">
              <label>
                Demand-response strength <strong>{Math.round(demandScale * 100)}%</strong>
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.25"
                  value={demandScale}
                  onChange={(event) => onDemandScale(Number(event.target.value))}
                />
              </label>
              <label>
                Preparation-saving strength <strong>{Math.round(effortScale * 100)}%</strong>
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.25"
                  value={effortScale}
                  onChange={(event) => onEffortScale(Number(event.target.value))}
                />
              </label>
            </div>
            <p>
              Revenue = (historical item revenue + historical units × proposed price difference) × assumed volume
              response. Preparation effort = historical units × current recipe work units × volume response × assumed
              efficiency. Combined demand changes are capped at ±20%; effort savings at 15%.
            </p>
            <ul>
              {analysis.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </details>
        </>
      )}
      <footer>
        AI scenario estimates — no menu price or kitchen setting changes automatically without your confirmation.
      </footer>
    </section>
  );
}
