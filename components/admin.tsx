"use client";
import { InfoTip } from "./apspace/info-tip";

import { WarmIllustration } from "./apspace/illustration";
import { AdminInsights } from "./apspace/admin-insights";
import { RoleHero } from "./apspace/role-hero";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Banknote, Clock3, Package, Plus, ReceiptText, Store, WalletCards } from "lucide-react";
import { dayKey, dayLabel, isActive, loadFor, money, slotLabel, totals, type Entry, type Vendor } from "../lib/demo";
import { addExpense, itemStock, reverseExpense, saveVendor, useDemo } from "../lib/demo-store";
import { scopeData } from "../lib/analytics";
import { CashflowChart } from "./cashflow-chart";
import { ErrorMessage, Modal, OpsShell, Recommendation, replaceFilters, ScenarioSelect } from "./shared";
import { ReportDialog } from "./apspace/extras";
import { Traffic } from "./traffic";
import { TrafficLab } from "./traffic-lab";

type Scope = ReturnType<typeof scopeData>;
const titles: Record<string, string> = { home: "Overview", cashflow: "Cashflow", products: "Products", vendors: "Vendors", traffic: "Traffic", audit: "Audit trail" };

export function AdminPage({ route, section, trafficLab }: { route: string; section: string; trafficLab: boolean }) {
  const state = useDemo();
  const [reportOpen,setReportOpen]=useState(false);
  const params = useSearchParams();
  const requestedDays = Number(params.get("days"));
  const days = [1, 7, 14].includes(requestedDays) ? requestedDays : 7;
  const zone = params.get("zone") ?? "";
  const vendorId = params.get("stall") ?? "";
  const zones = [...new Set(state.vendors.map(vendor => vendor.zone))];
  const data = scopeData(state, days, zone, vendorId);
  const filter = ["home", "cashflow", "products", "traffic"].includes(section);
  return <OpsShell kind="admin" route={route} title={titles[section]}>
    {section !== "traffic" && <div className="page-heading"><div><h1>{section === "home" ? "Cafeteria overview" : titles[section]}</h1><p>{section === "home" ? "Pickup activity, stalls and cashflow in one place." : section === "cashflow" ? "Trace receipts and expenses across the cafeteria." : section === "products" ? "See what sells and where stock needs attention." : section === "vendors" ? "Manage stalls, intake approval, and food court assignments." : "Review changes made in this browser’s sample."}</p></div>{section === "cashflow" && <span className="badge neutral">Cashflow</span>}</div>}
    {filter && <div className="filters ops-filters">
      {section !== "traffic" && <label className="field compact">Period<select value={days} onChange={event => replaceFilters({ days: event.target.value })}><option value={1}>Today</option><option value={7}>Last 7 days</option><option value={14}>Last 14 days</option></select></label>}
      <label className="field compact">Food court<select value={zone} onChange={event => replaceFilters({ zone: event.target.value, stall: "" })}><option value="">All zones</option>{zones.map(name => <option key={name}>{name}</option>)}</select></label>
      <label className="field compact">Stall<select value={vendorId} onChange={event => replaceFilters({ stall: event.target.value })}><option value="">All stalls</option>{state.vendors.filter(vendor => !zone || vendor.zone === zone).map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label>
      {section !== "traffic" && <ScenarioSelect />}
      <button className="button secondary" onClick={()=>setReportOpen(true)}>Generate report</button>
    </div>}
    {section === "home" && <RoleHero role="admin"/>}
    {section === "home" && <Overview data={data} days={days} />}
    {section === "cashflow" && <Cashflow data={data} days={days} />}
    {section === "products" && <Products data={data} />}
    {section === "vendors" && <Vendors />}
    {section === "traffic" && <div className="stack"><Traffic admin zone={zone} vendorId={vendorId} />{trafficLab && <TrafficLab stalls={state.vendors} />}</div>}
    {section === "audit" && <Audit />}
    {reportOpen && <ReportDialog role="admin" close={()=>setReportOpen(false)}/>}
  </OpsShell>;
}

function Metric({ label, value, Icon, tone = "" }: { label: string; value: string | number; Icon: typeof Clock3; tone?: string }) {
  return <section className="metric"><div><span>{label}{label==="Net flow"&&<InfoTip label={label} text="Receipts minus expenses, including reversals."/>}{label==="Low-stock products"&&<InfoTip label={label} text="Published meals with five portions or fewer."/>}</span><strong>{value}</strong></div><span className={"metric-icon " + tone}><Icon size={20} aria-hidden /></span></section>;
}

function Overview({ data, days }: { data: Scope; days: number }) {
  const state = useDemo();
  const params = useSearchParams();
  const active = data.orders.filter(order => isActive(order.status));
  const lowStock = state.items.filter(item => item.active && data.vendors.some(vendor => vendor.id === item.vendorId) && itemStock(state, item) <= 5);
  const pressure = data.vendors.find(vendor => loadFor(state, vendor, 0).units >= vendor.capacity);
  const target = new URLSearchParams(params);
  const affectedStall = pressure?.id ?? lowStock[0]?.vendorId;
  if (affectedStall) target.set("stall", affectedStall);
  const toTraffic = Boolean(pressure) || !lowStock.length;
  return <div className="stack"><Recommendation label="FIF Ops Desk" title={pressure ? pressure.name + " has a full pickup window" : lowStock.length ? "Low stock at " + data.vendors.find(vendor => vendor.id === lowStock[0].vendorId)?.name : "Review the cafeteria’s pickup activity"} evidence={pressure ? slotLabel(0) + " has reached its " + pressure.capacity + "-unit limit. Compare capacity at the other stalls." : lowStock.length ? lowStock.length + " published items have five portions or fewer in this view." : "See scheduled pickups and available work units by zone."} href={(toTraffic ? "/admin/traffic" : "/admin/products") + "?" + target.toString()} action={toTraffic ? "View traffic" : "Review products"} />
    <div className="metrics"><Metric label="Net flow" value={money(data.finance.net)} Icon={WalletCards} tone="green" /><Metric label="Pickups due today" value={active.filter(order => order.day === dayKey()).length} Icon={Clock3} /><Metric label="Active orders" value={active.length} Icon={ReceiptText} /><Metric label="Low-stock products" value={lowStock.length} Icon={Package} tone="amber" /></div>
    <AdminInsights data={data} days={days}/><CashflowChart entries={data.entries} days={days} />
    <section className="panel"><div className="line spread wrap"><h2>Stall performance</h2><Link className="quiet-link" href="/admin/vendors">Manage vendors <ArrowRight size={16} aria-hidden /></Link></div><div className="table-wrap"><table><thead><tr><th>Stall</th><th>Orders</th><th>Active</th><th>Capacity / 15 min</th><th>Late pickups</th><th>Net flow</th></tr></thead><tbody>{data.vendors.map(vendor => {
      const orders = data.orders.filter(order => order.vendorId === vendor.id);
      return <tr key={vendor.id}><th scope="row">{vendor.name}<small>{vendor.zone}</small></th><td>{orders.length}</td><td>{orders.filter(order => isActive(order.status)).length}</td><td>{vendor.capacity} units</td><td>{orders.filter(order => order.readyLate).length}</td><td>{money(totals(data.entries.filter(entry => entry.vendorId === vendor.id)).net)}</td></tr>;
    })}</tbody></table></div>{data.vendors.length === 0 && <p className="muted">No stalls match these filters.</p>}</section>
  </div>;
}

const entryNames = { demo: "Online collection", counter: "Counter-confirmed receipt", expense: "Paid expense", reversal: "Expense reversal" };

function Cashflow({ data, days }: { data: Scope; days: number }) {
  const state = useDemo();
  const [entry, setEntry] = useState<Entry>();
  const [create, setCreate] = useState(false);
  const [kind, setKind] = useState("");
  const pending = data.orders.filter(order => isActive(order.status) && order.payment === "counter").reduce((sum, order) => sum + order.total, 0);
  const orderValue = data.orders.filter(order => order.status !== "cancelled" && order.status !== "rejected").reduce((sum, order) => sum + order.total, 0);
  const overhead = totals(data.entries.filter(candidate => !candidate.vendorId));
  const entries = data.entries.filter(candidate => !kind || candidate.type === kind).sort((a, b) => b.day.localeCompare(a.day));
  return <div className="stack">
    <div className="metrics"><Metric label="Collected receipts" value={money(data.finance.inflow)} Icon={Banknote} tone="green" /><Metric label="Paid expenses" value={money(data.finance.expense)} Icon={ReceiptText} /><Metric label="Expense reversals" value={money(data.finance.reversal)} Icon={ReceiptText} /><Metric label="Net flow" value={money(data.finance.net)} Icon={WalletCards} tone="amber" /></div>
    <div className="panel breakdown"><span>Online collections <strong>{money(data.finance.demo)}</strong></span><span>Counter-confirmed <strong>{money(data.finance.counter)}</strong></span><span>Outstanding at counter <strong>{money(pending)}</strong></span><span>Ordered value <strong>{money(orderValue)}</strong></span><span>Shared overhead <strong>{money(overhead.expense - overhead.reversal)}</strong></span></div>
    <CashflowChart entries={data.entries} days={days} />
    <section className="panel"><div className="line spread wrap"><h2>Cashflow ledger</h2><button className="button primary" onClick={() => setCreate(true)}><Plus size={17} aria-hidden /> Record expense</button></div>
    <div className="filters"><label className="field compact">Entry type<select value={kind} onChange={event => setKind(event.target.value)}><option value="">All entries</option>{Object.entries(entryNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    <div className="table-wrap"><table><thead><tr><th>Date</th><th>Description</th><th>Stall</th><th>Type</th><th>Amount</th><th>Action</th></tr></thead><tbody>{entries.map(candidate => <tr key={candidate.id}><td>{dayLabel(candidate.day)}</td><th scope="row">{candidate.label}</th><td>{state.vendors.find(vendor => vendor.id === candidate.vendorId)?.name ?? "Shared overhead"}</td><td>{entryNames[candidate.type]}</td><td>{candidate.type === "expense" ? "−" : "+"}{money(candidate.amount)}</td><td>{candidate.type === "expense" && (state.entries.some(value => value.originalId === candidate.id) ? <span className="badge neutral">Reversed</span> : <button className="button secondary" aria-label={"Reverse expense " + candidate.label} onClick={() => setEntry(candidate)}>Reverse</button>)}</td></tr>)}</tbody></table></div>{entries.length === 0 && <p className="muted">No ledger entries match these filters.</p>}</section>
    {create && <Expense close={() => setCreate(false)} defaultVendor={data.vendors.length === 1 ? data.vendors[0].id : ""} />}
    {entry && <Expense entry={entry} close={() => setEntry(undefined)} defaultVendor="" />}
  </div>;
}

function Expense({ entry, close, defaultVendor }: { entry?: Entry; close: () => void; defaultVendor: string }) {
  const { vendors } = useDemo();
  const [vendorId, setVendorId] = useState(defaultVendor);
  const [category, setCategory] = useState("Ingredients");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  return <Modal title={entry ? "Reverse expense" : "Record expense"} close={close}><form className="stack" onSubmit={event => {
    event.preventDefault();
    try { if (entry) reverseExpense(entry.id, note); else addExpense(vendorId, Math.round(Number(amount) * 100), category + (note.trim() ? " · " + note.trim() : "")); close(); }
    catch (problem) { setError((problem as Error).message); }
  }}>
    {entry ? <p>{entry.label} · {money(entry.amount)}. A separate reversal will be added to the ledger.</p> : <>
      <label className="field">Amount (RM)<input autoFocus required type="number" min="0.01" max="10000" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} /></label>
      <label className="field">Category<select value={category} onChange={event => setCategory(event.target.value)}>{["Ingredients", "Labour", "Supplies", "Other"].map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="field">Stall<select value={vendorId} onChange={event => setVendorId(event.target.value)}><option value="">Shared cafeteria overhead</option>{vendors.map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label>
    </>}
    <label className="field">{entry ? "Reason" : "Note (optional)"}<textarea required={Boolean(entry)} maxLength={100} value={note} onChange={event => setNote(event.target.value)} /></label><ErrorMessage message={error} /><button className="button primary">{entry ? "Confirm reversal" : "Save expense"}</button>
  </form></Modal>;
}

function Products({ data }: { data: Scope }) {
  const state = useDemo();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("units");
  const [low, setLow] = useState(false);
  const items = state.items.filter(item => data.vendors.some(vendor => vendor.id === item.vendorId) && item.name.toLowerCase().includes(query.toLowerCase())).map(item => {
    const sales = data.orders.filter(order => order.status === "collected").flatMap(order => order.lines.filter(line => line.itemId === item.id));
    return { item, stock: itemStock(state, item), units: sales.reduce((sum, line) => sum + line.quantity, 0), value: sales.reduce((sum, line) => sum + line.quantity * line.unit, 0) };
  }).filter(row => !low || row.stock <= 5).sort((a, b) => sort === "stock" ? a.stock - b.stock : sort === "value" ? b.value - a.value : b.units - a.units);
  return <section className="panel"><div className="filters"><label className="field grow">Search products<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label><label className="field">Sort by<select value={sort} onChange={event => setSort(event.target.value)}><option value="units">Units collected</option><option value="value">Fulfilled value</option><option value="stock">Lowest stock</option></select></label><label className="check"><input type="checkbox" checked={low} onChange={event => setLow(event.target.checked)} /> Low stock only</label></div>
    <div className="table-wrap"><table><thead><tr><th>Product</th><th>Stall</th><th>Units collected</th><th>Fulfilled value</th><th>Current stock</th><th>Status</th></tr></thead><tbody>{items.map(({ item, stock, units, value }) => <tr key={item.id}><th scope="row">{item.name}</th><td>{state.vendors.find(vendor => vendor.id === item.vendorId)?.name}</td><td>{units}</td><td>{money(value)}</td><td>{stock} {stock <= 5 && <span className="badge warning">Low stock</span>}</td><td>{item.active ? "Published" : "Hidden"}</td></tr>)}</tbody></table></div>{items.length === 0 && <div className="ops-empty-note"><WarmIllustration name="item_unavailable"/><p className="muted">No products match these filters. Try another search or food court.</p></div>}</section>;
}

function Vendors() {
  const state = useDemo();
  const [vendor, setVendor] = useState<Vendor>();
  const [status, setStatus] = useState<Vendor["status"]>("approved");
  const [zone, setZone] = useState("");
  const [reason, setReason] = useState("");
  const zones = [...new Set(state.vendors.map(candidate => candidate.zone))];
  return <section className="panel"><div className="table-wrap"><table><thead><tr><th>Stall</th><th>Food court</th><th>Approval</th><th>Intake</th><th>Active orders</th><th>Action</th></tr></thead><tbody>{state.vendors.map(candidate => <tr key={candidate.id}><th scope="row"><span className="line"><Store size={16} aria-hidden /> {candidate.name}</span></th><td>{candidate.zone}</td><td><span className={"badge " + (candidate.status === "approved" ? "good" : "warning")}>{candidate.status === "approved" ? "Approved" : "Suspended"}</span></td><td>{candidate.paused || candidate.status !== "approved" ? "Paused" : "Accepting orders"}</td><td>{state.orders.filter(order => order.vendorId === candidate.id && order.scenario === state.scenario && isActive(order.status)).length}</td><td><button className="button secondary" aria-label={"Manage " + candidate.name} onClick={() => { setVendor(candidate); setStatus(candidate.status); setZone(candidate.zone); setReason(""); }}>Manage</button></td></tr>)}</tbody></table></div>
    {vendor && <Modal title={"Manage " + vendor.name} close={() => setVendor(undefined)}><form className="stack" onSubmit={event => {
      event.preventDefault();
      if (!reason.trim()) return;
      saveVendor(vendor.id, { zone, status }, "Admin", reason.trim()); setVendor(undefined);
    }}><label className="field">Approval<select value={status} onChange={event => setStatus(event.target.value as Vendor["status"])}><option value="approved">Approved</option><option value="suspended">Suspended</option></select></label><label className="field">Food court<select value={zone} onChange={event => setZone(event.target.value)}>{zones.map(name => <option key={name}>{name}</option>)}</select></label><label className="field">Reason<textarea required value={reason} maxLength={150} onChange={event => setReason(event.target.value)} /></label><button className="button primary">Save vendor changes</button></form></Modal>}
  </section>;
}

function Audit() {
  const state = useDemo();
  const [actor, setActor] = useState("");
  const [query, setQuery] = useState("");
  const entries = state.audit.filter(entry => (!actor || entry.actor === actor) && (entry.target + " " + entry.action + " " + entry.detail).toLowerCase().includes(query.toLowerCase()));
  return <section className="panel"><div className="filters"><label className="field grow">Search audit trail<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label><label className="field">Actor<select value={actor} onChange={event => setActor(event.target.value)}><option value="">All roles</option>{["Student", "Vendor", "Admin", "Initial setup"].map(value => <option key={value}>{value}</option>)}</select></label></div>
    <div className="table-wrap"><table><thead><tr><th>Time (MYT)</th><th>Actor</th><th>Action</th><th>Target</th><th>Detail</th></tr></thead><tbody>{entries.map(entry => <tr key={entry.id}><td>{new Date(entry.at).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur", dateStyle: "medium", timeStyle: "short" })}</td><td>{entry.actor}</td><td>{entry.action}</td><th scope="row">{entry.target}</th><td>{entry.detail || "—"}</td></tr>)}</tbody></table></div>{entries.length === 0 && <p className="muted">No audit events match these filters.</p>}</section>;
}
