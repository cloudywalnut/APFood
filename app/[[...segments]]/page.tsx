import { APExtraPage } from "../../components/apspace/extras";
import { notFound, redirect } from "next/navigation";
import { AdminPage } from "../../components/admin";
import { PublicPage } from "../../components/public-page";
import { StudentPage } from "../../components/student";
import { VendorPage } from "../../components/vendor";

export default async function Page({ params }: { params: Promise<{ segments?: string[] }> }) {
  const { segments = [] } = await params;
  const [portal, section = "home", id] = segments;
  const route = "/" + segments.join("/");
  if(portal==='app'&&section==='map')redirect('/app/vendors');
  if(portal==='app'&&section==='vendors'&&id==='area'&&segments.length===4)return <StudentPage route={route} section="area" id={segments[3]}/>;
  if(portal==='app'&&section==='vendors'&&segments[3]==='item'&&segments.length===5)return <StudentPage route={route} section="item" id={id} itemId={segments[4]}/>;
  if (segments.length > 3) notFound();
  if (["app","vendor","admin"].includes(portal??"") && ["more","settings","reports","notifications"].includes(section) && !id) return <APExtraPage role={portal==="app"?"student":portal as "vendor"|"admin"} section={section} route={route}/>;
  if (!portal) return <PublicPage page="home" />;
  if (segments.length === 1 && ["privacy", "terms", "cookies"].includes(portal)) return <PublicPage page={portal} />;
  if (portal === "auth" && !id && ["login", "register"].includes(section)) return <PublicPage page={section} />;
  if (portal === "app" && ["home", "vendors", "map", "cart", "checkout", "orders", "traffic"].includes(section) && (!id || section === "vendors" || section === "orders")) return <StudentPage route={route} section={section} id={id} />;
  if (portal === "vendor" && ["home", "orders", "menu", "capacity"].includes(section) && (!id || section === "orders")) return <VendorPage route={route} section={section} id={id} />;
  if (portal === "admin" && !id && ["home", "cashflow", "products", "vendors", "traffic", "audit"].includes(section)) return <AdminPage route={route} section={section} />;
  notFound();
}
