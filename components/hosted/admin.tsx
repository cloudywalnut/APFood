"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { dayKey, money } from "../../lib/demo";
import { ApiError, hostedData } from "../../lib/backend/client";
import { pickupWindow } from "../../lib/pickup-time";
import { CashflowChart } from "../cashflow-chart";
import { Empty, ErrorMessage, Modal, OpsShell, Recommendation, replaceFilters } from "../shared";
import { HostedAccess, messageOf, RemoteStatus, SignOut, useHostedData, useRemote } from "./common";
import { HostedTraffic } from "./traffic";

type Report = Awaited<ReturnType<typeof hostedData.report>>;
type LedgerEntry = Report["ledger"][number];
type Vendor = Report["vendors"][number];
const titles: Record<string, string> = { home: "Cafeteria overview", cashflow: "Cashflow", products: "Products", vendors: "Vendors", traffic: "Traffic", audit: "Audit trail" };
const ledgerLabels = { demo: "Simulated collection", counter: "Counter-confirmed receipt", expense: "Paid expense", reversal: "Expense reversal" };
const localDate = new Intl.DateTimeFormat("en-MY", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kuala_Lumpur" });
const formatDate = (timestamp: string) => localDate.format(new Date(timestamp));

export function HostedAdmin({ route, section }: { route: string; section: string }) {
  return <HostedAccess role="admin">{() =>
    <OpsShell hosted kind="admin" route={route} title={titles[section]}>
      <div className="page-heading"><div>{section !== "traffic" && <h1>{titles[section]}</h1>}<p>Standard demo · Fictional transactions</p></div><SignOut /></div>
      {section === "audit" ? <Audit /> : section === "traffic" ? <HostedTraffic admin /> : <ReportPanel section={section} />}
    </OpsShell>
  }</HostedAccess>;
}

function ReportPanel({ section }: { section: string }) {
  const api = useHostedData();
  const params = useSearchParams();
  const days = ["1","7","14"].includes(params.get("days") ?? "") ? params.get("days")! : "7";
  const zoneId = params.get("zoneId") ?? "";
  const vendorId = params.get("vendorId") ?? "";
  const load = useCallback(() => {
    const filter = new URLSearchParams({ days });
    if (zoneId) filter.set("zoneId", zoneId);
    if (vendorId) filter.set("vendorId", vendorId);
    return api.report(section === "vendors" ? new URLSearchParams({ days: "1" }) : filter);
  }, [days, zoneId, vendorId, section, api]);
  const result = useRemote(load);
  const zones = useRemote(hostedData.zones);
  const stalls = useRemote(hostedData.vendors);
  const [vendor, setVendor] = useState<Vendor>();
  const [expense, setExpense] = useState<LedgerEntry | null>();
  if (!result.value) return <RemoteStatus error={result.error} reload={result.reload} />;
  const report = result.value;
  return <div className="stack">
    {section !== "vendors" && <div className="filters ops-filters">
      <label className="field compact">Period<select value={days} onChange={event => replaceFilters({ days: event.target.value })}><option value="1">Today</option><option value="7">Last 7 days</option><option value="14">Last 14 days</option></select></label>
      <label className="field compact">Food court<select value={zoneId} onChange={event => replaceFilters({ zoneId: event.target.value, vendorId: "" })}><option value="">All zones</option>{zones.value?.map(zone => <option value={zone.id} key={zone.id}>{zone.name}</option>)}</select></label>
      <label className="field compact">Stall<select value={vendorId} onChange={event => replaceFilters({ vendorId: event.target.value })}><option value="">All stalls</option>{stalls.value?.filter(stall => !zoneId || stall.zone_id === zoneId).map(stall => <option value={stall.id} key={stall.id}>{stall.name}</option>)}</select></label>
    </div>}
    {section === "home" && <OpsDesk report={report} vendorId={vendorId} zoneId={zoneId} days={days} />}
    {section === "cashflow" && <><div className="metrics">{[
      ["Collected receipts", report.finance.demo + report.finance.counter], ["Paid expenses", report.finance.expense],
      ["Expense reversals", report.finance.reversal], ["Demo net flow", report.finance.netSen],
    ].map(([label, amount]) => <section className="metric" key={label}><div><span>{label}</span><strong>{money(Number(amount))}</strong></div></section>)}</div>
      <div className="panel breakdown"><span>Simulated collections <strong>{money(report.finance.demo)}</strong></span><span>Counter-confirmed <strong>{money(report.finance.counter)}</strong></span><span>Outstanding at counter <strong>{money(report.finance.outstandingCounterSen)}</strong></span><span>Shared overhead <strong>{money(report.finance.sharedOverheadSen)}</strong></span></div></>}
    {(section === "home" || section === "cashflow") && (report.ledger.length
      ? <CashflowChart days={Number(days)} asOf={Date.parse(report.asOf)}
        entries={report.ledger.map(row => ({ day: dayKey(0, Date.parse(row.created_at)), type: row.kind, amount: row.amount_sen }))} />
      : <Empty title="No cashflow to chart" detail="Collected demo receipts, expenses, and reversals will appear here for this period." />)}
    {(section === "home" || section === "vendors") && <section className="panel"><h2>Stall performance</h2><div className="table-wrap"><table><thead><tr><th>Stall</th><th>Approval</th><th>Capacity</th><th>Active orders</th><th>Net flow</th>{section === "vendors" && <th>Action</th>}</tr></thead><tbody>
      {report.vendors.map(stall => <tr key={stall.id}><th scope="row">{stall.name}</th><td>{stall.status}</td><td>{stall.capacity}</td><td>{stall.activeCount}</td><td>{money(stall.netSen)}</td>{section === "vendors" && <td><button className="button secondary" onClick={() => setVendor(stall)}>Manage</button></td>}</tr>)}
    </tbody></table></div></section>}
    {section === "home" && <Link className="button secondary" href={"/admin/cashflow?" + params.toString()}>Open cashflow ledger</Link>}
    {section === "cashflow" && <section className="panel"><div className="line spread"><h2>Cashflow ledger</h2><button className="button primary" onClick={() => setExpense(null)}>Record expense</button></div>
      {report.ledger.length ? <div className="table-wrap"><table><thead><tr><th>Date (MYT)</th><th>Description</th><th>Type</th><th>Amount</th><th>Action</th></tr></thead><tbody>
        {report.ledger.map(row => <tr key={row.id}><td>{formatDate(row.created_at)}</td><th scope="row">{row.label}</th><td>{ledgerLabels[row.kind]}</td><td>{money(row.kind === "expense" ? -row.amount_sen : row.amount_sen)}</td><td>{row.kind === "expense" && !report.ledger.some(entry => entry.reverses_id === row.id) && <button className="button secondary" onClick={() => setExpense(row)}>Reverse</button>}</td></tr>)}
      </tbody></table></div> : <p>No ledger entries for these filters.</p>}
    </section>}
    {section === "products" && <section className="panel"><div className="table-wrap"><table><thead><tr><th>Product</th><th>Stall</th><th>Units collected</th><th>Fulfilled value</th><th>Stock</th></tr></thead><tbody>
      {report.products.map(item => <tr key={item.id}><th scope="row">{item.name}</th><td>{report.vendors.find(stall => stall.id === item.vendor_id)?.name ?? item.vendor_id}</td><td>{item.units}</td><td>{money(item.fulfilledValueSen)}</td><td>{item.stock}</td></tr>)}
    </tbody></table></div></section>}
    {vendor && zones.value && <ManageVendor vendor={vendor} zones={zones.value} close={() => setVendor(undefined)} saved={() => { setVendor(undefined); result.reload(); stalls.reload(); }} />}
    {expense !== undefined && <ExpenseForm entry={expense} stalls={report.vendors} defaultStall={vendorId || (zoneId ? report.vendors[0]?.id : "")} close={() => setExpense(undefined)} saved={() => { setExpense(undefined); result.reload(); }} />}
  </div>;
}

function OpsDesk({ report, vendorId, zoneId, days }: { report: Report; vendorId: string; zoneId: string; days: string }) {
  const traffic = useRemote(hostedData.traffic);
  const stalls = new Map(report.vendors.filter(stall => (!zoneId || stall.zone_id === zoneId) && (!vendorId || stall.id === vendorId))
    .map(stall => [stall.id, stall.name]));
  const buckets = traffic.value?.buckets.filter(bucket => stalls.has(bucket.vendor_id)) ?? [];
  const full = buckets.filter(bucket => bucket.total_units > 0 && bucket.reserved_units >= bucket.total_units)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))[0];
  const low = report.products.filter(item => item.active && item.stock <= 5);
  const trafficAction = Boolean(full) || !low.length;
  const target = new URLSearchParams({ days });
  if (zoneId) target.set("zoneId", zoneId);
  const stallTarget = full?.vendor_id ?? low[0]?.vendor_id ?? vendorId;
  if (stallTarget) target.set("vendorId", stallTarget);
  const lowAtStall = low.filter(item => item.vendor_id === stallTarget).length;
  return <>
    <Recommendation label="FIF Ops Desk"
      title={full ? stalls.get(full.vendor_id) + " has a full pickup window" : low.length ? "Low stock at " + stalls.get(stallTarget) : "Review upcoming pickup activity"}
      evidence={full ? pickupWindow(full.starts_at) + " · " + full.reserved_units + " of " + full.total_units + " work units booked."
        : low.length ? lowAtStall + " published items at this stall have five portions or fewer." : "Compare scheduled pickups and booked work units by stall."}
      href={(trafficAction ? "/admin/traffic?" : "/admin/products?") + target.toString()}
      action={trafficAction ? "View traffic" : "Review products"} />
    <div className="metrics">{[
      ["Demo net flow", money(report.finance.netSen)], ["Pickups in activity window", traffic.value ? buckets.reduce((sum, bucket) => sum + bucket.pickup_count, 0) : "—"],
      ["Active orders in period", report.vendors.reduce((sum, stall) => sum + stall.activeCount, 0)], ["Low-stock products", low.length],
    ].map(([label, value]) => <section className="metric" key={label}><div><span>{label}</span><strong>{value}</strong></div></section>)}</div>
  </>;
}

