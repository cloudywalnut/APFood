"use client";

import { memo, useMemo, useState } from "react";
import type { hostedData } from "../../lib/backend/client";
import { netIncomeOutlook } from "../../lib/revenue-outlook";
import { formatAxisRM, niceAxisCeiling } from "../../lib/chart-scale";
import { money } from "../../lib/orders";

type Report = Awaited<ReturnType<typeof hostedData.vendorReport>>;
const label = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-MY", { day: "numeric", month: "short" });
const axisLabel = (value: number) => (value < 0 ? `−${formatAxisRM(-value)}` : formatAxisRM(value));

export const VendorRevenueOutlook = memo(function VendorRevenueOutlook({
  report,
  revenueChangePct,
}: {
  report: Report;
  revenueChangePct?: number;
}) {
  const [horizon, setHorizon] = useState(30);
  const data = useMemo(
    () => netIncomeOutlook(report.ledger, report.since, report.asOf, horizon, revenueChangePct),
    [report, horizon, revenueChangePct],
  );
  const all = [
    { day: report.since.slice(0, 10), baseline: 0, scenario: 0 },
    ...data.history.map((row) => ({ day: row.day, baseline: row.cumulativeSen, scenario: row.cumulativeSen })),
    ...data.forecast.map((row) => ({
      day: row.day,
      baseline: row.baselineCumulativeSen,
      scenario: row.scenarioCumulativeSen,
    })),
  ];
  const values = all.flatMap((row) => [row.baseline, row.scenario]);
  const positive = niceAxisCeiling(Math.max(0, ...values) / 100, 3).ceiling;
  const negative = Math.min(0, ...values) < 0 ? niceAxisCeiling(-Math.min(...values) / 100, 2).ceiling : 0;
  const axisTicks = Array.from({ length: 5 }, (_, i) => -negative + (i * (positive + negative)) / 4);
  // Use elapsed days; the opening balance is one day before the first completed day.
  const startDate = new Date(`${data.history[0]?.day ?? data.forecast[0].day}T00:00:00Z`);
  startDate.setUTCDate(startDate.getUTCDate() - 1);
  all[0].day = startDate.toISOString().slice(0, 10);
  const x = (index: number) => (index / Math.max(1, all.length - 1)) * 100;
  const y = (sen: number) => 100 - ((sen / 100 + negative) / (positive + negative)) * 100;
  const path = (start: number, end: number, scenario = false) =>
    all
      .slice(start, end)
      .map((row, index) => `${x(start + index)},${y(scenario ? row.scenario : row.baseline)}`)
      .join(" ");
  const boundary = data.history.length;
  const ticks = [0, boundary + Math.floor(horizon / 2), all.length - 1];
  const difference = data.scenarioSen - data.baselineSen;
  return (
    <section className="vendor-mini-chart vendor-revenue-outlook">
      <header>
        <div>
          <span className="vendor-section-label">NET INCOME OUTLOOK · MYT</span>
          <h2>AI net income estimate</h2>
        </div>
        <div className="vendor-outlook-controls">
          <label className="field compact">
            Projection horizon
            <select value={horizon} onChange={(event) => setHorizon(Number(event.target.value))}>
              <option value={30}>Next month · 30 days</option>
              <option value={60}>Next 2 months · 60 days</option>
              <option value={90}>Next 3 months · 90 days</option>
              <option value={180}>Next 6 months · 180 days</option>
            </select>
          </label>
        </div>
      </header>
      {data.hasBaseline ? (
        <>
          <div className="vendor-outlook-totals">
            <span>
              Next {horizon} days · baseline net<strong>{money(data.baselineSen)}</strong>
            </span>
            <span>
              With AI recommendations
              <strong>{revenueChangePct === undefined ? "Generate insights" : money(data.scenarioSen)}</strong>
            </span>
            <span>
              Estimated difference
              <strong>
                {revenueChangePct === undefined ? "—" : `${difference >= 0 ? "+" : "−"}${money(Math.abs(difference))}`}
              </strong>
            </span>
          </div>
          <p className="vendor-chart-takeaway">
            Cumulative net cashflow · receipts less refunds and recorded expenses. Projection starts after{" "}
            {label(data.history.at(-1)!.day)}.
          </p>
          <div
            className="vendor-outlook-plot"
            role="img"
            aria-label={`${horizon}-day cumulative net cashflow outlook. Future baseline ${money(data.baselineSen)}. ${revenueChangePct === undefined ? "Generate insights to add the AI estimate." : `AI estimate ${money(data.scenarioSen)}; revenue adjustment ${revenueChangePct.toFixed(1)}%.`}`}
          >
            <div className="vendor-outlook-axis">
              {axisTicks
                .slice()
                .reverse()
                .map((tick) => (
                  <span key={tick}>{axisLabel(tick)}</span>
                ))}
            </div>
            <div className="vendor-outlook-lines">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                {axisTicks.map((tick) => (
                  <line
                    key={tick}
                    x1="0"
                    x2="100"
                    y1={y(tick * 100)}
                    y2={y(tick * 100)}
                    stroke="#e9e1d2"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {negative > 0 && (
                  <line x1="0" x2="100" y1={y(0)} y2={y(0)} stroke="#a99a81" vectorEffect="non-scaling-stroke" />
                )}
                <line
                  x1={x(boundary)}
                  x2={x(boundary)}
                  y1="0"
                  y2="100"
                  stroke="#bdad8b"
                  strokeDasharray="3 4"
                  vectorEffect="non-scaling-stroke"
                />
                <polyline
                  points={path(0, boundary + 1)}
                  fill="none"
                  stroke="#73573b"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
                <polyline
                  points={path(boundary, all.length)}
                  fill="none"
                  stroke="#8c96a3"
                  strokeDasharray="5 4"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
                {revenueChangePct !== undefined && (
                  <polyline
                    points={path(boundary, all.length, true)}
                    fill="none"
                    stroke="#bd8c13"
                    strokeWidth="2.5"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>
              <div className="vendor-outlook-dates">
                {ticks.map((index) => (
                  <span key={index} style={{ left: `${x(index)}%` }}>
                    {label(all[index].day)}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="vendor-outlook-legend">
            <span>━ Recorded net cashflow</span>
            <span>┄ Steady-volume baseline</span>
            <span>
              ━ AI estimate{" "}
              {revenueChangePct === undefined
                ? "· generate insights to view"
                : `· ${revenueChangePct >= 0 ? "+" : ""}${revenueChangePct.toFixed(1)}% revenue`}
            </span>
          </div>
          <details className="vendor-outlook-values">
            <summary>View projected daily net income</summary>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date · MYT</th>
                    <th>Daily baseline net</th>
                    <th>Daily AI net</th>
                    <th>Cumulative AI estimate*</th>
                  </tr>
                </thead>
                <tbody>
                  {data.forecast.map((row) => (
                    <tr key={row.day}>
                      <td>{row.day}</td>
                      <td>{money(row.baselineDailySen)}</td>
                      <td>{revenueChangePct === undefined ? "—" : money(row.scenarioDailySen)}</td>
                      <td>{revenueChangePct === undefined ? "—" : money(row.scenarioCumulativeSen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>*Includes recorded net cashflow in the selected reporting period.</p>
          </details>
        </>
      ) : (
        <p className="vendor-chart-placeholder">
          Choose a 7- or 14-day reporting period with completed sales to build a projection.
        </p>
      )}
      <footer>
        Cash-basis estimate from {data.history.length} completed days, not accounting profit. The baseline uses average
        daily receipts and costs; the AI estimate applies the selected recommendations' revenue adjustment with recorded
        costs held steady. No automatic compounding. Longer horizons are more uncertain; estimates are not guarantees.
        Unrecorded costs and taxes are excluded.
      </footer>
    </section>
  );
});
