"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Sparkles, Utensils } from "lucide-react";
import type { hostedData } from "../../lib/backend/client";
import type { OrderRow } from "../../lib/backend/contracts";
import type { ScenarioAction } from "../../lib/fif-scenarios";
import { money, statusNames } from "../../lib/demo";
import { mealPhoto } from "../storefront/catalogue";
import { useAnimatedNumber } from "./use-animated-number";
import { VendorAnalyticsGrid } from "./vendor-analytics-grid";

type Report = Awaited<ReturnType<typeof hostedData.vendorReport>>;
type Meal = Awaited<ReturnType<typeof hostedData.vendorMenu>>[number];
type AiOverlay = {
  actions: ScenarioAction[];
  revenuePct: number;
  volumePct: number;
  revenueDeltaSen: number;
  effortPct: number;
};
const channels = ["counter", "duitnow_qr", "demo"] as const;
const labels = { counter: "Counter", duitnow_qr: "DuitNow QR", demo: "Prepaid" };
const mytDay = (date: string | number) => new Date(date).toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });

export function VendorSalesOverview({ report, menu, orders, days, vendorId, ai, children }: { children?: ReactNode; report?: Report; menu: Meal[]; orders: OrderRow[]; days: number; vendorId: string; ai?: AiOverlay }) {
  const [metric, setMetric] = useState<"revenue" | "collections">("revenue");
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => { if (scroll.current) scroll.current.scrollLeft = scroll.current.scrollWidth; }, [days]);
  const top = menu.filter(item => item.active).slice().sort((a, b) => (report?.products.find(product => product.id === b.id)?.units ?? 0) - (report?.products.find(product => product.id === a.id)?.units ?? 0)).slice(0, 4);
  const rows = report ? Array.from({ length: days }, (_, index) => {
    const day = Date.parse(report.since) + index * 86400_000;
    const entries = report.ledger.filter(entry => mytDay(entry.created_at) === mytDay(day));
    const values = channels.map(channel => metric === "revenue" ? entries.filter(entry => entry.kind === channel).reduce((sum, entry) => sum + entry.amount_sen, 0) : new Set(entries.filter(entry => entry.kind === channel && entry.order_id).map(entry => entry.order_id)).size);
    const total = values.reduce((sum, value) => sum + value, 0);
    const activePct = ai ? (metric === "revenue" ? ai.revenuePct : ai.volumePct) : 0;
    const factor = ai ? Math.max(0, 1 + activePct / 100) : 1;
    const projectedTotal = ai ? (metric === "revenue" ? Math.round(total * factor) : Math.round(total * factor * 10) / 10) : total;
    return { key: mytDay(day), label: new Date(day).toLocaleDateString("en-MY", { timeZone: "Asia/Kuala_Lumpur", day: "numeric", month: "short" }), values, total, projectedTotal };
  }) : [];
  const totalRecorded = rows.reduce((sum, row) => sum + row.total, 0);
  const totalProjected = ai ? rows.reduce((sum, row) => sum + row.projectedTotal, 0) : totalRecorded;
  const activeDeltaPct = ai ? (metric === "revenue" ? ai.revenuePct : ai.volumePct) : 0;
  const animatedTotal = useAnimatedNumber(totalProjected, Boolean(ai), 950, metric);
  const animatedMetricPct = useAnimatedNumber(activeDeltaPct, Boolean(ai), 950, metric);
  const animatedRevPct = useAnimatedNumber(ai?.revenuePct ?? 0, Boolean(ai), 950);
  const ceiling = Math.max(1, ...rows.map(row => Math.max(row.total, row.projectedTotal))) * 1.15;
  const format = (value: number) => metric === "revenue" ? money(value) : String(value);
  const active = orders.filter(order => ["placed", "accepted", "preparing", "ready"].includes(order.status));
  return <div className="vendor-sales-overview">
    <div className="vendor-product-highlights">{top.map(item => {
      const sales = report?.products.find(product => product.id === item.id);
      const photo = mealPhoto(item);
      const displayName = item.name.replace(/^\[Demo [^\]]+\]\s*/, "");
      const itemActions = ai?.actions.filter(action => action.itemId === item.id) ?? [];
      const volPct = itemActions.reduce((sum, action) => sum + action.volumeChangePct, 0);
      const priceAction = itemActions.find(action => action.kind === "price" && action.proposedPriceSen !== undefined);
      const highlighted = itemActions.length > 0;
      return <Link key={item.id} href={"/vendor/menu?stall=" + vendorId + "&dish=" + encodeURIComponent(item.name)} className={"vendor-product-highlight" + (highlighted ? " is-ai-highlighted" : "")}><div className="vendor-product-photo">{photo ? <Image src={photo} alt="" width={72} height={72} /> : <Utensils size={23} aria-hidden />}</div><div><strong title={item.name}>{displayName}</strong><span>{sales?.units ?? 0} units collected</span><div className="vendor-product-price-row"><b>{money(item.price_sen - item.discount_sen)}</b>{highlighted && <em className="ai-highlight-badge"><Sparkles size={11} aria-hidden />{priceAction?.proposedPriceSen ? `Test ${money(priceAction.proposedPriceSen)}` : `${volPct > 0 ? "+" : ""}${volPct}% demand`}</em>}</div></div><ArrowUpRight size={15} aria-hidden /></Link>;
    })}</div>
    <div className="vendor-sales-report-row"><section className="vendor-sales-chart"><header><div><span className="vendor-section-label">SALES PERFORMANCE</span><h2>{metric === "revenue" ? "Recorded receipts by day" : "Completed collections by day"}{ai && activeDeltaPct !== 0 && <span className={"ai-inline-delta " + (activeDeltaPct >= 0 ? "is-positive" : "is-negative")}>{animatedMetricPct >= 0 ? "+" : ""}{animatedMetricPct.toFixed(1)}% AI projected ({metric === "revenue" ? money(Math.round(animatedTotal)) : Math.round(animatedTotal)})</span>}</h2><p>{metric === "revenue" ? "Gross receipts · MYR · refunds and expenses shown in reports" : "Orders with a collection receipt · count"}</p></div><div className="vendor-chart-metrics" role="group" aria-label="Sales chart metric"><button aria-pressed={metric === "revenue"} onClick={() => setMetric("revenue")}>Revenue</button><button aria-pressed={metric === "collections"} onClick={() => setMetric("collections")}>Collections</button></div></header>
      <div className="vendor-sales-chart-scroll" ref={scroll} tabIndex={0} role="region" aria-label="Daily sales bar chart"><div className="vendor-sales-bars" style={{ gridTemplateColumns: "repeat(" + Math.max(1, rows.length) + ",minmax(" + (ai ? "38px" : "28px") + ",1fr))" }}>{rows.map(row => <div className="vendor-sales-day" key={row.key}><span className="vendor-sales-value">{row.total > 0 ? metric === "revenue" ? (row.total / 100).toLocaleString("en-MY", { maximumFractionDigits: 1 }) : row.total : ""}</span><div className={"vendor-sales-pair" + (ai ? " has-ai" : "")}><div className="vendor-sales-stack" role="img" aria-label={row.label + ": " + format(row.total)}>{channels.map((channel, index) => <span key={channel} className={"sales-channel-" + channel} style={{ height: row.values[index] / ceiling * 140 + "px" }} title={labels[channel] + ": " + format(row.values[index])} />)}</div>{ai && <div className="vendor-sales-ai-bar" style={{ height: row.projectedTotal / ceiling * 140 + "px" }} title={"AI Projected: " + (metric === "revenue" ? money(row.projectedTotal) : row.projectedTotal)} />}</div><small>{row.label}</small></div>)}</div></div>
      <div className="vendor-sales-legend">{channels.map(channel => <span key={channel}><i className={"sales-channel-" + channel} />{labels[channel]}</span>)}{ai && <span><i className="sales-channel-ai" />AI Projected</span>}</div>
      {!report && <p className="vendor-insight-empty">Loading recorded sales…</p>}{report && !rows.some(row => row.total > 0) && <p className="vendor-sales-empty">No receipts in this period. Completed pickups will populate this chart.</p>}
      <details className="vendor-sales-exact"><summary>View exact chart values</summary><div className="table-wrap"><table><thead><tr><th>Date</th>{channels.map(channel => <th key={channel}>{labels[channel]}</th>)}<th>Total</th>{ai && <th>AI Projected</th>}</tr></thead><tbody>{rows.map(row => <tr key={row.key}><th scope="row">{row.label}</th>{row.values.map((value, index) => <td key={index}>{format(value)}</td>)}<td>{format(row.total)}</td>{ai && <td>{metric === "revenue" ? money(row.projectedTotal) : row.projectedTotal}</td>}</tr>)}</tbody></table></div></details>
    </section><section className="vendor-product-stats"><span className="vendor-section-label">OPERATIONS SNAPSHOT</span><h2>Product and order details</h2><dl>{[["Low-stock products", menu.filter(item => item.active && item.stock <= 5).length], ["Published menu items", menu.filter(item => item.active).length], ["Active orders", active.length], ["Ready for collection", active.filter(order => order.status === "ready").length]].map(([label, count]) => <div key={label}><dt>{label}</dt><dd>{count}</dd></div>)}</dl>{ai && ai.actions.length > 0 && <div className="ai-snapshot-note"><Sparkles size={13} aria-hidden /><span>{ai.actions.length} AI actions active · {animatedRevPct >= 0 ? "+" : ""}{animatedRevPct.toFixed(1)}% rev · {ai.effortPct > 0 ? "+" : ""}{ai.effortPct}% prep</span></div>}<Link href="/vendor/menu">Manage your menu<ArrowUpRight size={15} aria-hidden /></Link></section></div>
    <VendorAnalyticsGrid report={report} />
    {children}
    <section className="vendor-recent-orders"><header><h2>Recent orders</h2><Link href="/vendor/orders">Go to kitchen<ArrowUpRight size={15} aria-hidden /></Link></header>{orders.length ? <div className="table-wrap"><table><thead><tr><th>Order</th><th>Items</th><th>Received · MYT</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>{orders.slice().sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 5).map(order => <tr key={order.id}><th scope="row">#{order.id.slice(0, 8).toUpperCase()}</th><td>{order.lines.reduce((sum, line) => sum + line.quantity, 0)}</td><td>{new Date(order.created_at).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur", dateStyle: "medium", timeStyle: "short" })}</td><td>{money(order.total_sen)}</td><td><span className="vendor-order-state">{statusNames[order.status]}</span></td><td><Link href={"/vendor/orders/" + order.id}>Open order<ArrowUpRight size={14} aria-hidden /></Link></td></tr>)}</tbody></table></div> : <p className="vendor-insight-empty">New orders will appear here.</p>}</section>
  </div>;
}
