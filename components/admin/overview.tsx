"use client";
import { useState } from "react";
import Link from "next/link";
import {
  RefreshCw,
  ArrowUpRight,
  Store,
  WalletCards,
  ClipboardList,
  CheckCheck,
  ChefHat,
  TriangleAlert,
} from "lucide-react";
import { useRemote, RemoteStatus } from "../workspace/common";
import { replaceFilters } from "../shared";
import { apiClient } from "../../lib/backend/client";
import { money } from "../../lib/orders";
import {
  adminLink,
  adminAttention,
  collectionRate,
  type AdminOverview,
  type AdminScope,
} from "../../lib/admin-dashboard";
import { downloadReport } from "../../lib/report-export";
import { useAdminOverview, periodLabel, adminDate } from "./use-admin-overview";
import { AdminCard, AdminNumber, FinanceTrend, VendorComparison, DemandAndOutcomes } from "./charts";
import { AdminFif, AdminCampusOutlook } from "./fif";
import type { AdminOptimization } from "../../lib/admin-intelligence";
import { AdminVendorDetail } from "./vendor-detail";
import { AdminFinancials } from "./financials";
export function AdminControlCentre({ view }: { view: "home" | "vendors" | "products" | "cashflow" }) {
  const [optimization, setOptimization] = useState<AdminOptimization>();
  const state = useAdminOverview(),
    zones = useRemote(apiClient.zones),
    stalls = useRemote(apiClient.vendors);
  const { scope, reload, value: data } = state;
  if (!data) return <RemoteStatus error={state.error} reload={reload} />;
  const preview = optimization?.fingerprint === data.fingerprint ? optimization : undefined;
  return (
    <div className="admin-centre">
      <header className="admin-overview-header">
        <div>
          <span className="admin-eyebrow">CAFETERIA COMMAND CENTRE</span>
          <h1>
            {view === "home"
              ? "Cafeteria overview"
              : view === "vendors"
                ? "Vendor oversight"
                : view === "products"
                  ? "Products & availability"
                  : "Financial performance"}
          </h1>
          <p>
            {periodLabel(data)} · {data.vendors.length} stalls in scope · Demonstration data
          </p>
        </div>
        <button className="button secondary" disabled={state.busy} onClick={reload}>
          <RefreshCw size={15} className={state.busy ? "admin-spinning" : ""} />
          {state.busy ? "Refreshing…" : "Refresh data"}
        </button>
      </header>
      <div className="admin-filter-bar">
        <label className="field compact">
          Reporting period
          <select value={scope.days} onChange={(e) => replaceFilters({ days: e.target.value })}>
            {[
              ["1", "Today"],
              ["7", "Last 7 days"],
              ["14", "Last 14 days"],
              ["30", "Last 30 days"],
              ["90", "Last 90 days"],
            ].map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field compact">
          Food court
          <select value={scope.zoneId ?? ""} onChange={(e) => replaceFilters({ zoneId: e.target.value, vendorId: "" })}>
            <option value="">All food courts</option>
            {zones.value?.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field compact">
          Stall
          <select value={scope.vendorId ?? ""} onChange={(e) => replaceFilters({ vendorId: e.target.value })}>
            <option value="">All stalls</option>
            {stalls.value
              ?.filter((v) => !scope.zoneId || v.zone_id === scope.zoneId)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
          </select>
        </label>
        <span className="admin-source">
          Updated {adminDate(data.asOf)} MYT
          <br />
          Refreshes every minute while visible
        </span>
      </div>
      {Boolean(state.error) && (
        <p className="admin-warning" role="alert">
          Refresh failed. Showing the last successful snapshot. <button onClick={reload}>Retry</button>
        </p>
      )}
      {view === "home" ? (
        <>
          <AdminFif data={data} scope={scope} onOptimizationChange={setOptimization} />
          <AdminMetrics data={data} optimization={preview} />
          <Attention data={data} scope={scope} optimization={preview} />
          <div className="admin-chart-grid">
            <FinanceTrend data={data} scope={scope} optimization={preview} />
            <VendorComparison data={data} scope={scope} optimization={preview} />
            <DemandAndOutcomes data={data} scope={scope} optimization={preview} />
          </div>
          <AdminCampusOutlook data={data} optimization={preview} />
          <VendorOversight data={data} scope={scope} optimization={preview} />
        </>
      ) : view === "vendors" ? (
        <>
          <AdminMetrics data={data} />
          <VendorOversight data={data} scope={scope} />
          {scope.vendorId && (
            <AdminVendorDetail
              vendorId={scope.vendorId}
              scope={scope}
              close={() => replaceFilters({ vendorId: "" })}
              changed={reload}
            />
          )}
        </>
      ) : view === "products" ? (
        <AdminProducts data={data} scope={scope} />
      ) : (
        <AdminFinancials data={data} scope={scope} changed={reload} />
      )}
    </div>
  );
}
function AdminMetrics({ data, optimization }: { data: AdminOverview; optimization?: AdminOptimization }) {
  const rate = collectionRate(data.summary.collected, data.summary.closed),
    oldRate = collectionRate(data.previous.collected, data.previous.closed);
  const delta = (current: number, previous: number, currency = false) =>
    !data.previous.available
      ? "Comparison unavailable"
      : currency
        ? `${current >= previous ? "+" : "−"}${money(Math.abs(current - previous))} vs prior comparable period`
        : previous
          ? `${((current - previous) / Math.abs(previous)) * 100 >= 0 ? "+" : ""}${(((current - previous) / Math.abs(previous)) * 100).toFixed(1)}% vs prior comparable period`
          : "No comparable baseline";
  const metrics = [
    {
      label: "Combined net cashflow",
      value: data.summary.netSen,
      money: true,
      note: delta(data.summary.netSen, data.previous.netSen, true),
      Icon: WalletCards,
    },
    {
      label: "Collected receipts",
      value: data.summary.receiptsSen,
      money: true,
      note: delta(data.summary.receiptsSen, data.previous.receiptsSen, true),
      Icon: Store,
    },
    {
      label: "Orders placed",
      value: data.summary.orders,
      note: delta(data.summary.orders, data.previous.orders),
      Icon: ClipboardList,
    },
    {
      label: "Collection rate",
      value: rate,
      note:
        rate === null
          ? "No closed orders"
          : data.previous.available && oldRate !== null
            ? `${rate - oldRate >= 0 ? "+" : ""}${(rate - oldRate).toFixed(1)} percentage points vs prior`
            : "Collected / closed orders",
      Icon: CheckCheck,
    },
    {
      label: "In the kitchen",
      value: data.summary.active,
      note: "Current snapshot · includes older active orders",
      Icon: ChefHat,
    },
    {
      label: "Stalls needing attention",
      value: data.summary.attention,
      note: "Current snapshot · stock, queue or operating status",
      Icon: TriangleAlert,
    },
  ];
  return (
    <div className="admin-metrics">
      {metrics.map(({ label, value, money: currency, note, Icon }) => {
        const financial = !!optimization && optimization.recoveredOrders > 0;
        const projected =
          value === null
            ? null
            : label === "Combined net cashflow" && financial
              ? value + optimization.netSen
              : label === "Collected receipts" && financial
                ? value + optimization.receiptsSen
                : label === "Collection rate" && financial && data.summary.closed
                  ? Math.min(100, ((data.summary.collected + optimization.recoveredOrders) / data.summary.closed) * 100)
                  : value;
        const changed = projected !== value;
        return (
          <section key={label} className={changed ? "has-fif-preview" : ""}>
            <div>
              <span>{label}</span>
              <Icon size={17} />
            </div>
            {changed && <span className="admin-preview-label">FIF Optimized · estimate</span>}
            <strong>
              {projected === null ? (
                "—"
              ) : label === "Collection rate" ? (
                <>
                  <AdminNumber value={projected} digits={1} />%
                </>
              ) : (
                <AdminNumber value={projected} moneyValue={currency} />
              )}
            </strong>
            {changed && (
              <small className="admin-recorded-reference">
                Recorded {currency ? money(value ?? 0) : `${value?.toFixed(1)}%`}
              </small>
            )}
            {optimization && label === "Orders placed" && (
              <small className="admin-fif-delta">
                +{optimization.recoveredOrders} potential collections from existing unsuccessful orders
              </small>
            )}
            {optimization && label === "In the kitchen" && (
              <small className="admin-fif-delta">FIF plans future recovery; the live queue is unchanged</small>
            )}
            {optimization && label === "Stalls needing attention" && (
              <small className="admin-fif-delta">
                {optimization.priorityVendorIds.length} stalls in FIF's selected management plan
              </small>
            )}
            <small>{note}</small>
          </section>
        );
      })}
    </div>
  );
}
function Attention({
  data,
  scope,
  optimization,
}: {
  data: AdminOverview;
  scope: AdminScope;
  optimization?: AdminOptimization;
}) {
  const list = data.vendors
    .filter((v) => adminAttention(v).length)
    .sort(
      (a, b) => b.overdueCount - a.overdueCount || b.soldOutCount - a.soldOutCount || b.readyWaiting - a.readyWaiting,
    );
  return (
    <AdminCard
      eyebrow="CURRENT OPERATIONAL FACTS"
      title="Where management attention is needed"
      action={<Link href={adminLink("vendors", scope)}>Review vendors →</Link>}
    >
      <div className="admin-attention">
        {list.length ? (
          list.slice(0, 6).map((v) => (
            <Link key={v.id} href={adminLink("vendors", scope, v.id)}>
              <span className="admin-attention-icon">
                <TriangleAlert size={18} />
              </span>
              <div>
                <strong>{v.name}</strong>
                <small>{adminAttention(v).join(" · ")}</small>
                {optimization?.priorityVendorIds.includes(v.id) && (
                  <small className="admin-fif-delta">FIF priority review</small>
                )}
              </div>
              <ArrowUpRight size={16} />
            </Link>
          ))
        ) : (
          <p className="admin-card-copy">No current queue, stock or operating-status issues in this scope.</p>
        )}
      </div>
      {list.length > 6 && (
        <p className="admin-card-copy">{list.length - 6} more stalls in the oversight table below.</p>
      )}
      <footer>
        Operational alerts use recorded facts and are separate from generated FIF advice. Current snapshot as of{" "}
        {adminDate(data.asOf)} MYT.
      </footer>
    </AdminCard>
  );
}
function VendorOversight({
  data,
  scope,
  optimization,
}: {
  data: AdminOverview;
  scope: AdminScope;
  optimization?: AdminOptimization;
}) {
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [sort, setSort] = useState("net"),
    [page, setPage] = useState(1);
  const filtered = data.vendors
    .filter(
      (v) =>
        v.name.toLowerCase().includes(search.toLowerCase()) &&
        (!status ||
          (status === "attention"
            ? adminAttention(v).length > 0
            : status === "paused"
              ? v.paused
              : v.status === status)),
    )
    .sort((a, b) =>
      sort === "orders"
        ? b.orders - a.orders
        : sort === "attention"
          ? b.overdueCount - a.overdueCount || b.soldOutCount - a.soldOutCount
          : sort === "name"
            ? a.name.localeCompare(b.name)
            : b.netSen - a.netSen,
    );
  const pages = Math.max(1, Math.ceil(filtered.length / 10)),
    current = Math.min(page, pages);
  const exportData = (format: "csv" | "pdf") =>
    downloadReport(
      {
        title: "APFoods vendor oversight",
        generatedAt: data.asOf,
        timezone: "Asia/Kuala_Lumpur",
        source: "Demonstration cashflow and orders",
        scope: {
          kind: "finance",
          period: periodLabel(data),
          zone: scope.zoneId ?? "All food courts",
          stall: scope.vendorId ?? "All stalls",
        },
        summary: [{ label: "Combined net cashflow, including shared overhead", value: money(data.summary.netSen) }],
        columns: [
          "Vendor",
          "Status",
          "Orders placed",
          "Receipts (RM)",
          "Net cashflow (RM)",
          "Active now",
          "Overdue now",
        ],
        rows: filtered.map((v) => [
          v.name,
          v.status,
          v.orders.toString(),
          (v.receiptsSen / 100).toFixed(2),
          (v.netSen / 100).toFixed(2),
          String(v.activeCount),
          String(v.overdueCount),
        ]),
      },
      format,
    );
  return (
    <AdminCard
      className="admin-wide"
      eyebrow="VENDOR MANAGEMENT"
      title="Vendor oversight"
      action={
        <div className="admin-actions">
          <button className="button secondary" onClick={() => exportData("csv")}>
            Export CSV
          </button>
          <button className="button secondary" onClick={() => exportData("pdf")}>
            Export PDF
          </button>
        </div>
      }
    >
      <div className="admin-table-filters">
        <label className="field">
          Find a stall
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search vendor name"
          />
        </label>
        <label className="field compact">
          Status
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="approved">Approved</option>
            <option value="suspended">Suspended</option>
            <option value="paused">Intake paused</option>
            <option value="attention">Needs attention</option>
          </select>
        </label>
        <label className="field compact">
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="net">Net cashflow</option>
            <option value="orders">Orders placed</option>
            <option value="attention">Operational priority</option>
            <option value="name">Name</option>
          </select>
        </label>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Stall</th>
              <th>Status</th>
              <th>Orders</th>
              <th>Receipts</th>
              <th>Net cashflow</th>
              <th>Collection rate</th>
              <th>Kitchen now</th>
              <th>Stock issues</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice((current - 1) * 10, current * 10).map((v) => {
              const rate = collectionRate(v.collected, v.closed);
              return (
                <tr key={v.id}>
                  <th>{v.name}</th>
                  <td>
                    <span className="admin-badge">{v.status}</span>
                    {v.paused && <small>Intake paused</small>}
                  </td>
                  <td>{v.orders}</td>
                  <td>{money(v.receiptsSen)}</td>
                  <td>
                    {money(v.netSen)}
                    {optimization?.byVendor[v.id] && (
                      <small className="admin-fif-delta">
                        FIF Optimized {money(v.netSen + optimization.byVendor[v.id].netSen)}
                      </small>
                    )}
                  </td>
                  <td>{rate === null ? "—" : rate.toFixed(1) + "%"}</td>
                  <td>
                    {v.activeCount} active
                    <small>
                      {v.overdueCount} overdue · {v.readyWaiting} ready
                    </small>
                  </td>
                  <td>
                    {v.soldOutCount} sold out<small>{v.lowStockCount} low stock</small>
                  </td>
                  <td>
                    <Link className="button secondary" href={adminLink("vendors", scope, v.id)}>
                      Review stall
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!filtered.length && <p className="admin-card-copy">No stalls match these filters.</p>}
      <div className="admin-pagination">
        <button className="button secondary" disabled={current <= 1} onClick={() => setPage(current - 1)}>
          Previous
        </button>
        <span>
          {filtered.length} stalls · Page {current} of {pages}
        </span>
        <button className="button secondary" disabled={current >= pages} onClick={() => setPage(current + 1)}>
          Next
        </button>
      </div>
      <footer>
        Vendor net values exclude unallocated shared overhead ({money(data.summary.sharedNetSen)} in this scope). No
        arbitrary composite rating is applied.
      </footer>
    </AdminCard>
  );
}
function AdminProducts({ data, scope }: { data: AdminOverview; scope: AdminScope }) {
  const [search, setSearch] = useState(""),
    [availability, setAvailability] = useState(""),
    [sort, setSort] = useState("revenue"),
    [page, setPage] = useState(1);
  const rows = data.products
    .filter(
      (p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) &&
        (!availability ||
          (availability === "unpublished"
            ? !p.active
            : availability === "soldout"
              ? p.active && p.stock === 0
              : availability === "low"
                ? p.active && p.stock > 0 && p.stock <= 5
                : p.active && p.stock > 0)),
    )
    .sort((a, b) =>
      sort === "units"
        ? b.units - a.units
        : sort === "stock"
          ? a.stock - b.stock
          : sort === "name"
            ? a.name.localeCompare(b.name)
            : b.revenueSen - a.revenueSen,
    );
  const pages = Math.max(1, Math.ceil(rows.length / 25)),
    current = Math.min(page, pages),
    names = new Map(data.vendors.map((v) => [v.id, v.name]));
  const exportProducts = (format: "csv" | "pdf") =>
    downloadReport(
      {
        title: "APFoods product performance",
        generatedAt: data.asOf,
        timezone: "Asia/Kuala_Lumpur",
        source: "Demonstration collected item values; current stock snapshot",
        scope: {
          kind: "stock",
          period: periodLabel(data),
          zone: scope.zoneId ?? "All food courts",
          stall: scope.vendorId ?? "All stalls",
        },
        columns: [
          "Product",
          "Vendor",
          "Current price RM",
          "Publication",
          "Stock",
          "Collected units",
          "Collected item value RM",
        ],
        rows: rows.map((p) => [
          p.name,
          names.get(p.vendorId) ?? p.vendorId,
          (p.priceSen / 100).toFixed(2),
          p.active ? "Published" : "Unpublished",
          String(p.stock),
          String(p.units),
          (p.revenueSen / 100).toFixed(2),
        ]),
      },
      format,
    );
  return (
    <AdminCard
      eyebrow="CROSS-STALL CATALOGUE"
      title="Product performance & stock"
      action={
        <div className="admin-actions">
          <span>{rows.length} products</span>
          <button className="button secondary" onClick={() => exportProducts("csv")}>
            Export CSV
          </button>
          <button className="button secondary" onClick={() => exportProducts("pdf")}>
            Export PDF
          </button>
        </div>
      }
    >
      <div className="admin-table-filters">
        <label className="field">
          Find product
          <input
            value={search}
            type="search"
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="field compact">
          Availability
          <select
            value={availability}
            onChange={(e) => {
              setAvailability(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All products</option>
            <option value="available">Published & available</option>
            <option value="low">Low stock · 1–5 portions</option>
            <option value="soldout">Published & sold out</option>
            <option value="unpublished">Unpublished</option>
          </select>
        </label>
        <label className="field compact">
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="revenue">Collected item value</option>
            <option value="units">Collected units</option>
            <option value="stock">Stock remaining</option>
            <option value="name">Product name</option>
          </select>
        </label>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Stall</th>
              <th>Current price</th>
              <th>Availability</th>
              <th>Collected units</th>
              <th>Collected item value</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice((current - 1) * 25, current * 25).map((p) => (
              <tr key={p.id}>
                <th>{p.name}</th>
                <td>{names.get(p.vendorId)}</td>
                <td>{money(p.priceSen)}</td>
                <td>{!p.active ? "Unpublished" : p.stock === 0 ? "Sold out" : `${p.stock} portions`}</td>
                <td>{p.units}</td>
                <td>{money(p.revenueSen)}</td>
                <td>
                  <Link href={adminLink("vendors", scope, p.vendorId)}>Review stall →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p className="admin-card-copy">No products match your filters.</p>}
      <div className="admin-pagination">
        <button className="button secondary" disabled={current === 1} onClick={() => setPage(current - 1)}>
          Previous
        </button>
        <span>
          Page {current} of {pages}
        </span>
        <button className="button secondary" disabled={current === pages} onClick={() => setPage(current + 1)}>
          Next
        </button>
      </div>
      <footer>
        Collected item values preserve historical line prices. Current stock and publication status are a live snapshot.
      </footer>
    </AdminCard>
  );
}
