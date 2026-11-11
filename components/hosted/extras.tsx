"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { roleModules } from "../apspace/shell";
import { PreferencesView, usePreferences } from "../apspace/extras";
import { HostedAccess, SignOut, useHostedData, useRemote, RemoteStatus, type Role } from "./common";
import { OpsShell, StudentShell } from "../shared";
import { dayKey, money } from "../../lib/demo";
import { pickupWindow } from "../../lib/pickup-time";
import { downloadReport } from "../../lib/report-export";
import type { ReportData } from "../../services/contracts";
import { useHostedCart } from "../../lib/backend/hosted-cart";

export function HostedExtras({ role, section, route }: { role: Role; section: string; route: string }) {
  return <HostedAccess role={role}>{session => {
    const content = <><SignOut />{section === "more" ? <><h1>More tools</h1><div className="ap-module-grid">{roleModules(role, true).map(({ href, label, detail, Icon }) => <Link key={href} href={href}><Icon size={24} /><span><strong>{label}</strong><small>{detail}</small></span></Link>)}</div></>
      : section === "settings" ? <PreferencesView /> : <LiveTools role={role} section={section} />}</>;
    return role === "student" ? <ExtraStudentShell userId={session.userId} route={route}>{content}</ExtraStudentShell> : <OpsShell kind={role} route={route} title={section} hosted>{content}</OpsShell>;
  }}</HostedAccess>;
}

function ExtraStudentShell({ userId, route, children }: { userId: string; route: string; children: React.ReactNode }) {
  const store = useHostedCart(userId);
  return <StudentShell route={route} cartCount={store.cart?.items.reduce((sum, line) => sum + line.quantity, 0) ?? 0}>{children}</StudentShell>;
}

function LiveTools({ role, section }: { role: Role; section: string }) {
  const api = useHostedData();
  const [days, setDays] = useState("7");
  const [stall, setStall] = useState("");
  const [kind, setKind] = useState("orders");
  const [preferences] = usePreferences();
  const load = useCallback(async () => {
    if (role === "admin") { const filters = new URLSearchParams({ days, ...(stall ? { vendorId: stall } : {}) }); return { report: await api.report(filters), orders: await api.adminOrders(filters), stalls: await api.vendors(), events: await api.audit(), menu: [] }; }
    if (role === "student") return { orders: await api.orders(), stalls: await api.vendors(), events: [], menu: [] };
    const stalls = await api.assignedStalls();
    const selected = stall ? stalls.filter(row => row.id === stall) : stalls;
    const reports = await Promise.all(selected.map(row => api.vendorReport(row.id, days)));
    return { orders: (await Promise.all(selected.map(row => api.kitchen(row.id)))).flat(), stalls, events: [], menu: (await Promise.all(selected.map(row => api.vendorMenu(row.id)))).flat(), reports };
  }, [api, role, days, stall]);
  const result = useRemote(load);
  if (!result.value) return <RemoteStatus error={result.error} reload={result.reload} />;
  const data = result.value;
  const names = new Map(data.stalls.map(row => [row.id, row.name]));
  const cutoff = Date.parse(dayKey(1 - Number(days)) + "T00:00:00+08:00");
  const orders = data.orders.filter(row => Date.parse(row.created_at) >= cutoff);
  const report: ReportData = { title: "APFoods " + kind + " report", generatedAt: new Date().toISOString(), timezone: "Asia/Kuala_Lumpur", source: "Supabase · Standard demo · Fictional transactions", columns: [], rows: [] };
  if (data.report) {
    if (kind === "stock") { report.columns = ["Product", "Stall", "Stock", "Published"]; report.rows = data.report.products.map(row => [row.name, names.get(row.vendor_id) ?? row.vendor_id, String(row.stock), String(row.active)]); }
    else if (kind === "orders") { report.columns = ["Order", "Stall", "Pickup", "Status", "Value"]; report.rows = orders.map(row => [row.id, names.get(row.vendor_id) ?? row.vendor_id, pickupWindow(row.pickup_at), row.status, money(row.total_sen)]); }
    else { report.columns = ["Date", "Description", "Type", "Amount"]; report.rows = data.report.ledger.map(row => [row.created_at, row.label, row.kind, money(["expense", "refund"].includes(row.kind) ? -row.amount_sen : row.amount_sen)]); }
    report.summary = [{ label: "Net flow", value: money(data.report.finance.netSen) }];
  } else if (kind === "stock") { report.columns = ["Product", "Stall", "Stock", "Published"]; report.rows = data.menu.map(row => [row.name, names.get(row.vendor_id) ?? row.vendor_id, String(row.stock), String(row.active)]); }
  else if (kind === "finance" && data.reports) { report.columns = ["Date", "Description", "Type", "Amount"]; report.rows = data.reports.flatMap(entry => entry.ledger).map(row => [row.created_at, row.label, row.kind, money(["expense", "refund"].includes(row.kind) ? -row.amount_sen : row.amount_sen)]); }
  else { report.columns = ["Order", "Stall", "Pickup", "Status", "Value"]; report.rows = orders.map(row => [row.id, names.get(row.vendor_id) ?? row.vendor_id, pickupWindow(row.pickup_at), row.status, money(row.total_sen)]); }
  return <div className="stack"><div className="page-heading"><h1>{section === "reports" ? "Your cafeteria report." : "Updates"}</h1><button className="button secondary" onClick={result.reload}>Refresh</button></div>
    {section === "reports" ? <><div className="filters"><label className="field">Report<select value={kind} onChange={event => setKind(event.target.value)}><option value="orders">Orders</option>{role !== "student" && <option value="stock">Stock</option>}{role !== "student" && <option value="finance">Cashflow</option>}</select></label><label className="field">Period<select value={days} onChange={event => setDays(event.target.value)}><option value="1">Today</option><option value="7">7 days</option><option value="14">14 days</option></select></label>{role !== "student" && <label className="field">Stall<select value={stall} onChange={event => setStall(event.target.value)}><option value="">All assigned stalls</option>{data.stalls.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>}</div>
      <p>{report.source}</p><div className="line wrap">{(["pdf", "csv"] as const).map(format => <button className="button primary" key={format} onClick={() => downloadReport(report, format)}>Download {format.toUpperCase()}</button>)}</div>
      <section className="panel table-wrap"><table><thead><tr>{report.columns.map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{report.rows.map((row, index) => <tr key={index}>{row.map((value, cell) => <td key={cell}>{value}</td>)}</tr>)}</tbody></table>{!report.rows.length && <p>No records for this selection.</p>}</section></>
      : !preferences.inAppUpdates ? <p>Updates are turned off in Settings.</p> : <section className="panel"><div className="ap-notification-list">{role === "admin" ? data.events.map(event => <p key={event.id}><strong>{event.action}</strong> · {event.target} · {new Date(event.created_at).toLocaleString("en-MY", { timeZone: preferences.localTimezone ? undefined : "Asia/Kuala_Lumpur" })}</p>) : orders.map(order => <Link key={order.id} href={(role === "vendor" ? "/vendor" : "/app") + "/orders/" + order.id}><strong>{names.get(order.vendor_id)}</strong><span>{order.status} · {pickupWindow(order.pickup_at)}</span></Link>)}{!orders.length && !data.events.length && <p>No updates yet.</p>}</div></section>}
  </div>;
}
