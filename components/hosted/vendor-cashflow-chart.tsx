"use client";

import { memo, useMemo } from "react";
import Link from "next/link";
import type { hostedData } from "../../lib/backend/client";
import { cashflowBridge } from "../../lib/vendor-chart-data";
import { niceAxisCeiling } from "../../lib/chart-scale";
import { money } from "../../lib/orders";

type Finance = Awaited<ReturnType<typeof hostedData.vendorReport>>["finance"];

export const VendorCashflowChart = memo(function VendorCashflowChart({ finance }: { finance: Finance }) {
  const bridge = useMemo(() => cashflowBridge(finance), [finance]);
  const values = bridge.steps.flatMap((step) => [step.start, step.end]);
  const high = Math.max(0, ...values);
  const low = Math.min(0, ...values);
  const maximum = high ? niceAxisCeiling(high, 2).ceiling : 0;
  const minimum = low ? -niceAxisCeiling(-low, 2).ceiling : 0;
  const range = maximum - minimum || 1;
  const y = (value: number) => ((maximum - value) / range) * 100;
  const active = bridge.steps.some((step) => step.value !== 0);
  return (
    <section className="vendor-mini-chart vendor-cashflow-chart">
      <header>
        <div>
          <span className="vendor-section-label">FOLLOW THE MONEY</span>
          <h2>From receipts to net cashflow</h2>
        </div>
        <strong>
          {money(finance.netSen)}
          <small>net recorded</small>
        </strong>
      </header>
      {!bridge.reconciled ? (
        <p role="alert" className="vendor-chart-placeholder">
          The breakdown does not match the reported net flow. Refresh the report.
        </p>
      ) : active ? (
        <>
          <p className="vendor-chart-takeaway">
            {bridge.receipts > 0
              ? `${money(finance.expense)} in expenses against ${money(bridge.receipts)} in receipts (${Math.round((finance.expense / bridge.receipts) * 100)}%).`
              : "Outflows are recorded, but no collection receipts were recorded in this period."}
          </p>
          <div className="vendor-cashflow-scroll" tabIndex={0} role="region" aria-label="Cashflow breakdown chart">
            <div
              className="vendor-cashflow-plot"
              role="img"
              aria-label={bridge.steps.map((step) => `${step.label}: ${money(step.value)}`).join("; ")}
            >
              <div className="vendor-cashflow-axis" aria-hidden="true">
                {[...new Set([maximum, 0, minimum])].map((value) => (
                  <span key={value} style={{ top: `${y(value)}%` }}>
                    {money(value)}
                  </span>
                ))}
              </div>
              <div className="vendor-cashflow-columns">
                <i
                  className="vendor-cashflow-zero"
                  style={{ top: `calc(var(--cashflow-height) * ${y(0) / 100})` }}
                  aria-hidden="true"
                />
                {bridge.steps.map((step) => (
                  <div className="vendor-cashflow-column" key={step.label}>
                    <div className="vendor-cashflow-bar-space">
                      <i
                        data-outflow={step.value < 0}
                        data-total={step.total}
                        data-zero={step.start === step.end}
                        style={{
                          top: `${y(Math.max(step.start, step.end))}%`,
                          height: `${(Math.abs(step.end - step.start) / range) * 100}%`,
                        }}
                      />
                      {!step.total && (
                        <b
                          className="vendor-cashflow-connector"
                          style={{ top: `${y(step.end)}%` }}
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <strong>
                      {!step.total && step.value > 0 ? "+" : ""}
                      {money(step.value)}
                    </strong>
                    <span>{step.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <p className="vendor-chart-placeholder">
          Collection receipts and recorded expenses will populate this breakdown.
        </p>
      )}
      <footer>
        Recorded cash movement, not profit or an AI estimate. <Link href="/vendor/reports">Review ledger</Link>
      </footer>
    </section>
  );
});
