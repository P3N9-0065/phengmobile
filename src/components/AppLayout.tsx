import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/lao";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Wrench, Users, Package, LogOut, ShoppingCart, ReceiptText, Settings, Mail, UserCog, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { usePosSettings } from "@/lib/settings";
import { canAccess } from "@/lib/permissions";

const NAV = [
  { to: "/dashboard", label: "ໜ້າລວມ", icon: LayoutDashboard },
  { to: "/pos", label: "ຂາຍ (POS)", icon: ShoppingCart },
  { to: "/repairs", label: "ໃບສ້ອມ", icon: Wrench },
  { to: "/account-signups", label: "ສະໝັກບັນຊີ", icon: Mail },
  { to: "/sales", label: "ບິນຂາຍ", icon: ReceiptText },
  { to: "/customers", label: "ລູກຄ້າ", icon: Users },
  { to: "/inventory", label: "ສະຕັອກ", icon: Package },
  { to: "/users", label: "ຜູ້ໃຊ້ງານ", icon: UserCog, adminOnly: true },
  { to: "/settings", label: "ຕັ້ງຄ່າ", icon: Settings, adminOnly: true },
] as const;

const STORAGE_KEY = "sidebar:collapsed";

export function AppLayout() {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const { location } = useRouterState();
  const s = usePosSettings();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    }
  }, [collapsed]);

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside
        className={cn(
          "border-r bg-card flex flex-col transition-[width] duration-200",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <div className="p-3 border-b flex items-center gap-2">
          <Logo className="h-10 w-10 rounded-md bg-black p-1 shrink-0" />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-bold truncate">{s.shop_name}</h1>
              <p className="text-[11px] text-muted-foreground truncate">{s.shop_name_en}</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "ຂະຫຍາຍແຖບເມນູ" : "ຫຍໍ້ແຖບເມນູ"}
          >
            {collapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
          </Button>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {NAV.filter((item) => {
            if ((item as any).adminOnly) return roles.includes("admin");
            return canAccess(roles, item.to);
          }).map((item) => {
            const active = location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  collapsed && "justify-center px-2",
                  active ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-2 border-t">
          {!collapsed && (
            <div className="px-3 py-2 mb-2">
              <p className="text-sm font-medium truncate">{user?.email}</p>
              <p className="text-xs text-muted-foreground truncate">
                {roles.map((r) => ROLE_LABEL[r]).join(", ")}
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={cn("w-full", collapsed ? "justify-center px-0" : "justify-start")}
            onClick={async () => {
              await signOut();
              navigate({ to: "/login" });
            }}
            title={collapsed ? "ອອກຈາກລະບົບ" : undefined}
          >
            <LogOut className={cn("h-4 w-4", !collapsed && "mr-2")} />
            {!collapsed && "ອອກຈາກລະບົບ"}
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
