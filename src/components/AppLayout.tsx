import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/lao";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LayoutDashboard, Wrench, Users, Package, LogOut, ShoppingCart, ReceiptText, Settings, Mail, UserCog, Menu, X, BarChart3, Truck, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { usePosSettings } from "@/lib/settings";
import { canAccess } from "@/lib/permissions";
import { useIsMobile } from "@/hooks/use-mobile";

const NAV = [
  { to: "/dashboard", label: "ໜ້າລວມ", icon: LayoutDashboard },
  { to: "/pos", label: "ຂາຍ (POS)", icon: ShoppingCart },
  { to: "/repairs", label: "ໃບສ້ອມ", icon: Wrench },
  { to: "/account-signups", label: "ສະໝັກບັນຊີ", icon: Mail },
  { to: "/sales", label: "ບິນຂາຍ", icon: ReceiptText },
  { to: "/orders", label: "ສັ່ງຊື້ອອນລາຍ", icon: ShoppingBag },
  { to: "/customers", label: "ລູກຄ້າ", icon: Users },
  { to: "/inventory", label: "ສະຕັອກ", icon: Package },
  { to: "/suppliers", label: "ຜູ້ສະໜອງ", icon: Truck },
  { to: "/reports", label: "ລາຍງານ", icon: BarChart3, adminOnly: true },
  { to: "/users", label: "ຜູ້ໃຊ້ງານ", icon: UserCog, adminOnly: true },
  { to: "/settings", label: "ຕັ້ງຄ່າ", icon: Settings, adminOnly: true },
] as const;

const STORAGE_KEY = "sidebar:collapsed";

export function AppLayout() {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const { location } = useRouterState();
  const s = usePosSettings();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });

  // Auto-collapse on mobile viewports
  useEffect(() => {
    if (isMobile) setCollapsed(true);
  }, [isMobile]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    }
  }, [collapsed]);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex min-h-screen bg-muted/30">
        <aside
          className={cn(
            "border-r bg-card flex flex-col overflow-hidden",
            "transition-[width] duration-300 ease-in-out will-change-[width]",
            collapsed ? "w-16" : "w-56 sm:w-60 lg:w-64"
          )}
        >
          <div className="p-3 border-b flex items-center gap-2">
            <Logo className="h-10 w-10 rounded-md bg-black p-1 shrink-0" />
            <div
              className={cn(
                "min-w-0 flex-1 transition-all duration-200",
                collapsed ? "opacity-0 w-0 pointer-events-none" : "opacity-100"
              )}
            >
              <h1 className="text-sm font-bold truncate">{s.shop_name}</h1>
              <p className="text-[11px] text-muted-foreground truncate">{s.shop_name_en}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => setCollapsed((v) => !v)}
              title={collapsed ? "ຂະຫຍາຍແຖບເມນູ" : "ຫຍໍ້ແຖບເມນູ"}
              aria-label={collapsed ? "ຂະຫຍາຍແຖບເມນູ" : "ຫຍໍ້ແຖບເມນູ"}
            >
              <Menu className={cn("h-4 w-4 absolute transition-all duration-200", collapsed ? "opacity-100 rotate-0" : "opacity-0 -rotate-90")} />
              <X className={cn("h-4 w-4 absolute transition-all duration-200", collapsed ? "opacity-0 rotate-90" : "opacity-100 rotate-0")} />
            </Button>
          </div>

          <nav className="flex-1 p-2 space-y-1">
            {NAV.filter((item) => {
              if ((item as any).adminOnly) return roles.includes("admin");
              return canAccess(roles, item.to);
            }).map((item) => {
              const active = location.pathname.startsWith(item.to);
              const Icon = item.icon;
              const link = (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                    collapsed && "justify-center px-2",
                    active ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span
                    className={cn(
                      "truncate transition-all duration-200",
                      collapsed ? "opacity-0 w-0" : "opacity-100"
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.to}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                );
              }
              return link;
            })}
          </nav>

          <div className="p-2 border-t">
            <div
              className={cn(
                "px-3 py-2 mb-2 overflow-hidden transition-all duration-200",
                collapsed ? "h-0 opacity-0 mb-0 py-0" : "opacity-100"
              )}
            >
              <p className="text-sm font-medium truncate">{user?.email}</p>
              <p className="text-xs text-muted-foreground truncate">
                {roles.map((r) => ROLE_LABEL[r]).join(", ")}
              </p>
            </div>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-center px-0"
                    onClick={async () => {
                      await signOut();
                      navigate({ to: "/login" });
                    }}
                    aria-label="ອອກຈາກລະບົບ"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">ອອກຈາກລະບົບ</TooltipContent>
              </Tooltip>
            ) : (
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
            )}
          </div>
        </aside>

        <main className="flex-1 overflow-auto">
          <div className="p-6 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
