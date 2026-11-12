type Role = "student" | "vendor" | "admin";
type Account = { email: string; emailVerified: boolean; memberships: { role: Role }[] };
const portals: Record<Role, string> = { student: "/app", vendor: "/vendor", admin: "/admin" };

export function loginDestination(account: Account, intended?: string) {
  if (!account.emailVerified) return "/auth/verify-email?email=" + encodeURIComponent(account.email);
  if (intended && /^\/(?!\/)/.test(intended) && !/[\\\r\n]/.test(intended)) {
    try {
      const url = new URL(intended, "https://ap-food.invalid");
      const path = decodeURIComponent(url.pathname);
      const role = (Object.keys(portals) as Role[]).find(
        (role) => path === portals[role] || path.startsWith(portals[role] + "/"),
      );
      if (
        !/[\\\r\n]/.test(path) &&
        ((role && account.memberships.some((entry) => entry.role === role)) || path === "/account")
      ) {
        return url.pathname + url.search + url.hash;
      }
    } catch {
      /* Invalid destinations fall back to the verified account's workspace. */
    }
  }
  const role = (["admin", "vendor", "student"] as const).find((role) =>
    account.memberships.some((entry) => entry.role === role),
  );
  return role ? portals[role] : "/account";
}
