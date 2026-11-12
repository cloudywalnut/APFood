"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { ModalSheet } from "../ui/primitives";
import { useApi, useRemote, RemoteStatus } from "../workspace/common";
import { ManageVendor } from "./management-forms";
import { money } from "../../lib/orders";
import { adminLink, collectionRate, type AdminScope } from "../../lib/admin-dashboard";
import { adminDate } from "./use-admin-overview";
import { apiClient } from "../../lib/backend/client";
export function AdminVendorDetail({
  vendorId,
  scope,
  close,
  changed,
}: {
  vendorId: string;
  scope: AdminScope;
  close: () => void;
  changed: () => void;
}) {
  const api = useApi(),
    load = useCallback(() => api.adminVendorDetail(vendorId, scope.days), [api, vendorId, scope.days]);
  const result = useRemote(load),
    zones = useRemote(apiClient.zones),
    [manage, setManage] = useState(false);
  const data = result.value,
    vendor = data?.vendors[0],
    rate = vendor ? collectionRate(vendor.collected, vendor.closed) : null;
  return (
    <>
      <ModalSheet title={vendor ? `${vendor.name} · Vendor review` : "Loading vendor review"} close={close} wide>
        <div className="admin-vendor-detail">
          {!data || !vendor ? (
            <RemoteStatus error={result.error} reload={result.reload} />
          ) : (
            <>
              <p className="admin-source">
                {scope.days === "1" ? "Today" : `Last ${scope.days} days`} · evidence as of {adminDate(data.asOf)} MYT
              </p>
              <div className="admin-detail-status">
                <span className="admin-badge">{vendor.status}</span>
                <span>{vendor.paused ? "Intake paused" : "Intake not paused"}</span>
                <span>{zones.value?.find((z) => z.id === vendor.zone_id)?.name ?? vendor.zone_id}</span>
              </div>
              <div className="admin-detail-metrics">
                <span>
                  Receipts<strong>{money(vendor.receiptsSen)}</strong>
                </span>
                <span>
                  Net cashflow<strong>{money(vendor.netSen)}</strong>
                </span>
                <span>
                  Orders placed<strong>{vendor.orders}</strong>
                </span>
                <span>
                  Collection rate<strong>{rate === null ? "—" : rate.toFixed(1) + "%"}</strong>
                </span>
              </div>
              <h3>Current kitchen snapshot</h3>
              <p>
                {vendor.activeCount} active · {vendor.overdueCount} overdue preparation · {vendor.readyWaiting} ready
                for collection
              </p>
              <p>
                Historical readiness:{" "}
                {vendor.readyCount
                  ? `${((vendor.onTimeCount / vendor.readyCount) * 100).toFixed(1)}% ready by the scheduled pickup time, from ${vendor.readyCount} orders with readiness timestamps.`
                  : "No recorded readiness timestamps in this reporting period."}
              </p>
              <h3>Assigned staff</h3>
              {data.staff.length ? (
                <ul>
                  {data.staff.map((staff) => (
                    <li key={staff.id}>
                      {staff.name || "Staff account"} · {staff.status}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No stall staff assigned.</p>
              )}
              <div className="admin-actions">
                <Link className="button secondary" href={adminLink("users", scope, vendor.id)}>
                  Manage staff access
                </Link>
                <button className="button primary" onClick={() => setManage(true)}>
                  Manage approval &amp; food court
                </button>
              </div>
              <h3>Products and availability</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Availability</th>
                      <th>Units collected</th>
                      <th>Collected value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.products.map((p) => (
                      <tr key={p.id}>
                        <th>{p.name}</th>
                        <td>{!p.active ? "Unpublished" : p.stock === 0 ? "Sold out" : `${p.stock} portions`}</td>
                        <td>{p.units}</td>
                        <td>{money(p.revenueSen)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="admin-actions">
                {[
                  ["cashflow", "Financial ledger"],
                  ["products", "Product analysis"],
                  ["traffic", "Scheduled pickups"],
                  ["audit", "Stall audit events"],
                ].map(([page, label]) => (
                  <Link className="button secondary" key={page} href={adminLink(page, scope, vendor.id)}>
                    {label} →
                  </Link>
                ))}
              </div>
              <h3>Recent stall management events</h3>
              {data.events.length ? (
                <ul className="admin-event-list">
                  {data.events.map((e) => (
                    <li key={e.id}>
                      <strong>{e.action}</strong>
                      <small>
                        {adminDate(e.created_at)} MYT · {e.actor_role}
                      </small>
                      <span>{e.reason ?? "No reason recorded"}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  No stall-targeted management events recorded. Individual order events remain in the full audit trail.
                </p>
              )}
            </>
          )}
        </div>
      </ModalSheet>
      {manage && vendor && (
        <ManageVendor
          vendor={vendor}
          zones={zones.value ?? []}
          close={() => setManage(false)}
          saved={() => {
            setManage(false);
            result.reload();
            changed();
          }}
        />
      )}
    </>
  );
}
