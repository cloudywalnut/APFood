import { notFound, redirect } from "next/navigation";
import { WorkspaceExtras } from "../../components/workspace/extras";
import { PublicPage } from "../../components/public-page";
import { AccountScreen, AuthScreen } from "../../components/workspace/auth";
import { StudentWorkspace } from "../../components/workspace/student";
import { VendorWorkspace } from "../../components/workspace/vendor";
import { AdminWorkspace } from "../../components/workspace/admin";

const authScreens = ["login", "register", "verify-email", "forgot-password", "reset-password", "accept-invite"];
const extraSections = ["more", "reports", "settings", "notifications"];
const studentSections = ["home", "vendors", "cart", "checkout", "orders", "history", "traffic"];
const vendorSections = ["home", "orders", "menu", "insights", "payments"];
const adminSections = ["home", "cashflow", "products", "vendors", "traffic", "audit", "users"];

export default async function Page({ params }: { params: Promise<{ segments?: string[] }> }) {
  const { segments = [] } = await params;
  const [portal, section = "home", id] = segments;
  const route = "/" + segments.join("/");

  // Student routes with deeper paths.
  if (portal === "app" && section === "map" && segments.length === 2)
    return <StudentWorkspace route={route} section="map" />;
  if (portal === "app" && section === "vendors" && id === "area" && segments.length === 4)
    return <StudentWorkspace route={route} section="area" id={segments[3]} />;
  if (portal === "app" && section === "vendors" && segments[3] === "item" && segments.length === 5)
    return <StudentWorkspace route={route} section="vendors" id={id} itemId={segments[4]} />;
  if (segments.length > 3) notFound();
  if (!portal) return <AuthScreen screen="login" />;
  if (portal === "welcome" && segments.length === 1) return <PublicPage page="home" />;
  if (segments.length === 1 && ["privacy", "terms", "cookies"].includes(portal)) return <PublicPage page={portal} />;
  if (portal === "auth" && !id && authScreens.includes(section)) return <AuthScreen screen={section} />;
  if (portal === "account" && segments.length === 1) return <AccountScreen />;
  if (portal === "vendor" && section === "capacity") redirect("/vendor/insights");

  if (["app", "vendor", "admin"].includes(portal) && extraSections.includes(section) && !id) {
    const role = portal === "app" ? "student" : (portal as "vendor" | "admin");
    return <WorkspaceExtras role={role} section={section} route={route} />;
  }
  if (portal === "app" && studentSections.includes(section) && (!id || section === "vendors" || section === "orders"))
    return <StudentWorkspace route={route} section={section} id={id} />;
  if (portal === "vendor" && vendorSections.includes(section) && (!id || section === "orders"))
    return <VendorWorkspace route={route} section={section} id={id} />;
  if (portal === "admin" && !id && adminSections.includes(section))
    return <AdminWorkspace route={route} section={section} />;
  notFound();
}
