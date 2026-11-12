"use client";
import { useCallback, useEffect, useState } from "react";
import { useApi, useRemote, RemoteStatus } from "../workspace/common";
import { apiClient } from "../../lib/backend/client";
import { type AdminOverview, type AdminScope } from "../../lib/admin-dashboard";
import { AdminCard, AdminNumber, FinanceTrend } from "./charts";
import { ExpenseForm } from "./management-forms";
import { money } from "../../lib/orders";
import { adminDate, periodLabel } from "./use-admin-overview";
import { downloadReport } from "../../lib/report-export";
type Entry = Awaited<ReturnType<typeof apiClient.adminLedger>>["entries"][number];
const labels = {
  demo: "Collection receipt",
  counter: "Counter receipt",
  duitnow_qr: "DuitNow QR",
  refund: "Refund",
  expense: "Paid expense",
  reversal: "Expense reversal",
};
export function AdminFinancials({
  data,
  scope,
  changed,
}: {
  data: AdminOverview;
  scope: AdminScope;
  changed: () => void;
}) {
  const api = useApi(),
    [page, setPage] = useState(1),
    [kind, setKind] = useState(""),
    [expense, setExpense] = useState<Entry | null>();
  const scopeKey = JSON.stringify(scope);
  useEffect(() => setPage(1), [scopeKey, kind]);
  const load = useCallback(
    () =>
      api.adminLedger(
        new URLSearchParams({ ...JSON.parse(scopeKey), page: String(page), kind, since: data.since, until: data.asOf }),
      ),
    [api, scopeKey, page, kind, data.since, data.asOf],
  );
  const ledger = useRemote(load),
    names = new Map(data.vendors.map((v) => [v.id, v.name]));
  const exportData = (format: "csv" | "pdf") =>
    downloadReport(
      {
        title: "APFoods daily cashflow",
        generatedAt: data.asOf,
        timezone: "Asia/Kuala_Lumpur",
        source: "Demonstration cashflow",
        scope: {
          kind: "finance",
          period: periodLabel(data),
          zone: scope.zoneId ?? "All food courts",
          stall: scope.vendorId ?? "All stalls",
        },
        summary: [
          { label: "Net cashflow", value: money(data.summary.netSen) },
          { label: "Shared overhead net", value: money(data.summary.sharedNetSen) },
        ],
        columns: ["Date MYT", "Receipts RM", "Costs net of reversals RM", "Net cashflow RM"],
        rows: data.daily.map((d) => [
          d.day,
          (d.receiptsSen / 100).toFixed(2),
          (d.costsSen / 100).toFixed(2),
          (d.netSen / 100).toFixed(2),
        ]),
      },
      format,
    );
  return (
    <>
      <div className="admin-metrics admin-four-metrics">
        {[
          ["Collected receipts", data.summary.receiptsSen],
          ["Paid expenses", data.summary.expenseSen],
          ["Recorded refunds", data.summary.refundSen],
          ["Net cashflow", data.summary.netSen],
        ].map(([label, value]) => (
          <section key={label}>
            <span>{label}</span>
            <strong>
              <AdminNumber value={Number(value)} moneyValue />
            </strong>
          </section>
        ))}
      </div>
      <FinanceTrend data={data} scope={scope} />
      <div className="admin-payment-breakdown">
        {[
          ["Counter receipts", data.payments?.counterSen],
          ["DuitNow QR receipts", data.payments?.duitnowSen],
          ["Demo collection receipts", data.payments?.demoSen],
          ["Unpaid counter orders · current snapshot", data.payments?.outstandingCounterSen],
        ].map(([label, value]) => (
          <span key={label}>
            {label}
            <strong>{typeof value === "number" ? money(value) : "Unavailable"}</strong>
          </span>
        ))}
      </div>
      <p className="admin-source">
        Expense reversals: {money(data.summary.reversalSen)} · Unallocated shared net cashflow:{" "}
        {money(data.summary.sharedNetSen)} · Integer-sen ledger, MYT display.
      </p>
      <AdminCard
        eyebrow="RECORDED MONEY MOVEMENTS"
        title="Cashflow ledger"
        action={
          <div className="admin-actions">
            <button className="button secondary" onClick={() => exportData("csv")}>
              Daily CSV
            </button>
            <button className="button secondary" onClick={() => exportData("pdf")}>
              Daily PDF
            </button>
            <button className="button primary" onClick={() => setExpense(null)}>
              Record expense
            </button>
          </div>
        }
      >
        <div className="admin-table-filters">
          <label className="field compact">
            Entry type
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">All entries</option>
              {Object.entries(labels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!ledger.value ? (
          <RemoteStatus error={ledger.error} reload={ledger.reload} />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Posted · MYT</th>
                    <th>Stall</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.value.entries.map((row) => (
                    <tr key={row.id}>
                      <td>{adminDate(row.created_at)}</td>
                      <td>{row.vendor_id ? (names.get(row.vendor_id) ?? row.vendor_id) : "Shared overhead"}</td>
                      <td>{labels[row.kind]}</td>
                      <td>{row.label}</td>
                      <td>{money(["expense", "refund"].includes(row.kind) ? -row.amount_sen : row.amount_sen)}</td>
                      <td>
                        {row.kind === "expense" &&
                          (row.isReversed ? (
                            <span>Reversed</span>
                          ) : (
                            <button className="button secondary" onClick={() => setExpense(row)}>
                              Reverse
                            </button>
                          ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!ledger.value.entries.length && <p className="admin-card-copy">No recorded entries match this scope.</p>}
            <div className="admin-pagination">
              <button className="button secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <span>
                {ledger.value.total.toLocaleString("en-MY")} entries · Page {page} of{" "}
                {Math.max(1, Math.ceil(ledger.value.total / 50))}
              </span>
              <button
                className="button secondary"
                disabled={page * 50 >= ledger.value.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}
        <footer>
          Ledger bounded to the same reporting snapshot as the totals. Daily exports contain all aggregate days in the
          selected scope.
        </footer>
      </AdminCard>
      {expense !== undefined && (
        <ExpenseForm
          entry={expense}
          stalls={data.vendors}
          defaultStall={scope.vendorId}
          close={() => setExpense(undefined)}
          saved={() => {
            setExpense(undefined);
            changed();
            ledger.reload();
          }}
        />
      )}
    </>
  );
}
