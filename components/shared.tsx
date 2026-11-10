"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { ArrowRight, ArrowUpRight, BarChart3, ChefHat, ClipboardList, Clock3, House, LayoutDashboard, ReceiptText, ShoppingBag, Store, Utensils, WalletCards, X } from "lucide-react";
import { scenarioNames, scenarios, statusNames, type Scenario, type Status } from "../lib/demo";
import { selectScenario, useDemo } from "../lib/demo-store";

export function Brand() {
  return <Link className="brand" href="/" aria-label="AP Food home"><Image src="/ap-food-mark.svg" width={37} height={37} alt="" unoptimized /><span>AP<span className="brand-food">Food</span></span></Link>;
}

export function Footer() {
  return <footer className="footer"><span>AP Food · Campus pickup demo</span><nav aria-label="Policies"><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms and Conditions</Link><Link href="/cookies">Cookies</Link></nav></footer>;
}

const studentLinks = [
  ["/app", "Home", House], ["/app/vendors", "Explore", Store], ["/app/orders", "Orders", ReceiptText], ["/app/traffic", "Traffic", BarChart3],
] as const;
const vendorLinks = [
  ["/vendor", "Shift", LayoutDashboard], ["/vendor/orders", "Kitchen", ChefHat], ["/vendor/menu", "Menu", Utensils], ["/vendor/capacity", "Capacity", Clock3],
] as const;
const adminLinks = [
  ["/admin", "Overview", LayoutDashboard], ["/admin/cashflow", "Cashflow", WalletCards], ["/admin/products", "Products", ShoppingBag], ["/admin/vendors", "Vendors", Store], ["/admin/traffic", "Traffic", BarChart3], ["/admin/audit", "Audit", ClipboardList],
] as const;

export function StudentShell({ route, children }: { route: string; children: ReactNode }) {
  const state = useDemo();
  const count = state.cart.reduce((sum, line) => sum + line.quantity, 0);
  return <div className="student-theme">
    <header className="student-header"><div className="student-bar"><Brand /><nav className="student-nav" aria-label="Student navigation">
      {studentLinks.map(([href, label, Icon], index) => {
        const current = route === href || (index > 0 && route.startsWith(href + "/"));
        return <Link href={href} key={href} aria-current={current ? "page" : undefined}><Icon size={17} aria-hidden /><span>{label}</span></Link>;
      })}
    </nav><Link className="button secondary cart-link" href="/app/cart"><ShoppingBag size={17} aria-hidden /> Cart{count > 0 && <span className="cart-count">{count}</span>}</Link></div></header>
    <main id="main-content" className="student-main"><ScenarioNotice />{children}</main><Footer />
  </div>;
}

export function OpsShell({ kind, route, title, children }: { kind: "vendor" | "admin"; route: string; title: string; children: ReactNode }) {
  const links = kind === "vendor" ? vendorLinks : adminLinks;
  const filters = useSearchParams().toString();
  return <div className="ops-theme">
    <aside className="ops-sidebar"><div className="ops-brand"><Brand /></div>
      <div className="workspace-label">{kind === "admin" ? "Cafeteria management" : "Vendor workspace"}</div>
      <nav aria-label={kind + " navigation"}>{links.map(([href, label, Icon], index) => {
        const current = route === href || (index > 0 && route.startsWith(href + "/"));
        return <Link href={filters ? href + "?" + filters : href} key={href} aria-current={current ? "page" : undefined}><Icon size={18} aria-hidden /><span>{label}</span></Link>;
      })}</nav>
      <div className="ops-profile"><span className="profile-initials">{kind === "admin" ? "CO" : "FO"}</span><span><strong>{kind === "admin" ? "Campus operations" : "Food stall operator"}</strong><small>Demo workspace</small></span></div>
    </aside>
    <div className="ops-body">
      <header className="ops-top"><span className="ops-title">{title}</span><div className="ops-top-actions"><span className="badge neutral">Frontend demo</span><Link href="/" className="quiet-link">Switch portal <ArrowUpRight size={15} aria-hidden /></Link></div></header>
      <main id="main-content" className="ops-main"><ScenarioNotice />{children}</main><Footer />
    </div>
  </div>;
}

export function replaceFilters(changes: Record<string, string>) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(changes)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  window.history.replaceState(null, "", url);
}

export function ScenarioNotice() {
  const { scenario } = useDemo();
  return scenario !== "standard" ? <div className="notice" role="status"><strong>Simulated traffic · {scenarioNames[scenario]}</strong><span>Using fictional orders and pickup activity.</span></div> : null;
}

export function ScenarioSelect() {
  const { scenario } = useDemo();
  return <label className="field compact">Data source<select value={scenario} onChange={event => selectScenario(event.target.value as Scenario)}>{scenarios.map(value => <option key={value} value={value}>{scenarioNames[value]}</option>)}</select></label>;
}

export function StatusBadge({ status }: { status: Status }) {
  return <span className={"badge status-" + status}>{statusNames[status]}</span>;
}

export function Recommendation({ label, title, evidence, href, action }: { label: string; title: string; evidence: string; href: string; action: string }) {
  return <section className="recommendation"><div><div className="recommendation-meta"><span>{label}</span><span className="badge neutral">Demo recommendation</span></div><h2>{title}</h2><p>{evidence}</p></div><Link href={href} className="button secondary">{action} <ArrowRight size={16} aria-hidden /></Link></section>;
}

export function Empty({ title, detail, href, action }: { title: string; detail: string; href?: string; action?: string }) {
  return <section className="panel empty"><h2>{title}</h2><p>{detail}</p>{href && <Link className="button primary" href={href}>{action}</Link>}</section>;
}

export function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog className="dialog" ref={ref} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); close(); }}>
    <div className="dialog-head"><h2 id={titleId}>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={close}><X size={19} aria-hidden /></button></div>
    {children}
  </dialog>;
}

export function ErrorMessage({ message }: { message: string }) {
  return message ? <p className="error" role="alert">{message}</p> : null;
}