function ManageVendor({ vendor, zones, close, saved }: { vendor: Vendor; zones: { id: string; name: string }[]; close: () => void; saved: () => void }) {
  const api = useHostedData();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return <Modal title={"Manage " + vendor.name} close={() => { if (!busy) close(); }}><form className="stack" onSubmit={async event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      await api.manageStall(vendor.id, { status: data.get("status") === "suspended" ? "suspended" : "approved", zoneId: String(data.get("zone")), reason: String(data.get("reason")) });
      saved();
    } catch (problem) { setError(messageOf(problem)); } finally { setBusy(false); }
  }}>
    <label className="field">Approval<select name="status" defaultValue={vendor.status}><option value="approved">Approved</option><option value="suspended">Suspended</option></select></label>
    <label className="field">Food court<select name="zone" defaultValue={vendor.zone_id}>{zones.map(zone => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select></label>
    <label className="field">Reason<textarea name="reason" maxLength={250} required /></label>
    <ErrorMessage message={error} /><button className="button primary" disabled={busy}>Save vendor changes</button>
  </form></Modal>;
}

function ExpenseForm({ entry, stalls, defaultStall, close, saved }: { entry: LedgerEntry | null; stalls: Vendor[]; defaultStall?: string; close: () => void; saved: () => void }) {
  const api = useHostedData();
  const attempt = useRef<Parameters<typeof hostedData.expense>[0]>(undefined);
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <Modal title={entry ? "Reverse expense" : "Record expense"} close={() => { if (!busy && !pending) close(); }}><form className="stack" onSubmit={async event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      if (entry) await api.reverseExpense(entry.id, String(data.get("reason")));
      else {
        attempt.current ??= { vendorId: String(data.get("stall")) || null, amountSen: Math.round(Number(data.get("amount")) * 100), label: String(data.get("label")), idempotencyKey: crypto.randomUUID() };
        await api.expense(attempt.current);
      }
      saved();
    } catch (problem) {
      if (!entry && attempt.current) {
        if (problem instanceof ApiError && [400, 403, 409].includes(problem.status)) { attempt.current = undefined; setPending(false); }
        else setPending(true);
      }
      setError(messageOf(problem));
    } finally { setBusy(false); }
  }}>
    {entry ? <><p>{entry.label} · {money(entry.amount_sen)}</p><label className="field">Reason<textarea name="reason" maxLength={250} required /></label></> :
      <fieldset className="stack" disabled={pending || busy}>
        <label className="field">Amount (RM)<input name="amount" type="number" min=".01" max="100000" step=".01" required /></label>
        <label className="field">Description<input name="label" required maxLength={150} /></label>
        <label className="field">Stall<select name="stall" defaultValue={defaultStall ?? ""}><option value="">Shared cafeteria overhead</option>{stalls.map(stall => <option key={stall.id} value={stall.id}>{stall.name}</option>)}</select></label>
      </fieldset>}
    <ErrorMessage message={error} />
    <button className="button primary" disabled={busy}>{entry ? "Confirm reversal" : pending ? "Retry same expense" : "Save demo expense"}</button>
  </form></Modal>;
}

function Audit() {
  const api = useHostedData();
  const audit = useRemote(api.audit);
  if (!audit.value) return <RemoteStatus error={audit.error} reload={audit.reload} />;
  if (!audit.value.length) return <Empty title="No audit events yet" detail="Changes to orders, stalls, and expenses will appear here." />;
  return <section className="panel"><div className="table-wrap"><table><thead><tr><th>Date (MYT)</th><th>Actor</th><th>Action</th><th>Target</th><th>Reason</th></tr></thead><tbody>
    {audit.value.map(entry => <tr key={entry.id}><td>{formatDate(entry.created_at)}</td><td>{entry.actor_role}</td><th scope="row">{entry.action}</th><td>{entry.target}</td><td>{entry.reason ?? "—"}</td></tr>)}
  </tbody></table></div></section>;
}
