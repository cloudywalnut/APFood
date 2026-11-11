"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { ArrowRight, ArrowUpRight, BarChart3, ChefHat, ClipboardList, Clock3, House, LayoutDashboard, ReceiptText, ShoppingBag, Store, Utensils, WalletCards, X } from "lucide-react";
import { WarmIllustration, type WarmArt } from "./apspace/illustration";
import { APSpaceBrand, APSpaceHeader, MobileTour, roleModules } from "./apspace/shell";
import { BackNavigation } from "./apspace/back-navigation";
import { ModalSheet } from "./apspace/ui";
import { scenarioNames, scenarios, statusNames, type Scenario, type Status } from "../lib/demo";
import { selectScenario, useDemo } from "../lib/demo-store";

export function Brand() {
  return <APSpaceBrand />;
}

export function Footer() {
  return <footer className="footer"><nav aria-label="Policies"><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms and Conditions</Link><Link href="/cookies">Cookies</Link></nav></footer>;
}

export function StudentShell({ route, children, cartCount }: { route: string; children: ReactNode; cartCount?: number }) {
  const state = useDemo();
  const count = state.cart.reduce((sum, line) => sum + line.quantity, 0);
  return <div className="student-theme ap-role-shell"><APSpaceHeader role="student" route={route} cartCount={cartCount} hosted={cartCount !== undefined}/><main id="main-content" className="student-main"><BackNavigation route={route}/>{children}</main><Footer/><MobileTour/></div>;

}

export function OpsShell({ kind, route, title, children, hosted = false }: { kind: "vendor" | "admin"; route: string; title: string; children: ReactNode; hosted?: boolean }) {
  const searchParams=useSearchParams();
  const filters = kind === "vendor" ? "" : searchParams.toString();
  return <div className="ops-theme ap-role-shell"><APSpaceHeader role={kind} route={route} hosted={hosted}/><div className="ap-ops-content"><main id="main-content" className="ops-main"><BackNavigation route={route}/>{children}</main></div><Footer/></div>;

}

export function replaceFilters(changes: Record<string, string>) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(changes)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  window.history.replaceState(null, "", url);
}

export function ScenarioNotice() { return null; }

export function ScenarioSelect() {
  const { scenario } = useDemo();
  return <label className="field compact">Data source<select value={scenario} onChange={event => selectScenario(event.target.value as Scenario)}>{scenarios.map(value => <option key={value} value={value}>{scenarioNames[value]}</option>)}</select></label>;
}

export function StatusBadge({ status }: { status: Status }) {
  return <span className={"badge status-" + status}>{statusNames[status]}</span>;
}

export function Recommendation({ label, title, evidence, href, action }: { label: string; title: string; evidence: string; href: string; action: string }) {
  return <section className="recommendation"><div><div className="recommendation-meta"><span>{label}</span></div><h2>{title}</h2><p>{evidence}</p></div><Link href={href} className="button secondary">{action} <ArrowRight size={16} aria-hidden /></Link></section>;
}

export function Empty({ title, detail, href, action }: { title: string; detail: string; href?: string; action?: string }) {
  const art:WarmArt=title.toLowerCase().includes("cart")?"empty_cart":title.toLowerCase().includes("order")?(title.toLowerCase().includes("unavailable")?"invalid_session":"no_orders"):title.toLowerCase().includes("stall")?"stall_closed":"item_unavailable";
  return <section className="panel empty"><WarmIllustration name={art}/><h2>{title}</h2><p>{detail}</p>{href && <Link className="button primary" href={href}>{action}</Link>}</section>;
}

export function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  return <ModalSheet title={title} close={close}>{children}</ModalSheet>;

}

export function ErrorMessage({ message }: { message: string }) {
  return message ? <p className="error" role="alert">{message}</p> : null;
}
