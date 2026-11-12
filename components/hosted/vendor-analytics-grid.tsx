"use client";

import type { hostedData } from "../../lib/backend/client";
type Report = Awaited<ReturnType<typeof hostedData.vendorReport>>;

export function VendorAnalyticsGrid({ report }: { report?: Report }) {
  const data = report?.analytics;
  const total = data?.daily.reduce((sum, row) => sum + row.count, 0) ?? 0;
  const collected = data?.statuses.find(row => row.status === "collected")?.count ?? 0;
  const cancelled = data?.statuses.filter(row => ["cancelled", "rejected"].includes(row.status)).reduce((sum, row) => sum + row.count, 0) ?? 0;
  const active = total - collected - cancelled;
  const collectedPct = total ? collected / total * 100 : 0;
  const activePct = total ? active / total * 100 : 0;
  const maxOrders = Math.max(1, ...(data?.daily.map(row => row.count) ?? []));
  const points = data?.daily.map((row, index) => ({ x: data.daily.length === 1 ? 250 : 15 + index / (data.daily.length - 1) * 470, y: 125 - row.count / maxOrders * 100, ...row })) ?? [];
  const top = report?.products.filter(product => product.units > 0).slice().sort((a, b) => b.units - a.units).slice(0, 5) ?? [];
  const maxUnits = Math.max(1, ...top.map(product => product.units));
  const hours = Array.from({ length: 12 }, (_, index) => ({ label: String(index * 2).padStart(2, "0"), count: (data?.hours[index * 2]?.count ?? 0) + (data?.hours[index * 2 + 1]?.count ?? 0) }));
  const maxHour = Math.max(1, ...hours.map(hour => hour.count));
  if (!data) return <section className="vendor-mini-chart"><p className="vendor-chart-placeholder">Loading order analytics from the selected reporting period…</p></section>;
  return <div className="vendor-analytics-grid">
    <section className="vendor-mini-chart"><header><div><span className="vendor-section-label">DEMAND TREND</span><h2>Orders placed</h2></div><strong>{total}<small>orders</small></strong></header><div className="vendor-order-line" role="img" aria-label={"Daily orders: " + (data?.daily.map(row => row.day + ": " + row.count).join(", ") ?? "loading")}><svg viewBox="0 0 500 145" preserveAspectRatio="none" aria-hidden="true">{[25, 75, 125].map(y => <line key={y} x1="15" y1={y} x2="485" y2={y} stroke="#edf0f3" />)}{points.length > 0 && <>{points.length > 1 && <polygon points={"15,130 " + points.map(point => point.x + "," + point.y).join(" ") + " 485,130"} fill="#faf1d5" />}<polyline points={points.map(point => point.x + "," + point.y).join(" ")} fill="none" stroke="#b88b24" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />{points.map(point => <circle key={point.day} cx={point.x} cy={point.y} r="3.5" fill="#b88b24"><title>{`${point.day}: ${point.count} orders`}</title></circle>)}</>}</svg></div><div className="vendor-line-range"><span>{data?.daily[0]?.day}</span><span>{data?.daily.at(-1)?.day}</span></div><footer>Orders created in the reporting period · all statuses</footer></section>
    <section className="vendor-mini-chart"><header><div><span className="vendor-section-label">FULFILMENT MIX</span><h2>Order outcomes</h2></div></header><div className="vendor-order-mix"><div className="vendor-donut" role="img" aria-label={collected + " collected, " + active + " in progress, " + cancelled + " cancelled or rejected"} style={{ background: total ? "conic-gradient(#d3a62b 0% " + collectedPct + "%,#836846 " + collectedPct + "% " + (collectedPct + activePct) + "%,#dce1e7 " + (collectedPct + activePct) + "% 100%)" : "#e9edf1" }}><span><strong>{Math.round(collectedPct)}%</strong><small>collected</small></span></div><dl><div><dt><i className="mix-collected" />Collected</dt><dd>{collected}</dd></div><div><dt><i className="mix-active" />In progress</dt><dd>{active}</dd></div><div><dt><i className="mix-cancelled" />Cancelled / rejected</dt><dd>{cancelled}</dd></div></dl></div><footer>Current status of orders created in the period</footer></section>
    <section className="vendor-mini-chart"><header><div><span className="vendor-section-label">BEST SELLERS</span><h2>Products by units collected</h2></div></header>{top.length ? <div className="vendor-product-bars">{top.map(product => <div key={product.id}><span title={product.name}>{product.name}</span><div><i style={{ width: product.units / maxUnits * 100 + "%" }} /></div><strong>{product.units}</strong></div>)}</div> : <p className="vendor-chart-placeholder">Collected orders will reveal your best-selling products.</p>}<footer>Collected sales only · selected reporting period</footer></section>
    <section className="vendor-mini-chart"><header><div><span className="vendor-section-label">PICKUP PATTERN</span><h2>Scheduled pickups by time</h2></div></header><div className="vendor-hour-bars" role="group" aria-label="Scheduled pickups by two-hour MYT windows">{hours.map(hour => {
      const endLabel = String(Number(hour.label) + 2).padStart(2, "0");
      const slotLabel = `${hour.label}:00–${endLabel}:00 MYT · ${hour.count} ${hour.count === 1 ? "order" : "orders"}`;
      return <div key={hour.label} className="vendor-hour-slot" tabIndex={0} title={slotLabel} aria-label={slotLabel}><div className="chart-tooltip" role="tooltip"><strong>{hour.label}:00–{endLabel}:00</strong><span>{hour.count} {hour.count === 1 ? "order" : "orders"}</span></div><span>{hour.count || ""}</span><div><i style={{ height: hour.count / maxHour * 95 + "px" }} /></div><small>{hour.label}</small></div>;
    })}</div><footer>Two-hour MYT windows · excludes cancellations; includes upcoming pickups</footer></section>
    <details className="vendor-analytics-values"><summary>View exact order analytics</summary><div className="table-wrap"><table><thead><tr><th>Date · MYT</th><th>Orders placed</th></tr></thead><tbody>{data?.daily.map(row => <tr key={row.day}><th scope="row">{row.day}</th><td>{row.count}</td></tr>)}</tbody></table></div></details>
  </div>;
}
