import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/lao";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Wrench, Users, Package, LogOut, ShoppingCart, ReceiptText, Settings, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { usePosSettings } from "@/lib/settings";

const NAV = [
  { to: "/dashboard", label: "ໜ້າລວມ", icon: LayoutDashboard },
  { to: "/pos", label: "ຂາຍ (POS)", icon: ShoppingCart },
  { to: "/repairs", label: "ໃບສ້ອມ", icon: Wrench },
  { to: "/account-signups", label: "ສະໝັກບັນຊີ", icon: Mail },
  { to: "/sales", label: "ບິນຂາຍ", icon: ReceiptText },
  { to: "/customers", label: "ລູກຄ້າ", icon: Users },
  { to: "/inventory", label: "ສະຕັອກ", icon: Package },
  { to: "/settings", label: "ຕັ້ງຄ່າ", icon: Settings },
] as const;

export function AppLayout() {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const { location } = useRouterState();
  const s = usePosSettings();

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <Logo className="h-12 w-12 rounded-md bg-black p-1" />
            <div className="min-w-0">
              <h1 className="text-sm font-bold truncate">{s.shop_name}</h1>
              <p className="text-[11px] text-muted-foreground truncate">{s.shop_name_en}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => {
            const active = location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t">
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium truncate">{user?.email}</p>
            <p className="text-xs text-muted-foreground">
              {roles.map((r) => ROLE_LABEL[r]).join(", ")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={async () => {
              await signOut();
              navigate({ to: "/login" });
            }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            ອອກຈາກລະບົບ
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
