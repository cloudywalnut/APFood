"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { StorefrontHeader } from "./storefront/header";
import { FifAssistant } from "./storefront/fif-assistant";
import { StudentFifAssistant } from "./storefront/student-fif-assistant";
import { AdminFifAssistant } from "./workspace/admin-fif-assistant";
import { OpsLoadingScreen } from "./workspace/ops-loading-screen";
import { SiteFooter } from "./legal/footer";
import { WarmIllustration, type WarmArt } from "./ui/illustration";
import { BrandLogo, WorkspaceHeader, MobileTour } from "./ui/shell";
import { BackNavigation } from "./ui/back-navigation";
import { ModalSheet } from "./ui/primitives";
import { statusNames, type Status } from "../lib/orders";

export function Brand() {
  return <BrandLogo />;
}

export function Footer({ compact = false }: { compact?: boolean }) {
  return <SiteFooter compact={compact} />;
}

export function StudentShell({
  route,
  children,
  cartCount,
  signedIn = true,
}: {
  route: string;
  children: ReactNode;
  cartCount: number;
  signedIn?: boolean;
}) {
  return (
    <div className="student-theme ap-role-shell storefront-theme">
      <StorefrontHeader route={route} cartCount={cartCount} signedIn={signedIn} />
      <main id="main-content" className="student-main">
        {!["/app", "/app/vendors", "/app/map"].includes(route) && !route.startsWith("/app/vendors/") && (
          <BackNavigation route={route} />
        )}
        {children}
      </main>
      <Footer />
      <StudentFifAssistant />
      <MobileTour />
    </div>
  );
}

export function OpsShell({
  kind,
  route,
  children,
}: {
  kind: "vendor" | "admin";
  route: string;
  title: string;
  children: ReactNode;
  hosted?: boolean;
}) {
  const searchParams = useSearchParams();
  const stallId = kind === "vendor" ? (searchParams.get("stall") ?? undefined) : undefined;
  return (
    <div className={"ops-theme ap-role-shell" + (kind === "vendor" ? " vendor-ops-theme" : " admin-ops-theme")}>
      <OpsLoadingScreen />
      <WorkspaceHeader role={kind} route={route} />
      <div className="ap-ops-content">
        <main id="main-content" className="ops-main">
          <BackNavigation route={route} />
          {children}
        </main>
      </div>
      <Footer />
      {kind === "vendor" && <FifAssistant mode="vendor" hosted={true} vendorId={stallId} />}
      {kind === "admin" && <AdminFifAssistant />}
    </div>
  );
}

export function replaceFilters(changes: Record<string, string>) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(changes)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  window.history.replaceState(null, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function StatusBadge({ status }: { status: Status }) {
  return <span className={"badge status-" + status}>{statusNames[status]}</span>;
}

export function Recommendation({
  label,
  title,
  evidence,
  href,
  action,
}: {
  label: string;
  title: string;
  evidence: string;
  href: string;
  action: string;
}) {
  return (
    <section className="recommendation">
      <div>
        <div className="recommendation-meta">
          <span>{label}</span>
        </div>
        <h2>{title}</h2>
        <p>{evidence}</p>
      </div>
      <Link href={href} className="button secondary">
        {action} <ArrowRight size={16} aria-hidden />
      </Link>
    </section>
  );
}

export function Empty({
  title,
  detail,
  href,
  action,
  art,
}: {
  title: string;
  detail: string;
  href?: string;
  action?: string;
  art?: WarmArt;
}) {
  const chosen: WarmArt =
    art ??
    (title.toLowerCase().includes("cart")
      ? "empty_cart"
      : title.toLowerCase().includes("order")
        ? title.toLowerCase().includes("unavailable")
          ? "invalid_session"
          : "no_orders"
        : title.toLowerCase().includes("stall")
          ? "stall_closed"
          : "item_unavailable");
  return (
    <section className="panel empty">
      <WarmIllustration name={chosen} />
      <h2>{title}</h2>
      <p>{detail}</p>
      {href && (
        <Link className="button primary" href={href}>
          {action}
        </Link>
      )}
    </section>
  );
}

export function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  return (
    <ModalSheet title={title} close={close}>
      {children}
    </ModalSheet>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <p className="error" role="alert">
      {message}
    </p>
  ) : null;
}
