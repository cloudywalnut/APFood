"use client";
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { money } from "../../lib/orders";
import { adminLink, collectionRate, type AdminOverview, type AdminScope } from "../../lib/admin-dashboard";
import { niceAxisCeiling, formatAxisRM } from "../../lib/chart-scale";
import { useAnimatedNumber } from "../hosted/use-animated-number";
import { adminDailyPreview, type AdminOptimization } from "../../lib/admin-intelligence";
export function AdminCard({
  eyebrow,
  title,
  children,
  action,
  className = "",
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`admin-card ${className}`}>
      <header>
        <div>
          <span className="admin-eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
export function AdminNumber({
  value,
  moneyValue = false,
  digits = 0,
}: {
  value: number;
  moneyValue?: boolean;
  digits?: number;
}) {
  const n = useAnimatedNumber(value, true, 650);
  return (
    <>
      {moneyValue
        ? money(Math.round(n))
        : n.toLocaleString("en-MY", { minimumFractionDigits: digits, maximumFractionDigits: digits })}
    </>
  );
}
export function FinanceTrend({
  data,
  scope,
  optimization,
}: {
  data: AdminOverview;
  scope: AdminScope;
  optimization?: AdminOptimization;
}) {
  const [metric, setMetric] = useState<"netSen" | "receiptsSen" | "costsSen">("netSen");
  const values = data.daily.map((d) => d[metric]);
  const preview = adminDailyPreview(data, optimization);
  const projected = preview.map((d) =>
    metric === "netSen" ? d.optimizedNetSen : metric === "receiptsSen" ? d.optimizedReceiptsSen : d.optimizedCostsSen,
  );
  const hasPreview = !!optimization && optimization.recoveredOrders > 0;
  const allValues = hasPreview ? [...values, ...projected] : values;
  const max = niceAxisCeiling(Math.max(0, ...allValues) / 100, 3).ceiling;
  const min = Math.min(0, ...allValues) < 0 ? -niceAxisCeiling(-Math.min(...allValues) / 100, 2).ceiling : 0;
  const y = (v: number) => 100 - ((v / 100 - min) / (max - min)) * 100,
    x = (i: number) => (i / Math.max(1, values.length - 1)) * 100;
  const ticks = Array.from({ length: 4 }, (_, i) => min + ((max - min) * i) / 3);
  return (
    <AdminCard
      eyebrow="COMBINED VENDOR FINANCES"
      title="Financial performance"
      action={
        <select
          aria-label="Financial chart metric"
          value={metric}
          onChange={(e) => setMetric(e.target.value as typeof metric)}
        >
          <option value="netSen">Net cashflow</option>
          <option value="receiptsSen">Collected receipts</option>
          <option value="costsSen">Expenses + refunds, net of reversals</option>
        </select>
      }
    >
      {hasPreview && (
        <p className="admin-card-copy admin-fif-delta">
          FIF Optimized overlays the selected recovery plan. Recorded values remain the dashed baseline.
        </p>
      )}
      <div
        className="admin-line-chart"
        role="img"
        aria-label={`${metric === "netSen" ? "Net cashflow" : metric === "receiptsSen" ? "Receipts" : "Costs"}, daily values for selected period; exact values below.`}
      >
        <div className="admin-chart-axis">
          {ticks
            .slice()
            .reverse()
            .map((n, i) => (
              <span key={i}>
                {n < 0 ? "−" : ""}
                {formatAxisRM(Math.abs(n))}
              </span>
            ))}
        </div>
        <div className="admin-chart-canvas">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {ticks.map((v, i) => (
              <line
                key={i}
                x1="0"
                x2="100"
                y1={y(v * 100)}
                y2={y(v * 100)}
                stroke="#e9dfcc"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <line x1="0" x2="100" y1={y(0)} y2={y(0)} stroke="#c5b99d" vectorEffect="non-scaling-stroke" />
            <polyline
              points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
              fill="none"
              stroke={hasPreview ? "#8c9299" : "#b28a22"}
              strokeDasharray={hasPreview ? "5 4" : undefined}
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
            />
            {hasPreview && (
              <polyline
                points={projected.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
                fill="none"
                stroke="#b28a22"
                strokeWidth="2.5"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {values.length === 1 && <circle cx="50" cy={y(values[0])} r="2" fill="#b28a22" />}
          </svg>
          <div className="admin-chart-dates">
            <span>{data.daily[0]?.day.slice(5)}</span>
            <span>{data.daily.at(-1)?.day.slice(5)}</span>
          </div>
        </div>
      </div>
      <details className="admin-exact">
        <summary>View exact daily values</summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date · MYT</th>
                <th>Receipts</th>
                <th>Net costs</th>
                <th>Net cashflow</th>
                {hasPreview && (
                  <th>
                    FIF Optimized ·{" "}
                    {metric === "netSen" ? "net cashflow" : metric === "receiptsSen" ? "receipts" : "net costs"}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {data.daily.map((d, i) => (
                <tr key={d.day}>
                  <th>{d.day}</th>
                  <td>{money(d.receiptsSen)}</td>
                  <td>{money(d.costsSen)}</td>
                  <td>{money(d.netSen)}</td>
                  {hasPreview && <td>{money(projected[i])}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <footer>
        Cash-basis vendor performance, including recorded shared overhead.{" "}
        {hasPreview && "Preview allocation follows recorded receipt volume; it is not newly observed daily income. "}
        <Link href={adminLink("cashflow", scope)}>Open ledger →</Link>
      </footer>
    </AdminCard>
  );
}
export function VendorComparison({
  data,
  scope,
  optimization,
}: {
  data: AdminOverview;
  scope: AdminScope;
  optimization?: AdminOptimization;
}) {
  const [metric, setMetric] = useState("net");
  const hasPreview = !!optimization && optimization.recoveredOrders > 0;
  const rows = useMemo(
    () =>
      data.vendors
        .map((v) => {
          const e = optimization?.byVendor[v.id],
            recovered = e?.recoveredOrders ?? 0;
          const recorded =
            metric === "net"
              ? v.netSen
              : metric === "receipts"
                ? v.receiptsSen
                : metric === "orders"
                  ? v.orders
                  : metric === "collections"
                    ? v.collected
                    : collectionRate(v.collected, v.closed);
          const value =
            recorded === null
              ? null
              : metric === "net"
                ? recorded + (e?.netSen ?? 0)
                : metric === "receipts"
                  ? recorded + (e?.receiptsSen ?? 0)
                  : metric === "collections"
                    ? recorded + recovered
                    : metric === "fulfilment" && v.closed
                      ? Math.min(100, ((v.collected + recovered) / v.closed) * 100)
                      : recorded;
          return { v, recorded, value };
        })
        .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity)),
    [data, metric, optimization],
  );
  const max = Math.max(1, ...rows.flatMap((r) => [Math.abs(r.value ?? 0), Math.abs(r.recorded ?? 0)]));
  const format = (value: number | null) =>
    value === null
      ? "No closed orders"
      : metric === "net" || metric === "receipts"
        ? money(value)
        : metric === "fulfilment"
          ? value.toFixed(1) + "%"
          : value.toLocaleString("en-MY");
  return (
    <AdminCard
      eyebrow="CAMPUS STALL COMPARISON"
      title="Where performance stands"
      action={
        <select aria-label="Compare vendors by" value={metric} onChange={(e) => setMetric(e.target.value)}>
          <option value="net">Net cashflow</option>
          <option value="receipts">Receipts</option>
          <option value="orders">Orders placed</option>
          <option value="collections">Collections</option>
          <option value="fulfilment">Collection rate</option>
        </select>
      }
    >
      {hasPreview && (
        <p className="admin-card-copy admin-fif-delta">
          FIF Optimized preview · recorded baseline shown below each estimate
        </p>
      )}
      <div className="admin-compare">
        {rows.map(({ v, value, recorded }, i) => (
          <Link href={adminLink("vendors", scope, v.id)} key={v.id}>
            <div>
              <span>
                <small>{i + 1}.</small> {v.name}
              </span>
              <strong>{format(value)}</strong>
            </div>
            {hasPreview && value !== recorded && (
              <small className="admin-recorded-reference">
                Recorded {format(recorded)} · FIF Optimized {format(value)}
              </small>
            )}
            <span className="admin-bar-track">
              <i
                className={(value ?? 0) < 0 ? "negative" : ""}
                style={{ width: (Math.abs(value ?? 0) / max) * 100 + "%" }}
              />
              {hasPreview && (
                <i className="admin-recorded-bar" style={{ width: (Math.abs(recorded ?? 0) / max) * 100 + "%" }} />
              )}
            </span>
          </Link>
        ))}
      </div>
      <footer>
        Ranked by {hasPreview ? "the FIF Optimized preview for" : "recorded values of"} the selected metric. Placed
        orders remain recorded facts; recovery changes potential collections, not actual order creation.
      </footer>
    </AdminCard>
  );
}
export function DemandAndOutcomes({
  data,
  scope,
  optimization,
}: {
  data: AdminOverview;
  scope: AdminScope;
  optimization?: AdminOptimization;
}) {
  const max = Math.max(1, ...data.demand.map((d) => d.orders));
  const [hour, setHour] = useState<number>();
  const total = data.statuses.reduce((sum, s) => sum + s.count, 0);
  const collected = data.statuses.find((s) => s.status === "collected")?.count ?? 0;
  const active = data.statuses
    .filter((s) => ["placed", "accepted", "preparing", "ready"].includes(s.status))
    .reduce((n, s) => n + s.count, 0);
  const cancelled = total - collected - active;
  const recovered = Math.min(cancelled, optimization?.recoveredOrders ?? 0);
  const counts = [
    ["Collected", collected + recovered, "#bd972b"],
    ["In progress", active, "#73563b"],
    ["Cancelled / rejected", cancelled - recovered, "#cdc1aa"],
  ] as const;
  let offset = 0;
  const fill = counts
    .map(([, n, c]) => {
      const start = offset;
      offset += total ? (n / total) * 100 : 0;
      return `${c} ${start}% ${offset}%`;
    })
    .join(",");
  return (
    <>
      <AdminCard eyebrow="PICKUP DEMAND · MYT" title="When the cafeteria gets busy">
        <p className="admin-card-copy">Scheduled pickup hours of non-cancelled orders created in this period.</p>
        {optimization && (
          <p className="admin-card-copy admin-fif-delta">
            FIF's selected plan models {recovered} additional collections in this period. Use observed peak times to
            review staffing; this recorded heatmap is not changed by an estimate.
          </p>
        )}
        <div className="admin-heat-scroll">
          <div className="admin-heatmap">
            <span />
            {Array.from({ length: 12 }, (_, i) => (
              <span key={i}>{i + 8}</span>
            ))}
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, d) => (
              <div className="admin-heat-row" key={day}>
                <span>{day}</span>
                {Array.from({ length: 12 }, (_, i) => {
                  const count = data.demand.find((r) => r.weekday === d + 1 && r.hour === i + 8)?.orders ?? 0;
                  return (
                    <button
                      key={i}
                      title={`${day} ${i + 8}:00 · ${count} orders`}
                      aria-label={`${day} ${i + 8}:00, ${count} orders. Review traffic.`}
                      onClick={() => setHour(i + 8)}
                      style={{ background: `rgba(190,146,32,${0.07 + (count / max) * 0.85})` }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        {hour !== undefined && (
          <p className="admin-card-copy">
            Selected {hour}:00 MYT. <Link href={adminLink("traffic", scope)}>Review current scheduled pickups →</Link>
          </p>
        )}
        <footer>
          Colour represents observed booked demand, not measured physical crowds. Hours shown: 08:00–19:59.
        </footer>
      </AdminCard>
      <AdminCard eyebrow="FULFILMENT MIX" title="Order outcomes">
        {recovered > 0 && (
          <p className="admin-card-copy admin-fif-delta">
            FIF Optimized replay · {recovered} unsuccessful orders potentially recovered
          </p>
        )}
        <div className="admin-outcomes">
          <div
            className="admin-ring"
            style={{ background: total ? `conic-gradient(${fill})` : "#eee7d9" }}
            role="img"
            aria-label={counts.map(([label, n]) => `${label}: ${n}`).join(", ")}
          >
            <span>
              <strong>{total ? Math.round(((collected + recovered) / total) * 100) : 0}%</strong>
              <small>{recovered ? "FIF Optimized" : "of orders collected"}</small>
            </span>
          </div>
          <dl>
            {counts.map(([label, n, c]) => (
              <div key={label}>
                <dt>
                  <i style={{ background: c }} />
                  {label}
                </dt>
                <dd>{n.toLocaleString("en-MY")}</dd>
              </div>
            ))}
          </dl>
        </div>
        <footer>
          {recovered
            ? `Recorded outcomes: ${collected} collected, ${active} in progress and ${cancelled} unsuccessful. The preview replays the selected recovery assumption, not completed changes. `
            : "Current status of orders created in the selected period. "}
          Collection-rate cards use closed orders only.
        </footer>
      </AdminCard>
    </>
  );
}
