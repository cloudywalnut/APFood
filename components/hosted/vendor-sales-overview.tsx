"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Utensils } from "lucide-react";
import type { hostedData } from "../../lib/backend/client";
import type { OrderRow } from "../../lib/backend/contracts";
import type { ScenarioAction } from "../../lib/fif-scenarios";
import { barHeightPx, formatAxisRM, niceAxisCeiling, stackedBarHeightsPx } from "../../lib/chart-scale";
import { money, statusNames } from "../../lib/orders";
import { mealPhoto } from "../storefront/catalogue";
import { useAnimatedNumber } from "./use-animated-number";
import { VendorAnalyticsGrid } from "./vendor-analytics-grid";

type Report = Awaited<ReturnType<typeof hostedData.vendorReport>>;
type Meal = Awaited<ReturnType<typeof hostedData.vendorMenu>>[number];
type AiOverlay = {
  revision: number;
  actions: ScenarioAction[];
  revenuePct: number;
  volumePct: number;
  revenueDeltaSen: number;
  effortPct: number;
};
const channels = ["counter", "duitnow_qr", "demo"] as const;
const labels = { counter: "Counter", duitnow_qr: "DuitNow QR", demo: "Demo payments" };
const mytDay = (date: string | number) => new Date(date).toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });

export function VendorSalesOverview({
  report,
  menu,
  orders,
  days,
  vendorId,
  ai,
  children,
  priority,
}: {
  children?: ReactNode;
  priority?: ReactNode;
  report?: Report;
  menu: Meal[];
  orders: OrderRow[];
  days: number;
  vendorId: string;
  ai?: AiOverlay;
}) {
  const [metric, setMetric] = useState<"revenue" | "collections">("revenue");
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scroll.current) scroll.current.scrollLeft = scroll.current.scrollWidth;
  }, [days]);
  const top = menu
    .filter((item) => item.active)
    .slice()
    .sort(
      (a, b) =>
        (report?.products.find((product) => product.id === b.id)?.units ?? 0) -
        (report?.products.find((product) => product.id === a.id)?.units ?? 0),
    )
    .slice(0, 4);
  const rows = report
    ? Array.from({ length: days }, (_, index) => {
        const day = Date.parse(report.since) + index * 86400_000;
        const entries = report.ledger.filter((entry) => mytDay(entry.created_at) === mytDay(day));
        const values = channels.map((channel) =>
          metric === "revenue"
            ? entries.filter((entry) => entry.kind === channel).reduce((sum, entry) => sum + entry.amount_sen, 0)
            : new Set(
                entries.filter((entry) => entry.kind === channel && entry.order_id).map((entry) => entry.order_id),
              ).size,
        );
        const total = values.reduce((sum, value) => sum + value, 0);
        const activePct = ai ? (metric === "revenue" ? ai.revenuePct : ai.volumePct) : 0;
        const factor = ai ? Math.max(0, 1 + activePct / 100) : 1;
        const projectedTotal = ai
          ? metric === "revenue"
            ? Math.round(total * factor)
            : Math.round(total * factor * 10) / 10
          : total;
        return {
          key: mytDay(day),
          label: new Date(day).toLocaleDateString("en-MY", {
            timeZone: "Asia/Kuala_Lumpur",
            day: "numeric",
            month: "short",
          }),
          values,
          total,
          projectedTotal,
        };
      })
    : [];
  const totalRecorded = rows.reduce((sum, row) => sum + row.total, 0);
  const totalProjected = ai ? rows.reduce((sum, row) => sum + row.projectedTotal, 0) : totalRecorded;
  const activeDeltaPct = ai ? (metric === "revenue" ? ai.revenuePct : ai.volumePct) : 0;
  const animatedTotal = useAnimatedNumber(totalProjected, Boolean(ai), 1200, metric, ai?.revision);
  const animatedMetricPct = useAnimatedNumber(activeDeltaPct, Boolean(ai), 1200, metric, ai?.revision);
  const rawMax = Math.max(0, ...rows.map((row) => Math.max(row.total, row.projectedTotal)));
  const axisScale = metric === "revenue" ? niceAxisCeiling(rawMax / 100, 3, false) : niceAxisCeiling(rawMax, 3, true);
  const ceiling = metric === "revenue" ? axisScale.ceiling * 100 : axisScale.ceiling;
  const yLabels = axisScale.ticks.map((tick) => (metric === "revenue" ? formatAxisRM(tick) : String(tick)));
  const BAR_MAX_PX = 140;
  const format = (value: number) => (metric === "revenue" ? money(value) : String(value));
  const formatBarLabel = (value: number) => {
    if (value <= 0) return "";
    if (metric !== "revenue") return String(value);
    const rm = value / 100;
    if (rm >= 1000) return `${(rm / 1000).toFixed(1).replace(/\.0$/, "")}k`;
    return rm.toLocaleString("en-MY", { maximumFractionDigits: value % 100 === 0 ? 0 : 1 });
  };
  const active = orders.filter((order) => ["placed", "accepted", "preparing", "ready"].includes(order.status));
  const nowMs = Date.now();
  const dueNextHour = active.filter((order) => {
    const pickupMs = Date.parse(order.pickup_at);
    return Number.isFinite(pickupMs) && pickupMs + 900_000 >= nowMs && pickupMs <= nowMs + 3_600_000;
  }).length;
  const overduePickups = active.filter((order) => {
    const pickupMs = Date.parse(order.pickup_at);
    return Number.isFinite(pickupMs) && pickupMs + 900_000 < nowMs;
  }).length;
  const paceSummary = (stock: number, units: number) => {
    if (stock <= 0) return { text: "Out of stock", urgent: true };
    if (units <= 0 || days <= 0) return { text: `${stock} portions in stock`, urgent: stock <= 5 };
    const daysLeft = stock / (units / days);
    if (daysLeft < 1) return { text: "<1 day left at recent pace", urgent: true };
    if (daysLeft < 10)
      return { text: `~${daysLeft.toFixed(1)}d left at recent pace`, urgent: daysLeft <= 2.5 || stock <= 5 };
    return { text: `~${Math.round(daysLeft)}d left at recent pace`, urgent: stock <= 5 };
  };
  return (
    <div className="vendor-sales-overview">
      <div className="vendor-sales-report-row">
        <section className="vendor-sales-chart">
          <header>
            <div>
              <span className="vendor-section-label">SALES PERFORMANCE</span>
              <h2>
                {metric === "revenue" ? "Sales collected" : "Orders collected"}
                {ai && activeDeltaPct !== 0 && (
                  <span className={"ai-inline-delta " + (activeDeltaPct >= 0 ? "is-positive" : "is-negative")}>
                    {animatedMetricPct >= 0 ? "+" : ""}
                    {animatedMetricPct.toFixed(1)}% AI projected (
                    {metric === "revenue" ? money(Math.round(animatedTotal)) : Math.round(animatedTotal)})
                  </span>
                )}
              </h2>
              <p>
                {metric === "revenue"
                  ? "Gross receipts in MYR. Refunds and expenses are included in reports."
                  : "Orders with a collection receipt · count"}
              </p>
            </div>
            <div className="vendor-chart-metrics" role="group" aria-label="Sales chart metric">
              <button aria-pressed={metric === "revenue"} onClick={() => setMetric("revenue")}>
                Revenue
              </button>
              <button aria-pressed={metric === "collections"} onClick={() => setMetric("collections")}>
                Collections
              </button>
            </div>
          </header>
          <div className="vendor-sales-plot">
            <div className="vendor-sales-y-axis" aria-hidden="true">
              <div className="vendor-sales-y-ticks">
                {yLabels.map((label, index) => (
                  <span key={index}>{label}</span>
                ))}
              </div>
            </div>
            <div
              className="vendor-sales-chart-scroll"
              ref={scroll}
              tabIndex={0}
              role="region"
              aria-label="Daily sales bar chart"
            >
              <div
                className={"vendor-sales-bars" + (rows.length > 7 ? " is-wide" : "")}
                style={{
                  gridTemplateColumns:
                    "repeat(" + Math.max(1, rows.length) + ",minmax(" + (ai ? "44px" : "36px") + ",1fr))",
                }}
              >
                <div className="vendor-sales-gridlines" aria-hidden="true">
                  <span style={{ bottom: "33.333%" }} />
                  <span style={{ bottom: "66.667%" }} />
                  <span style={{ bottom: "100%" }} />
                </div>
                {rows.map((row, rowIndex) => {
                  const dayTitle = `${row.label}: ${format(row.total)} (${channels.map((ch, i) => `${labels[ch]} ${format(row.values[i])}`).join(", ")})${ai ? ` · AI: ${metric === "revenue" ? money(row.projectedTotal) : row.projectedTotal}` : ""}`;
                  const edgeClass =
                    rows.length > 1
                      ? rowIndex === 0
                        ? " is-first"
                        : rowIndex === rows.length - 1
                          ? " is-last"
                          : ""
                      : "";
                  const segmentHeights = stackedBarHeightsPx(row.values, ceiling, BAR_MAX_PX, 2);
                  return (
                    <div
                      className={"vendor-sales-day" + edgeClass}
                      key={row.key}
                      tabIndex={0}
                      title={dayTitle}
                      aria-label={dayTitle}
                    >
                      <div className="chart-tooltip" role="tooltip">
                        <strong>{row.label}</strong>
                        <span>Total: {format(row.total)}</span>
                        {channels.map((ch, i) =>
                          row.values[i] > 0 ? (
                            <small key={ch}>
                              {labels[ch]}: {format(row.values[i])}
                            </small>
                          ) : null,
                        )}
                        {ai && (
                          <small className="is-ai">
                            AI: {metric === "revenue" ? money(row.projectedTotal) : row.projectedTotal}
                          </small>
                        )}
                      </div>
                      <span className="vendor-sales-value">{formatBarLabel(row.total)}</span>
                      <div className={"vendor-sales-pair" + (ai ? " has-ai" : "")}>
                        <div
                          className="vendor-sales-stack"
                          role="img"
                          aria-label={row.label + ": " + format(row.total)}
                        >
                          {channels.map((channel, index) => (
                            <span
                              key={channel}
                              className={"sales-channel-" + channel}
                              style={{ height: segmentHeights[index] + "px" }}
                              title={labels[channel] + ": " + format(row.values[index])}
                            />
                          ))}
                        </div>
                        {ai && (
                          <div
                            className="vendor-sales-ai-bar"
                            style={{ height: barHeightPx(row.projectedTotal, ceiling, BAR_MAX_PX, 3) + "px" }}
                            title={
                              "AI Projected: " + (metric === "revenue" ? money(row.projectedTotal) : row.projectedTotal)
                            }
                          />
                        )}
                      </div>
                      <small>{row.label}</small>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="vendor-sales-legend">
            {channels.map((channel) => (
              <span key={channel}>
                <i className={"sales-channel-" + channel} />
                {labels[channel]}
              </span>
            ))}
            {ai && (
              <span>
                <i className="sales-channel-ai" />
                AI Projected
              </span>
            )}
          </div>
          {!report && <p className="vendor-insight-empty">Loading recorded sales…</p>}
          {report && !rows.some((row) => row.total > 0) && (
            <p className="vendor-sales-empty">
              No receipts in this period. Completed pickups will populate this chart.
            </p>
          )}
          <details className="vendor-sales-exact">
            <summary>View exact chart values</summary>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    {channels.map((channel) => (
                      <th key={channel}>{labels[channel]}</th>
                    ))}
                    <th>Total</th>
                    {ai && <th>AI Projected</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key}>
                      <th scope="row">{row.label}</th>
                      {row.values.map((value, index) => (
                        <td key={index}>{format(value)}</td>
                      ))}
                      <td>{format(row.total)}</td>
                      {ai && <td>{metric === "revenue" ? money(row.projectedTotal) : row.projectedTotal}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
        <section className="vendor-priority-panel" aria-label="FIF shift priorities">
          {priority}
          <div className="vendor-priority-queue">
            <span>
              <strong>{dueNextHour}</strong> due next hour
            </span>
            <span className={overduePickups ? "needs-attention" : ""}>
              <strong>{overduePickups}</strong> overdue
            </span>
          </div>
          <p className="vendor-priority-ready">
            {active.filter((order) => order.status === "ready").length} ready for collection ·{" "}
            {report ? menu.filter((item) => item.active).length : "—"} published menu items
          </p>
          <Link href="/vendor/orders" className="vendor-text-link">
            Open kitchen
            <ArrowUpRight size={15} aria-hidden />
          </Link>
        </section>
      </div>
      <VendorAnalyticsGrid report={report} />
      {children}
      <section className="vendor-menu-spotlight" aria-label="Best-selling menu items">
        <header>
          <div>
            <span className="vendor-section-label">MENU SPOTLIGHT</span>
            <h2>Your best-selling items</h2>
          </div>
          <Link href="/vendor/menu">
            Manage menu
            <ArrowUpRight size={15} aria-hidden />
          </Link>
        </header>
        <div className="vendor-product-highlights">
          {top.map((item) => {
            const sales = report?.products.find((product) => product.id === item.id);
            const photo = mealPhoto(item);
            const displayName = item.name.replace(/^\[Demo [^\]]+\]\s*/, "");
            const itemActions = ai?.actions.filter((action) => action.itemId === item.id) ?? [];
            const volPct = itemActions.reduce((sum, action) => sum + action.volumeChangePct, 0);
            const priceAction = itemActions.find(
              (action) => action.kind === "price" && action.proposedPriceSen !== undefined,
            );
            const highlighted = itemActions.length > 0;
            const pace = paceSummary(item.stock, sales?.units ?? 0);
            return (
              <Link
                key={item.id}
                href={"/vendor/menu?stall=" + vendorId + "&dish=" + encodeURIComponent(item.name)}
                className={"vendor-product-highlight" + (highlighted ? " is-ai-highlighted" : "")}
              >
                <div className="vendor-product-photo">
                  {photo ? <Image src={photo} alt="" width={72} height={72} /> : <Utensils size={23} aria-hidden />}
                </div>
                <div>
                  <strong title={item.name}>{displayName}</strong>
                  <span>{sales?.units ?? 0} units collected</span>
                  <span className={"vendor-product-pace" + (pace.urgent ? " is-urgent" : "")}>{pace.text}</span>
                  <div className="vendor-product-price-row">
                    <b>{money(item.price_sen - item.discount_sen)}</b>
                    {highlighted && (
                      <em className="ai-highlight-badge">
                        {priceAction?.proposedPriceSen
                          ? `Test ${money(priceAction.proposedPriceSen)}`
                          : `${volPct > 0 ? "+" : ""}${volPct}% demand`}
                      </em>
                    )}
                  </div>
                </div>
                <ArrowUpRight size={15} aria-hidden />
              </Link>
            );
          })}
        </div>
      </section>
      <section className="vendor-recent-orders">
        <header>
          <h2>Recent orders</h2>
          <Link href="/vendor/orders">
            Go to kitchen
            <ArrowUpRight size={15} aria-hidden />
          </Link>
        </header>
        {orders.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Items</th>
                  <th>Received · MYT</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {orders
                  .slice()
                  .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
                  .slice(0, 5)
                  .map((order) => (
                    <tr key={order.id}>
                      <th scope="row">#{order.id.slice(0, 8).toUpperCase()}</th>
                      <td>{order.lines.reduce((sum, line) => sum + line.quantity, 0)}</td>
                      <td>
                        {new Date(order.created_at).toLocaleString("en-MY", {
                          timeZone: "Asia/Kuala_Lumpur",
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>
                      <td>{money(order.total_sen)}</td>
                      <td>
                        <span className="vendor-order-state">{statusNames[order.status]}</span>
                      </td>
                      <td>
                        <Link href={"/vendor/orders/" + order.id}>
                          Open order
                          <ArrowUpRight size={14} aria-hidden />
                        </Link>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="vendor-insight-empty">New orders will appear here.</p>
        )}
      </section>
    </div>
  );
}
