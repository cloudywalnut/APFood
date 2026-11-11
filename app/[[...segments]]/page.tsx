import { notFound } from "next/navigation";
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
  if (segments.length > 3) notFound();
  if (!portal) return <PublicPage page="home" hosted={hosted} />;
  if (segments.length === 1 && ["privacy", "terms", "cookies"].includes(portal)) return <PublicPage page={portal} hosted={hosted} />;
  if (portal === "auth" && !id && ["login", "register", "verify-email", "forgot-password", "reset-password", "accept-invite"].includes(section)) return hosted ? <AuthScreen screen={section} /> : <PublicPage page={section === "register" ? "register" : "login"} />;
  if (portal === "account" && segments.length === 1) return hosted ? <AccountScreen /> : <PublicPage page="login" />;
  if (portal === "app" && ["home", "vendors", "cart", "checkout", "orders", "traffic"].includes(section) && (!id || section === "vendors" || section === "orders")) {
    return hosted ? <HostedStudent route={route} section={section} id={id} /> : <StudentPage route={route} section={section} id={id} />;
  }
  if (portal === "vendor" && ["home", "orders", "menu", "capacity", "payments"].includes(section) && (!id || section === "orders")) {
    if (!hosted && section === "payments") return <PublicPage page="login" />;
    return hosted ? <HostedVendor route={route} section={section} id={id} /> : <VendorPage route={route} section={section} id={id} />;
  }
  if (portal === "admin" && !id && ["home", "cashflow", "products", "vendors", "traffic", "audit", "users"].includes(section)) {
    if (!hosted && section === "users") return <PublicPage page="login" />;
    return hosted ? <HostedAdmin route={route} section={section} /> : <AdminPage route={route} section={section} trafficLab={trafficLabEnabled()} />;
  }
  notFound();
}
