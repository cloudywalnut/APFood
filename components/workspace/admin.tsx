"use client";
import { OpsShell } from "../shared";
import { WorkspaceAccess } from "./common";
import { TrafficView } from "./traffic";
import { Users } from "./users";
import { AdminControlCentre } from "../admin/overview";
import { AdminAudit } from "../admin/audit";
const titles: Record<string, string> = {
  home: "Cafeteria overview",
  cashflow: "Financials",
  products: "Products",
  vendors: "Vendors",
  traffic: "Traffic & pickups",
  audit: "Audit trail",
  users: "User management",
};
export function AdminWorkspace({ route, section }: { route: string; section: string }) {
  return (
    <WorkspaceAccess role="admin">
      {() => (
        <OpsShell kind="admin" route={route} title={titles[section]}>
          <div className="admin-panel">
            {section === "users" ? (
              <>
                <header className="admin-overview-header">
                  <div>
                    <span className="admin-eyebrow">PEOPLE & ACCESS</span>
                    <h1>User management</h1>
                    <p>Manage vendor assignments and account access.</p>
                  </div>
                </header>
                <Users />
              </>
            ) : section === "audit" ? (
              <AdminAudit />
            ) : section === "traffic" ? (
              <TrafficView admin />
            ) : (
              <AdminControlCentre
                view={
                  ["cashflow", "products", "vendors"].includes(section)
                    ? (section as "cashflow" | "products" | "vendors")
                    : "home"
                }
              />
            )}
          </div>
        </OpsShell>
      )}
    </WorkspaceAccess>
  );
}
