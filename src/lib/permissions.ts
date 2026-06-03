import type { AppRole } from "./lao";

/** Routes (prefix match) accessible by each role. admin = all. */
export const ROLE_ROUTES: Record<AppRole, string[]> = {
  admin: ["*"],
  cashier: [
    "/dashboard",
    "/pos",
    "/repairs",
    "/sales",
    "/customers",
    "/account-signups",
  ],
  technician: ["/dashboard", "/repairs"],
  warehouse: ["/dashboard", "/inventory", "/suppliers"],
};

export function canAccess(roles: AppRole[], path: string): boolean {
  if (roles.length === 0) return false;
  if (roles.includes("admin")) return true;
  return roles.some((r) =>
    ROLE_ROUTES[r]?.some((p) => p === "*" || path === p || path.startsWith(p + "/") || path.startsWith(p))
  );
}

/** Default landing page based on role priority. */
export function defaultRouteFor(roles: AppRole[]): string {
  if (roles.includes("admin")) return "/dashboard";
  if (roles.includes("cashier")) return "/pos";
  if (roles.includes("technician")) return "/repairs";
  if (roles.includes("warehouse")) return "/inventory";
  return "/dashboard";
}
