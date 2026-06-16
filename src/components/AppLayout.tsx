import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/lao";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { LayoutDashboard, Wrench, Users, Package, LogOut, ShoppingCart, ReceiptText, Settings, Mail, UserCog, Menu, X, BarChart3, Truck, ShoppingBag, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { usePosSettings } from "@/lib/settings";
import { canAccess } from "@/lib/permissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { NotificationsBell } from "@/components/NotificationsBell";

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

// Bottom-bar quick actions on mobile (most used)
const BOTTOM_NAV: { to: (typeof NAV)[number]["to"]; label: string; icon: typeof LayoutDashboard }[] = [
  { to: "/dashboard", label: "ໜ້າລວມ", icon: LayoutDashboard },
  { to: "/pos", label: "ຂາຍ", icon: ShoppingCart },
  { to: "/repairs", label: "ສ້ອມ", icon: Wrench },
  { to: "/inventory", label: "ສະຕັອກ", icon: Package },
];

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
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    }
  }, [collapsed]);

  // Close mobile drawer on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const visibleNav = NAV.filter((item) => {
    if ((item as any).adminOnly) return roles.includes("admin");
    return canAccess(roles, item.to);
  });

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/login" });
  }

  // ----- Shared nav items list -----
  function NavList({ onClick, compact = false }: { onClick?: () => void; compact?: boolean }) {
    return (
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {visibleNav.map((item) => {
          const active = location.pathname.startsWith(item.to);
          const Icon = item.icon;
          const link = (
            <Link
              key={item.to}
              to={item.to}
              onClick={onClick}
              className={cn(
                "flex items-center gap-3 px-3 rounded-md text-sm transition-colors",
                compact ? "py-2 justify-center" : "py-3 sm:py-2",
                active ? "bg-primary text-primary-foreground" : "hover:bg-accent active:bg-accent"
              )}
            >
              <Icon className="h-5 w-5 sm:h-4 sm:w-4 shrink-0" />
              <span
                className={cn(
                  "truncate transition-all duration-200",
                  compact ? "opacity-0 w-0" : "opacity-100"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
          if (compact) {
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
    );
  }

  // ----- MOBILE LAYOUT -----
  if (isMobile) {
    return (
      <TooltipProvider delayDuration={150}>
        <div className="min-h-screen bg-muted/30 flex flex-col">
          {/* Top header */}
          <header className="sticky top-0 z-40 bg-card border-b flex items-center gap-2 px-3 h-14">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="ເປີດເມນູ">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72 flex flex-col">
                <SheetHeader className="p-3 border-b">
                  <SheetTitle className="flex items-center gap-2 text-left">
                    <Logo className="h-9 w-9 rounded-md bg-black p-1 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold truncate">{s.shop_name}</span>
                      <span className="block text-[11px] text-muted-foreground truncate font-normal">{s.shop_name_en}</span>
                    </span>
                  </SheetTitle>
                </SheetHeader>
                <NavList onClick={() => setMobileOpen(false)} />
                <div className="p-3 border-t">
                  <p className="text-sm font-medium truncate">{user?.email}</p>
                  <p className="text-xs text-muted-foreground truncate mb-2">
                    {roles.map((r) => ROLE_LABEL[r]).join(", ")}
                  </p>
                  <Button variant="outline" size="sm" className="w-full justify-start" onClick={handleSignOut}>
                    <LogOut className="h-4 w-4 mr-2" />
                    ອອກຈາກລະບົບ
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            <Logo className="h-8 w-8 rounded-md bg-black p-1 shrink-0" />
            <h1 className="text-sm font-bold truncate flex-1 min-w-0">{s.shop_name}</h1>

            <NotificationsBell />
          </header>

          {/* Content */}
          <main className="flex-1 overflow-auto">
            <div className="px-3 py-3 pb-24">
              <Outlet />
            </div>
          </main>

          {/* Bottom nav */}
          <nav className="fixed bottom-0 inset-x-0 z-40 bg-card border-t grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
            {BOTTOM_NAV.filter((b) => visibleNav.some((v) => v.to === b.to)).map((item) => {
              const active = location.pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] transition-colors",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="truncate max-w-full px-1">{item.label}</span>
                </Link>
              );
            })}
            <button
              onClick={() => setMobileOpen(true)}
              className="flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] text-muted-foreground"
              aria-label="ເມນູເພີ່ມເຕີມ"
            >
              <MoreHorizontal className="h-5 w-5" />
              <span>ເພີ່ມເຕີມ</span>
            </button>
          </nav>
        </div>
      </TooltipProvider>
    );
  }

  // ----- DESKTOP LAYOUT -----
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
              className="h-8 w-8 shrink-0 relative"
              onClick={() => setCollapsed((v) => !v)}
              title={collapsed ? "ຂະຫຍາຍແຖບເມນູ" : "ຫຍໍ້ແຖບເມນູ"}
              aria-label={collapsed ? "ຂະຫຍາຍແຖບເມນູ" : "ຫຍໍ້ແຖບເມນູ"}
            >
              <Menu className={cn("h-4 w-4 absolute transition-all duration-200", collapsed ? "opacity-100 rotate-0" : "opacity-0 -rotate-90")} />
              <X className={cn("h-4 w-4 absolute transition-all duration-200", collapsed ? "opacity-0 rotate-90" : "opacity-100 rotate-0")} />
            </Button>
          </div>

          <NavList compact={collapsed} />

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
                  <Button variant="ghost" size="sm" className="w-full justify-center px-0" onClick={handleSignOut} aria-label="ອອກຈາກລະບົບ">
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">ອອກຈາກລະບົບ</TooltipContent>
              </Tooltip>
            ) : (
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                ອອກຈາກລະບົບ
              </Button>
            )}
          </div>
        </aside>

        <main className="flex-1 overflow-auto">
          <div className="flex justify-end px-6 pt-3 max-w-7xl mx-auto">
            <NotificationsBell />
          </div>
          <div className="px-6 pb-6 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
