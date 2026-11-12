"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, MessageSquare, Sparkles } from "lucide-react";
import { type AdminOverview, type AdminScope, type AdminInsights, adminOutlook } from "../../lib/admin-dashboard";
import { adminOptimization, type AdminOptimization } from "../../lib/admin-intelligence";
import { money } from "../../lib/orders";
import { useApi, useSessionUser, messageOf } from "../workspace/common";
import { ModalSheet } from "../ui/primitives";
import { RichText } from "../ui/rich-text";
import { AdminCard, AdminNumber } from "./charts";
import { adminDate } from "./use-admin-overview";
import { niceAxisCeiling, formatAxisRM } from "../../lib/chart-scale";
export function AdminFif({
  data,
  scope,
  onOptimizationChange,
}: {
  data: AdminOverview;
  scope: AdminScope;
  onOptimizationChange: (value: AdminOptimization | undefined) => void;
}) {
  const api = useApi(),
    [insights, setInsights] = useState<AdminInsights>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [hint, setHint] = useState(false),
    [chat, setChat] = useState(false);
  const generation = useRef(0),
    target = useRef<HTMLElement>(null),
    key = JSON.stringify(scope);
  useEffect(() => {
    generation.current++;
    setInsights(undefined);
    setError("");
    setBusy(false);
    setHint(false);
    setSelected([]);
  }, [key]);
  useEffect(() => {
    if (!hint) return;
    const timer = setTimeout(() => setHint(false), 9000);
    return () => clearTimeout(timer);
  }, [hint]);
  const stale = !!insights && !!data.fingerprint && insights.fingerprint !== data.fingerprint;
  const optimization = useMemo(
    () => adminOptimization(data, insights, selected, stale),
    [data, insights, selected, stale],
  );
  useEffect(() => onOptimizationChange(optimization), [optimization, onOptimizationChange]);
  const generate = async () => {
    const version = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const result = await api.adminInsights(scope);
      if (version !== generation.current) return;
      setInsights(result);
      setSelected(result.recommendations.map((r) => r.id));
      setHint(result.recommendations.length > 0);
    } catch (e) {
      if (version === generation.current) setError(messageOf(e));
    } finally {
      if (version === generation.current) setBusy(false);
    }
  };
  return (
    <>
      <section className="admin-fif" ref={target} id="admin-fif-insights">
        <header>
          <div>
            <span className="admin-eyebrow">
              <img src="/brand/ap-monogram-v2.png" alt="" width={24} height={24} /> FOOD INTELLIGENCE FRAMEWORK
            </span>
            <h2>FIF management insights</h2>
            <p>One intelligence layer for vendor performance, food choice, demand and financial planning.</p>
          </div>
          <div className="admin-actions">
            <button className="button secondary" onClick={() => setChat(true)}>
              <MessageSquare size={15} /> Ask FIF
            </button>
            <button className="button primary" disabled={busy} onClick={generate}>
              <Sparkles size={15} />
              {busy ? "Analysing vendors…" : insights ? "Refresh insights" : "Generate insights"}
            </button>
          </div>
        </header>
        <p className="admin-source">
          Read-only guidance · up to four Gemini-written recommendations · no management changes are applied
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {stale && (
          <p className="admin-warning" role="status">
            Source data has changed. Refresh insights before using FIF Optimized estimates.
          </p>
        )}
        {optimization && (
          <div className="admin-native-state" role="status">
            <Sparkles size={15} />
            <strong>FIF Optimized preview</strong>
            <span>
              {optimization.recommendations} selected actions · {optimization.priorityVendorIds.length} stalls in scope
            </span>
            <span>{optimization.recoveredOrders} potential order recoveries · recorded results remain unchanged</span>
          </div>
        )}
        {insights ? (
          <>
            <div className="admin-insight-meta">
              <span>
                {insights.source === "gemini"
                  ? "Gemini-generated · evidence checked"
                  : "AI recommendations unavailable"}
                {insights.cached ? " · cached" : ""}
              </span>
              <span>
                {insights.context.weatherLabel} ·{" "}
                {insights.context.fetchedLive ? "live observation" : "not a live observation"}
              </span>
              <span>Evidence as of {adminDate(insights.asOf)} MYT</span>
            </div>
            <div className="admin-strategy-grid">
              {insights.assessments.map((assessment) => (
                <article key={assessment.id}>
                  <span className="admin-eyebrow">{assessment.label}</span>
                  <h3>{assessment.verdict}</h3>
                  <p>{assessment.summary}</p>
                  <details>
                    <summary>Evidence &amp; gaps</summary>
                    <ul>
                      {assessment.evidence.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                    {assessment.limitations.map((e, i) => (
                      <p key={i}>{e}</p>
                    ))}
                  </details>
                </article>
              ))}
            </div>
            <div className="admin-recommendations">
              {insights.recommendations.map((rec) => (
                <article key={rec.id}>
                  <div className="admin-recommendation-top">
                    <span>
                      {(rec.vendorIds?.length ?? 1) > 1
                        ? `Campus programme · ${rec.vendorIds!.length} stalls`
                        : (data.vendors.find((v) => v.id === rec.vendorId)?.name ?? "Stall review")}
                    </span>
                    {
                      <label>
                        <input
                          type="checkbox"
                          checked={selected.includes(rec.id)}
                          onChange={(e) =>
                            setSelected((ids) =>
                              e.target.checked ? [...ids, rec.id] : ids.filter((id) => id !== rec.id),
                            )
                          }
                          disabled={stale}
                        />
                        Include in preview
                      </label>
                    }
                  </div>
                  <h3>{rec.title}</h3>
                  <p>{rec.detail}</p>
                  <details>
                    <summary>Evidence &amp; assumptions</summary>
                    <ul>
                      {rec.evidence.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                    {rec.assumptions.map((a, i) => (
                      <p key={i}>{a}</p>
                    ))}
                  </details>
                  {rec.impactSen !== undefined ? (
                    <small>
                      FIF estimate: +{money(rec.impactSen)} net · {rec.effect?.recoveredOrders ?? 0} potential
                      recoveries · {rec.effect?.capturePct ?? 0}% recovery assumption
                    </small>
                  ) : (
                    <small>Management review · no financial uplift assumed</small>
                  )}
                  <Link className="admin-review-link" href={rec.href}>
                    Review in management →
                  </Link>
                </article>
              ))}
            </div>
            {!insights.recommendations.length && (
              <p className="admin-card-copy">
                {insights.source === "gemini"
                  ? "No sufficiently supported recommendations in this scope."
                  : "Recommendations are unavailable. Review the source notes and try again."}
              </p>
            )}
            <details className="admin-exact">
              <summary>Sources and limitations</summary>
              {insights.notes.map((n, i) => (
                <p key={i}>{n}</p>
              ))}
            </details>
          </>
        ) : (
          <div className="admin-ai-empty">
            <img src="/brand/ap-monogram-v2.png" alt="" width={40} height={40} />
            <div>
              <strong>Bring the whole cafeteria into focus.</strong>
              <p>
                Generate insights to review vendor performance, stock risks, queue issues and financial movements with
                supporting evidence.
              </p>
            </div>
          </div>
        )}
      </section>
      {hint && (
        <aside className="admin-insight-hint" role="status">
          <img src="/brand/ap-monogram-v2.png" alt="" width={26} height={26} />
          <span>
            <strong>FIF Insights</strong>
            <small>{insights?.recommendations.length} recommendations ready</small>
          </span>
          <button
            onClick={() => {
              target.current?.scrollIntoView({
                behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
                block: "start",
              });
              setHint(false);
            }}
          >
            View insights <ArrowDown size={14} />
          </button>
          <button aria-label="Dismiss insights hint" onClick={() => setHint(false)}>
            ×
          </button>
        </aside>
      )}
      {chat && (
        <AdminAssistant
          scope={scope}
          scopeLabel={
            scope.vendorId
              ? (data.vendors.find((v) => v.id === scope.vendorId)?.name ?? "Selected stall")
              : scope.zoneId
                ? "Selected food court"
                : "All stalls"
          }
          close={() => setChat(false)}
        />
      )}
    </>
  );
}
export function AdminCampusOutlook({ data, optimization }: { data: AdminOverview; optimization?: AdminOptimization }) {
  const impactSen = optimization && Object.keys(optimization.byVendor).length ? optimization.netSen : undefined;
  const [horizon, setHorizon] = useState(30),
    rows = adminOutlook(data, horizon, impactSen ?? 0),
    last = rows.at(-1)!;
  const values = rows.flatMap((r) => [r.baselineSen, r.optimizedSen]);
  const top = niceAxisCeiling(Math.max(0, ...values) / 100, 3).ceiling,
    bottom = Math.min(0, ...values) < 0 ? -niceAxisCeiling(-Math.min(...values) / 100, 2).ceiling : 0;
  const y = (v: number) => 100 - ((v / 100 - bottom) / (top - bottom)) * 100;
  const points = (optimized: boolean) =>
    rows.map((r, i) => `${(i / horizon) * 100},${y(optimized ? r.optimizedSen : r.baselineSen)}`).join(" ");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date(data.asOf));
  const completed = data.daily.filter((d) => d.day < today).length;
  return (
    <AdminCard
      className="admin-wide"
      eyebrow="CAMPUS CASHFLOW OUTLOOK"
      title="Plan the months ahead"
      action={
        <label className="field compact">
          Projection horizon
          <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
            {[30, 60, 90, 180].map((n, i) => (
              <option key={n} value={n}>
                Next {[1, 2, 3, 6][i]} month{n > 30 ? "s" : ""} · {n} days
              </option>
            ))}
          </select>
        </label>
      }
    >
      {completed >= 2 ? (
        <>
          <div className="admin-outlook-summary">
            <span>
              Baseline net cashflow
              <strong>
                <AdminNumber value={last.baselineSen} moneyValue />
              </strong>
            </span>
            <span>
              FIF Optimized
              <strong>
                {impactSen === undefined ? (
                  "No quantified estimate"
                ) : (
                  <AdminNumber value={last.optimizedSen} moneyValue />
                )}
              </strong>
            </span>
            <span>
              Estimated difference
              <strong>
                {impactSen === undefined ? (
                  "—"
                ) : (
                  <AdminNumber value={last.optimizedSen - last.baselineSen} moneyValue />
                )}
              </strong>
            </span>
          </div>
          <div
            className="admin-line-chart"
            role="img"
            aria-label={`${horizon}-day projected cumulative net cashflow: baseline ${money(last.baselineSen)}${impactSen === undefined ? "; no quantified AI estimate" : `; FIF Optimized ${money(last.optimizedSen)}`}.`}
          >
            <div className="admin-chart-axis">
              {[top, (top + bottom) / 2, bottom].map((n, i) => (
                <span key={i}>
                  {n < 0 ? "−" : ""}
                  {formatAxisRM(Math.abs(n))}
                </span>
              ))}
            </div>
            <div className="admin-chart-canvas">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                {[top, (top + bottom) / 2, bottom].map((n, i) => (
                  <line
                    key={i}
                    x1="0"
                    x2="100"
                    y1={y(n * 100)}
                    y2={y(n * 100)}
                    stroke="#e9dfcc"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                <polyline
                  points={points(false)}
                  fill="none"
                  stroke="#89909a"
                  strokeDasharray="5 4"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
                {impactSen !== undefined && (
                  <polyline
                    points={points(true)}
                    fill="none"
                    stroke="#b58a16"
                    strokeWidth="2.5"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>
              <div className="admin-chart-dates">
                <span>Today · day 0</span>
                <span>Day {horizon}</span>
              </div>
            </div>
          </div>
          <div className="admin-legend">
            <span>┄ Baseline</span>
            <span>━ FIF Optimized · estimates only</span>
          </div>
          {impactSen !== undefined && last.optimizedSen > last.baselineSen && (
            <div className="admin-incremental-impact">
              <div>
                <span className="admin-eyebrow">INCREMENTAL RECOVERY · SEPARATE SCALE</span>
                <h3>What FIF could recover</h3>
                <p>
                  +{money(last.optimizedSen - last.baselineSen)} over {horizon} days
                  {last.baselineSen > 0
                    ? ` · ${(((last.optimizedSen - last.baselineSen) / last.baselineSen) * 100).toFixed(2)}% above baseline`
                    : ""}
                </p>
              </div>
              <div
                className="admin-recovery-bars"
                role="img"
                aria-label={`Projected additional net cashflow only, starting from zero and reaching ${money(last.optimizedSen - last.baselineSen)} at day ${horizon}. Not total income.`}
              >
                {[0.25, 0.5, 0.75, 1].map((fraction) => {
                  const day = Math.round(horizon * fraction),
                    row = rows[day],
                    gain = row.optimizedSen - row.baselineSen,
                    ceiling = niceAxisCeiling((last.optimizedSen - last.baselineSen) / 100, 2).ceiling * 100;
                  return (
                    <div key={day}>
                      <strong>{money(gain)}</strong>
                      <span>
                        <i style={{ height: Math.max(1, (gain / ceiling) * 66) + "px" }} />
                      </span>
                      <small>Day {day}</small>
                    </div>
                  );
                })}
              </div>
              <small>
                Scale starts at RM 0. These bars show additional estimated net cashflow only; the total forecast is
                shown above.
              </small>
            </div>
          )}
          <details className="admin-exact">
            <summary>View projected daily values</summary>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Days ahead</th>
                    <th>Cumulative baseline</th>
                    <th>FIF Optimized</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.day}>
                      <td>{r.day}</td>
                      <td>{money(r.baselineSen)}</td>
                      <td>{impactSen === undefined ? "—" : money(r.optimizedSen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : (
        <p className="admin-card-copy">
          Select a reporting period with at least two completed days to build an outlook.
        </p>
      )}
      <footer>
        Baseline uses {completed} completed days of combined vendor net cashflow, including scoped shared overhead. Only
        explicitly quantified, selected recommendations affect FIF Optimized; overlapping vendor impacts are counted
        once. No compounding. Cost ratios and demand may change; longer horizons are less certain. This is not operator
        profit.
      </footer>
    </AdminCard>
  );
}
type Message = { role: "user" | "assistant"; text: string; links?: { href: string; label: string }[] };
function AdminAssistant({ scope, scopeLabel, close }: { scope: AdminScope; scopeLabel: string; close: () => void }) {
  const api = useApi(),
    user = useSessionUser(),
    storage = `apfoods-admin-fif:${user}`,
    context = JSON.stringify(scope);
  const [messages, setMessages] = useState<Message[]>(() => {
      try {
        return JSON.parse(sessionStorage.getItem(storage) ?? "[]").slice(-20);
      } catch {
        return [];
      }
    }),
    [input, setInput] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const current = useRef(0),
    end = useRef<HTMLDivElement>(null);
  useEffect(
    () => () => {
      current.current++;
    },
    [],
  );
  useEffect(() => {
    try {
      sessionStorage.setItem(storage, JSON.stringify(messages.slice(-20)));
    } catch {}
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages, storage]);
  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const version = ++current.current,
      history = messages.slice(-10).map(({ role, text }) => ({ role, text }));
    setMessages((old) => [...old, { role: "user", text }]);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const result = await api.adminChat({ scope: JSON.parse(context), message: text, history });
      if (version === current.current)
        setMessages((old) => [...old, { role: "assistant", text: result.reply, links: result.links }]);
    } catch (e) {
      if (version === current.current) setError(messageOf(e));
    } finally {
      if (version === current.current) setBusy(false);
    }
  };
  return (
    <ModalSheet title="FIF · Admin assistant" close={close} wide>
      <div className="admin-assistant">
        <p className="admin-source">
          Read-only · {scopeLabel} · {scope.days === "1" ? "Today" : `Last ${scope.days} days`}
        </p>
        <p>
          Ask about vendor performance, finances, products or current kitchen activity. FIF opens management controls
          for review.
        </p>
        <div className="admin-chat-starters">
          {[
            "Which vendors need attention?",
            "Compare cashflow across the whole cafeteria",
            "Which products need a stock review?",
          ].map((text) => (
            <button key={text} disabled={busy} onClick={() => void send(text)}>
              {text}
            </button>
          ))}
        </div>
        <div className="admin-chat-messages" role="log" aria-label="FIF conversation">
          {messages.map((message, i) => (
            <article className={message.role} key={i}>
              <strong>{message.role === "user" ? "You" : "FIF"}</strong>
              <RichText text={message.text} />
              {message.links?.map((link) => (
                <Link key={link.href} href={link.href} onClick={close}>
                  {link.label} →
                </Link>
              ))}
            </article>
          ))}
          {busy && <p role="status">Checking management evidence…</p>}
          <div ref={end} />
        </div>
        {error && <p role="alert">{error}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <label className="field">
            Ask FIF
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={1000}
              placeholder="What should I review across the stalls?"
              disabled={busy}
            />
          </label>
          <button className="button primary" disabled={busy || !input.trim()}>
            Send
          </button>
          <button type="button" className="button secondary" disabled={busy} onClick={() => setMessages([])}>
            Clear chat
          </button>
        </form>
      </div>
    </ModalSheet>
  );
}
