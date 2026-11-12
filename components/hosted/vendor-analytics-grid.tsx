"use client";

import type { hostedData } from "../../lib/backend/client";
import { barHeightPx, cleanMenuName, formatShortMytDate, niceAxisCeiling } from "../../lib/chart-scale";

type Report = Awaited<ReturnType<typeof hostedData.vendorReport>>;

export function VendorAnalyticsGrid({ report }: { report?: Report }) {
  const data = report?.analytics;
  const daily = data?.daily ?? [];
  const total = daily.reduce((sum, row) => sum + row.count, 0);
  const collected = data?.statuses.find((row) => row.status === "collected")?.count ?? 0;
  const cancelled =
    data?.statuses
      .filter((row) => ["cancelled", "rejected"].includes(row.status))
      .reduce((sum, row) => sum + row.count, 0) ?? 0;
  const active = Math.max(0, total - collected - cancelled);
  const collectedPct = total ? (collected / total) * 100 : 0;
  const activePct = total ? (active / total) * 100 : 0;
  const cancelledPct = total ? (cancelled / total) * 100 : 0;

  const rawMaxOrders = Math.max(0, ...daily.map((row) => row.count));
  const orderScale = niceAxisCeiling(rawMaxOrders, 2, true);
  const points = daily.map((row, index) => ({
    xPct: daily.length === 1 ? 50 : (index / (daily.length - 1)) * 100,
    yPct: 100 - (row.count / orderScale.ceiling) * 100,
    shortDay: formatShortMytDate(row.day),
    ...row,
  }));
  const midPoint = points.length >= 3 ? points[Math.floor((points.length - 1) / 2)] : undefined;

  const top =
    report?.products
      .filter((product) => product.units > 0)
      .slice()
      .sort((a, b) => b.units - a.units)
      .slice(0, 5) ?? [];
  const maxUnits = Math.max(1, ...top.map((product) => product.units));

  const hours = Array.from({ length: 12 }, (_, index) => ({
    label: String(index * 2).padStart(2, "0"),
    count: (data?.hours[index * 2]?.count ?? 0) + (data?.hours[index * 2 + 1]?.count ?? 0),
  }));
  const rawMaxHour = Math.max(0, ...hours.map((hour) => hour.count));
  const hourScale = niceAxisCeiling(rawMaxHour, 2, true);
  const HOUR_BAR_MAX_PX = 95;

  if (!data)
    return (
      <section className="vendor-mini-chart">
        <p className="vendor-chart-placeholder">Loading order analytics from the selected reporting period…</p>
      </section>
    );

  return (
    <div className="vendor-analytics-grid">
      <section className="vendor-mini-chart">
        <header>
          <div>
            <span className="vendor-section-label">DEMAND TREND</span>
            <h2>Orders placed</h2>
          </div>
          <strong>
            {total}
            <small>orders</small>
          </strong>
        </header>
        {daily.length ? (
          <>
            <div className="vendor-line-plot">
              <div className="vendor-mini-y-axis" aria-hidden="true">
                <span>{orderScale.ticks[2]}</span>
                <span>{orderScale.ticks[1]}</span>
                <span>{orderScale.ticks[0]}</span>
              </div>
              <div
                className="vendor-order-line"
                role="img"
                aria-label={"Daily orders: " + (daily.map((row) => row.day + ": " + row.count).join(", ") || "none")}
              >
                <div className="vendor-line-grid" aria-hidden="true">
                  <span style={{ top: "0%" }} />
                  <span style={{ top: "50%" }} />
                  <span style={{ top: "100%" }} />
                </div>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  {points.length > 1 && (
                    <>
                      <polygon
                        points={"0,100 " + points.map((point) => point.xPct + "," + point.yPct).join(" ") + " 100,100"}
                        fill="#faf1d5"
                      />
                      <polyline
                        points={points.map((point) => point.xPct + "," + point.yPct).join(" ")}
                        fill="none"
                        stroke="#b88b24"
                        strokeWidth="2.5"
                        vectorEffect="non-scaling-stroke"
                      />
                    </>
                  )}
                </svg>
                {points.map((point, index) => {
                  const edgeClass =
                    points.length > 1
                      ? index === 0
                        ? " is-first"
                        : index === points.length - 1
                          ? " is-last"
                          : ""
                      : "";
                  const topClass = point.yPct < 35 ? " is-top" : "";
                  const label = `${point.shortDay}: ${point.count} ${point.count === 1 ? "order" : "orders"}`;
                  return (
                    <div
                      key={point.day}
                      className={
                        "vendor-line-dot" +
                        edgeClass +
                        topClass +
                        (point.count === rawMaxOrders && rawMaxOrders > 0 ? " is-peak" : "")
                      }
                      style={{ left: point.xPct + "%", top: point.yPct + "%" }}
                      tabIndex={0}
                      title={label}
                      aria-label={label}
                    >
                      <div className="chart-tooltip" role="tooltip">
                        <strong>{point.shortDay}</strong>
                        <span>
                          {point.count} {point.count === 1 ? "order" : "orders"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className={"vendor-line-range" + (points.length <= 1 ? " is-single" : "")}>
              <span>{points[0]?.shortDay}</span>
              {midPoint && <span>{midPoint.shortDay}</span>}
              {points.length > 1 && <span>{points.at(-1)?.shortDay}</span>}
            </div>
          </>
        ) : (
          <p className="vendor-chart-placeholder">Orders in the selected period will populate this trend.</p>
        )}
        <footer>Orders created in the reporting period · all statuses</footer>
      </section>

      <section className="vendor-mini-chart">
        <header>
          <div>
            <span className="vendor-section-label">FULFILMENT MIX</span>
            <h2>Order outcomes</h2>
          </div>
        </header>
        <div className="vendor-order-mix">
          <div
            className="vendor-donut"
            role="img"
            aria-label={collected + " collected, " + active + " in progress, " + cancelled + " cancelled or rejected"}
            style={{
              background: total
                ? "conic-gradient(#c99d24 0% " +
                  collectedPct +
                  "%,#76593e " +
                  collectedPct +
                  "% " +
                  (collectedPct + activePct) +
                  "%,#cfc3b0 " +
                  (collectedPct + activePct) +
                  "% 100%)"
                : "#efe9dc",
            }}
          >
            <span>
              <strong>{total ? `${Math.round(collectedPct)}%` : "0"}</strong>
              <small>{total ? "collected" : "orders"}</small>
            </span>
          </div>
          <dl>
            <div>
              <dt>
                <i className="mix-collected" />
                Collected
              </dt>
              <dd>
                {collected}
                {total > 0 && <small> ({Math.round(collectedPct)}%)</small>}
              </dd>
            </div>
            <div>
              <dt>
                <i className="mix-active" />
                In progress
              </dt>
              <dd>
                {active}
                {total > 0 && <small> ({Math.round(activePct)}%)</small>}
              </dd>
            </div>
            <div>
              <dt>
                <i className="mix-cancelled" />
                Cancelled / rejected
              </dt>
              <dd>
                {cancelled}
                {total > 0 && <small> ({Math.round(cancelledPct)}%)</small>}
              </dd>
            </div>
          </dl>
        </div>
        <footer>Current status of orders created in the period</footer>
      </section>

      <section className="vendor-mini-chart">
        <header>
          <div>
            <span className="vendor-section-label">BEST SELLERS</span>
            <h2>Products by units collected</h2>
          </div>
        </header>
        {top.length ? (
          <div className="vendor-product-bars">
            {top.map((product) => {
              const displayName = cleanMenuName(product.name);
              const pct = Math.max(4, (product.units / maxUnits) * 100);
              return (
                <div key={product.id} title={`${product.name}: ${product.units} units`}>
                  <span>{displayName}</span>
                  <div>
                    <i style={{ width: pct + "%" }} />
                  </div>
                  <strong>{product.units}</strong>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="vendor-chart-placeholder">Collected orders will reveal your best-selling products.</p>
        )}
        <footer>Collected sales only · selected reporting period</footer>
      </section>

      <section className="vendor-mini-chart">
        <header>
          <div>
            <span className="vendor-section-label">PICKUP PATTERN</span>
            <h2>Scheduled pickups by time</h2>
          </div>
          {rawMaxHour > 0 && (
            <strong>
              {rawMaxHour}
              <small>peak slot</small>
            </strong>
          )}
        </header>
        <div className="vendor-hour-plot">
          <div className="vendor-hour-y-axis" aria-hidden="true">
            <span>{hourScale.ticks[2]}</span>
            <span>{hourScale.ticks[1]}</span>
            <span>{hourScale.ticks[0]}</span>
          </div>
          <div className="vendor-hour-bars" role="group" aria-label="Scheduled pickups by two-hour MYT windows">
            <div className="vendor-hour-grid" aria-hidden="true">
              <span style={{ bottom: "50%" }} />
              <span style={{ bottom: "100%" }} />
            </div>
            {hours.map((hour, index) => {
              const endLabel = String(Number(hour.label) + 2).padStart(2, "0");
              const slotLabel = `${hour.label}:00–${endLabel}:00 MYT · ${hour.count} ${hour.count === 1 ? "order" : "orders"}`;
              const isPeak = rawMaxHour > 0 && hour.count === rawMaxHour;
              const edgeClass = index === 0 ? " is-first" : index === hours.length - 1 ? " is-last" : "";
              return (
                <div
                  key={hour.label}
                  className={"vendor-hour-slot" + edgeClass + (isPeak ? " is-peak" : "")}
                  tabIndex={0}
                  title={slotLabel}
                  aria-label={slotLabel}
                >
                  <div className="chart-tooltip" role="tooltip">
                    <strong>
                      {hour.label}:00–{endLabel}:00
                    </strong>
                    <span>
                      {hour.count} {hour.count === 1 ? "order" : "orders"}
                    </span>
                  </div>
                  <span>{hour.count || ""}</span>
                  <div>
                    <i style={{ height: barHeightPx(hour.count, hourScale.ceiling, HOUR_BAR_MAX_PX, 3) + "px" }} />
                  </div>
                  <small>{hour.label}</small>
                </div>
              );
            })}
          </div>
        </div>
        <footer>Two-hour MYT windows · excludes cancellations; includes upcoming pickups</footer>
      </section>

      <details className="vendor-analytics-values">
        <summary>View exact order analytics</summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date · MYT</th>
                <th>Orders placed</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((row) => (
                <tr key={row.day}>
                  <th scope="row">{row.day}</th>
                  <td>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
