import { notFound, redirect } from "next/navigation";
import { HostedExtras } from "../../components/hosted/extras";
import { APExtraPage } from "../../components/apspace/extras";
import { APLanding } from "../../components/apspace/landing";
import { AdminPage } from "../../components/admin";
import { PublicPage } from "../../components/public-page";
import { StudentPage } from "../../components/student";
import { VendorPage } from "../../components/vendor";
import { AccountScreen, AuthScreen } from "../../components/hosted/auth";
import { HostedStudent } from "../../components/hosted/student";
import { HostedVendor } from "../../components/hosted/vendor";
import { HostedAdmin } from "../../components/hosted/admin";
import { trafficLabEnabled } from "../../lib/traffic-lab";

export default async function Page({ params }: { params: Promise<{ segments?: string[] }> }) {
  const { segments = [] } = await params;
  const [portal, section = "home", id] = segments;
  const route = "/" + segments.join("/");
  const dataMode = process.env.AP_FOOD_DATA_MODE || "mock";
  if (dataMode !== "mock" && dataMode !== "supabase") throw new Error("AP_FOOD_DATA_MODE must be mock or supabase.");
  const hosted = dataMode === "supabase";
  if (portal === "app" && section === "map" && segments.length === 2) return hosted ? <HostedStudent route={route} section="map" /> : <StudentPage route="/app/vendors" section="vendors" />;
  if (portal === "app" && section === "vendors" && id === "area" && segments.length === 4) return hosted ? <HostedStudent route={route} section="area" id={segments[3]} /> : <StudentPage route={route} section="area" id={segments[3]} />;
  if (portal === "app" && section === "vendors" && segments[3] === "item" && segments.length === 5) return hosted ? <HostedStudent route={route} section="vendors" id={id} itemId={segments[4]} /> : <StudentPage route={route} section="item" id={id} itemId={segments[4]} />;
  if (segments.length > 3) notFound();
  if (["app", "vendor", "admin"].includes(portal ?? "") && ["more", "reports", "settings", "notifications"].includes(section) && !id) {
    const role = portal === "app" ? "student" : portal as "vendor" | "admin";
    return hosted ? <HostedExtras role={role} section={section} route={route} /> : <APExtraPage role={role} section={section} route={route} />;
  }
  if (!portal) return hosted ? <AuthScreen screen="login" /> : <PublicPage page="home" />;
  if (portal === "welcome" && segments.length === 1) return hosted ? <PublicPage page="home" hosted /> : <APLanding />;
  if (segments.length === 1 && ["privacy", "terms", "cookies"].includes(portal)) return <PublicPage page={portal} hosted={hosted} />;
  if (portal === "auth" && !id && ["login", "register", "verify-email", "forgot-password", "reset-password", "accept-invite"].includes(section)) return hosted ? <AuthScreen screen={section} /> : <PublicPage page={section === "register" ? "register" : "login"} />;
  if (portal === "account" && segments.length === 1) return hosted ? <AccountScreen /> : <PublicPage page="login" />;
  if (portal === "app" && ["home", "vendors", "cart", "checkout", "orders", "history", "traffic"].includes(section) && (!id || section === "vendors" || section === "orders")) {
    return hosted ? <HostedStudent route={route} section={section} id={id} /> : <StudentPage route={route} section={section} id={id} />;
  }
  if (portal === "vendor" && section === "capacity") redirect("/vendor/insights");
  if (portal === "vendor" && ["home", "orders", "menu", "insights", "payments"].includes(section) && (!id || section === "orders")) {
    if (!hosted && (section === "payments" || section === "insights")) return <PublicPage page="login" />;
    return hosted ? <HostedVendor route={route} section={section} id={id} /> : <VendorPage route={route} section={section} id={id} />;
  }
  if (portal === "admin" && !id && ["home", "cashflow", "products", "vendors", "traffic", "audit", "users"].includes(section)) {
    if (!hosted && section === "users") return <PublicPage page="login" />;
    return hosted ? <HostedAdmin route={route} section={section} /> : <AdminPage route={route} section={section} trafficLab={trafficLabEnabled()} />;
  }
  notFound();
}
