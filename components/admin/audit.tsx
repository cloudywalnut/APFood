"use client";
import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApi, useRemote, RemoteStatus } from "../workspace/common";
import { replaceFilters } from "../shared";
import { AdminCard } from "./charts";
import { adminDate } from "./use-admin-overview";
import { dayKey } from "../../lib/orders";
export function AdminAudit() {
  const api = useApi(),
    params = useSearchParams(),
    [search, setSearch] = useState(params.get("search") ?? "");
  const key = params.toString(),
    page = Math.max(1, Number(params.get("page")) || 1);
  const load = useCallback(() => api.auditPage(new URLSearchParams(key)), [api, key]),
    result = useRemote(load);
  return (
    <div className="admin-centre">
      <header className="admin-overview-header">
        <div>
          <span className="admin-eyebrow">ACCOUNTABILITY & MANAGEMENT</span>
          <h1>Audit trail</h1>
          <p>Recorded actions, reasons and management changes · Malaysia time</p>
        </div>
      </header>
      <AdminCard eyebrow="RECORDED EVENTS" title="Management activity">
        {params.has("days") && (
          <p className="admin-card-copy">
            Period: {params.get("days")} days{" "}
            <button
              className="quiet-link"
              onClick={() => replaceFilters({ days: "", since: "", until: "", page: "1" })}
            >
              Show all time
            </button>
          </p>
        )}
        <form
          className="admin-table-filters"
          onSubmit={(e) => {
            e.preventDefault();
            replaceFilters({ search, page: "1" });
          }}
        >
          <label className="field">
            Search actions, targets or reasons
            <input type="search" value={search} maxLength={100} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <button className="button secondary">Search</button>
          <label className="field compact">
            Actor role
            <select
              value={params.get("actor") ?? ""}
              onChange={(e) => replaceFilters({ actor: e.target.value, page: "1" })}
            >
              <option value="">All roles</option>
              {["student", "vendor", "admin"].map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
          </label>
          <label className="field compact">
            From date
            <input
              type="date"
              value={
                params.get("since")?.slice(0, 10) ?? (params.has("days") ? dayKey(1 - Number(params.get("days"))) : "")
              }
              onChange={(e) =>
                replaceFilters({ since: e.target.value ? `${e.target.value}T00:00:00+08:00` : "", page: "1" })
              }
            />
          </label>
          <label className="field compact">
            Before date
            <input
              type="date"
              value={params.get("until")?.slice(0, 10) ?? ""}
              onChange={(e) =>
                replaceFilters({ until: e.target.value ? `${e.target.value}T00:00:00+08:00` : "", page: "1" })
              }
            />
          </label>
        </form>
        {params.get("vendorId") && (
          <p className="admin-card-copy">
            Stall-targeted events: {params.get("vendorId")}{" "}
            <button className="quiet-link" onClick={() => replaceFilters({ vendorId: "", page: "1" })}>
              Show all targets
            </button>
          </p>
        )}
        {!result.value ? (
          <RemoteStatus error={result.error} reload={result.reload} />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date · MYT</th>
                    <th>Actor role</th>
                    <th>Action</th>
                    <th>Target</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {result.value.events.map((e) => (
                    <tr key={e.id}>
                      <td>{adminDate(e.created_at)}</td>
                      <td>{e.actor_role}</td>
                      <th>{e.action}</th>
                      <td>{e.target}</td>
                      <td>{e.reason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!result.value.events.length && <p className="admin-card-copy">No events match these filters.</p>}
            <div className="admin-pagination">
              <button
                className="button secondary"
                disabled={page <= 1}
                onClick={() => replaceFilters({ page: String(page - 1) })}
              >
                Previous
              </button>
              <span>
                {result.value.total.toLocaleString("en-MY")} events · Page {page}
              </span>
              <button
                className="button secondary"
                disabled={page * 50 >= result.value.total}
                onClick={() => replaceFilters({ page: String(page + 1) })}
              >
                Next
              </button>
            </div>
          </>
        )}
      </AdminCard>
    </div>
  );
}
