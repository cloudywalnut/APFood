"use client";

import { dayLabel, money } from "../lib/orders";
import { financeSeries, type FinanceEntry } from "../lib/orders";

export function CashflowChart({ entries, days, asOf }: { entries: FinanceEntry[]; days: number; asOf?: number }) {
  const values = financeSeries(entries, days, asOf);
  const min = Math.min(0, ...values.map((value) => value.net));
  const max = Math.max(1000, ...values.flatMap((value) => [value.inflow, value.expense, value.net]));
  const low = Math.floor(min / 1000) * 1000;
  const high = Math.ceil(max / 1000) * 1000;
  const plot = { left: 70, top: 12, width: 795, height: 206 };
  const step = plot.width / values.length;
  const y = (amount: number) => plot.top + ((high - amount) / (high - low)) * plot.height;
  const x = (index: number) => plot.left + step * (index + 0.5);
  const marks = Array.from({ length: 5 }, (_, index) => low + ((high - low) * index) / 4);
  const barWidth = Math.min(24, step / 5);
  return (
    <section className="panel chart-panel">
      <div className="line spread wrap">
        <div>
          <h2>Cashflow over time</h2>
          <p className="muted small">Demo receipts, expenses and net flow · RM</p>
        </div>
        <div className="chart-legend">
          <span className="legend-in">Receipts</span>
          <span className="legend-out">Expenses</span>
          <span className="legend-net">Net flow</span>
        </div>
      </div>
      <div className="chart-scroll" tabIndex={0} role="region" aria-label="Cashflow chart">
        <svg
          viewBox="0 0 890 254"
          role="img"
          aria-label="Daily cashflow. Expand the data table below for the exact amounts."
        >
          {marks.map((mark) => (
            <g key={mark}>
              <line x1={plot.left} y1={y(mark)} x2={plot.left + plot.width} y2={y(mark)} className="chart-grid" />
              <text x={plot.left - 10} y={y(mark) + 4} textAnchor="end">
                {Math.round(mark / 100)}
              </text>
            </g>
          ))}
          {values.map((value, index) => (
            <g key={value.day}>
              <rect
                x={x(index) - barWidth - 3}
                y={y(value.inflow)}
                width={barWidth}
                height={y(0) - y(value.inflow)}
                rx="2"
                className="bar-in"
              />
              <rect
                x={x(index) + 3}
                y={y(value.expense)}
                width={barWidth}
                height={y(0) - y(value.expense)}
                rx="2"
                className="bar-out"
              />
              {(values.length < 9 || index % 2 === 0) && (
                <text x={x(index)} y="244" textAnchor="middle">
                  {dayLabel(value.day)}
                </text>
              )}
            </g>
          ))}
          <polyline
            className="net-line"
            points={values.map((value, index) => x(index) + "," + y(value.net)).join(" ")}
          />
          {values.map((value, index) => (
            <circle key={value.day} cx={x(index)} cy={y(value.net)} r="4" className="net-dot" />
          ))}
        </svg>
      </div>
      <details className="chart-details">
        <summary>View chart data</summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Receipts</th>
                <th>Expenses</th>
                <th>Net flow</th>
              </tr>
            </thead>
            <tbody>
              {values.map((value) => (
                <tr key={value.day}>
                  <th scope="row">{dayLabel(value.day)}</th>
                  <td>{money(value.inflow)}</td>
                  <td>{money(value.expense)}</td>
                  <td>{money(value.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
