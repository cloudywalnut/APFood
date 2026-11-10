import { notFound } from "next/navigation";
import { AdminPage } from "../../components/admin";
import { PublicPage } from "../../components/public-page";
import { StudentPage } from "../../components/student";
import { VendorPage } from "../../components/vendor";

export default async function Page({ params }: { params: Promise<{ segments?: string[] }> }) {
  const { segments = [] } = await params;
  const [portal, section = "home", id] = segments;
  const route = "/" + segments.join("/");
  if (segments.length > 3) notFound();
  if (!portal) return <PublicPage page="home" />;
  if (segments.length === 1 && ["privacy", "terms", "cookies"].includes(portal)) return <PublicPage page={portal} />;
  if (portal === "auth" && !id && ["login", "register"].includes(section)) return <PublicPage page={section} />;
  if (portal === "app" && ["home", "vendors", "cart", "checkout", "orders", "traffic"].includes(section) && (!id || section === "vendors" || section === "orders")) return <StudentPage route={route} section={section} id={id} />;
  if (portal === "vendor" && ["home", "orders", "menu", "capacity"].includes(section) && (!id || section === "orders")) return <VendorPage route={route} section={section} id={id} />;
  if (portal === "admin" && !id && ["home", "cashflow", "products", "vendors", "traffic", "audit"].includes(section)) return <AdminPage route={route} section={section} />;
  notFound();
}
