import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wrench, Clock, Package, AlertCircle, CheckCircle2, ShoppingBag, ShoppingCart, AlertTriangle, TrendingUp } from "lucide-react";
import { STATUS_LABEL, STATUS_COLOR } from "@/lib/lao";
import { formatDateTime, formatLAK, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const OVERDUE_DAYS = 3;

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const overdueCutoff = new Date(Date.now() - OVERDUE_DAYS * 86400_000).toISOString();

      const [
        todayRes, openRes, waitingRes, doneRes, lowStockRes,
        posTodayRes, onlinePendingRes, onlineTodayRes,
        overdueRes,
      ] = await Promise.all([
        supabase.from("repair_tickets").select("id", { count: "exact", head: true }).gte("created_at", today.toISOString()),
        supabase.from("repair_tickets").select("id", { count: "exact", head: true }).in("status", ["received", "inspecting", "repairing", "testing"]),
        supabase.from("repair_tickets").select("id", { count: "exact", head: true }).eq("status", "waiting_parts"),
        supabase.from("repair_tickets").select("id", { count: "exact", head: true }).eq("status", "done"),
        supabase.from("inventory_items").select("id, name, stock_qty, low_stock_threshold").order("stock_qty"),
        supabase.from("sales").select("total").gte("created_at", today.toISOString()).neq("status", "voided"),
        supabase.from("shop_orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("shop_orders").select("total").gte("created_at", today.toISOString()).neq("status", "cancelled"),
        supabase.from("repair_tickets").select("id, ticket_code, device_brand, device_model, updated_at, customers(name, phone)").eq("status", "done").lt("updated_at", overdueCutoff).order("updated_at"),
      ]);

      const lowStock = (lowStockRes.data ?? []).filter((i) => i.stock_qty <= i.low_stock_threshold);
      const posRevenue = (posTodayRes.data ?? []).reduce((s, x: any) => s + Number(x.total || 0), 0);
      const onlineRevenue = (onlineTodayRes.data ?? []).reduce((s, x: any) => s + Number(x.total || 0), 0);

      return {
        todayCount: todayRes.count ?? 0,
        openCount: openRes.count ?? 0,
        waitingCount: waitingRes.count ?? 0,
        doneCount: doneRes.count ?? 0,
        lowStock,
        posRevenue,
        onlineRevenue,
        totalRevenue: posRevenue + onlineRevenue,
        onlinePending: onlinePendingRes.count ?? 0,
        overdueTickets: overdueRes.data ?? [],
      };
    },
  });

  const { data: recentTickets } = useQuery({
    queryKey: ["recent-tickets"],
    queryFn: async () => {
      const { data } = await supabase
        .from("repair_tickets")
        .select("id, ticket_code, device_brand, device_model, status, created_at, customers(name)")
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  const { data: recentOrders } = useQuery({
    queryKey: ["recent-shop-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("shop_orders")
        .select("id, order_code, customer_name, status, total, subtotal, created_at")
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ໜ້າລວມ</h1>
        <p className="text-muted-foreground text-sm">ສະຫຼຸບສະຖານະຮ້ານປະຈຸບັນ</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="ລາຍຮັບມື້ນີ້ (ລວມ)" value={formatLAK(stats?.totalRevenue ?? 0)} icon={TrendingUp} color="text-emerald-600" />
        <StatCard label="ຂາຍ POS ມື້ນີ້" value={formatLAK(stats?.posRevenue ?? 0)} icon={ShoppingCart} color="text-blue-600" />
        <StatCard label="ຂາຍອອນລາຍມື້ນີ້" value={formatLAK(stats?.onlineRevenue ?? 0)} icon={ShoppingBag} color="text-violet-600" />
        <StatCard label="ສັ່ງຊື້ລໍຖ້າຢືນຢັນ" value={String(stats?.onlinePending ?? 0)} icon={Clock} color="text-amber-600" highlight={(stats?.onlinePending ?? 0) > 0} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="ໃບສ້ອມມື້ນີ້" value={String(stats?.todayCount ?? 0)} icon={Wrench} color="text-blue-600" />
        <StatCard label="ກຳລັງສ້ອມ" value={String(stats?.openCount ?? 0)} icon={Clock} color="text-purple-600" />
        <StatCard label="ລໍຖ້າອາໄຫຼ່" value={String(stats?.waitingCount ?? 0)} icon={Package} color="text-amber-600" />
        <StatCard label="ລໍຖ້າລູກຄ້າຮັບ" value={String(stats?.doneCount ?? 0)} icon={CheckCircle2} color="text-emerald-600" />
      </div>

      {(stats?.overdueTickets?.length ?? 0) > 0 && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
              ໃບສ້ອມສຳເລັດແຕ່ລູກຄ້າຍັງບໍ່ມາຮັບ (ເກີນ {OVERDUE_DAYS} ມື້)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats!.overdueTickets.slice(0, 5).map((t: any) => (
                <Link key={t.id} to="/repairs/$id" params={{ id: t.id }}
                  className="flex items-center justify-between p-3 rounded border bg-background hover:bg-accent">
                  <div>
                    <p className="font-medium text-sm">{t.ticket_code} — {t.device_brand} {t.device_model}</p>
                    <p className="text-xs text-muted-foreground">{(t.customers as any)?.name} • {(t.customers as any)?.phone}</p>
                  </div>
                  <span className="text-xs text-amber-700 font-medium">ສຳເລັດ {formatDate(t.updated_at)}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">ໃບສັ່ງຊື້ອອນລາຍຫຼ້າສຸດ</CardTitle>
            <Link to="/orders" className="text-xs text-primary hover:underline">ເບິ່ງທັງໝົດ</Link>
          </CardHeader>
          <CardContent>
            {recentOrders && recentOrders.length > 0 ? (
              <div className="space-y-2">
                {recentOrders.map((o: any) => (
                  <Link key={o.id} to="/orders" className="flex items-center justify-between p-2 rounded border hover:bg-accent">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{o.order_code}</p>
                      <p className="text-xs text-muted-foreground truncate">{o.customer_name}</p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="text-sm font-medium">{formatLAK(Number(o.total || o.subtotal))}</p>
                      <p className="text-[10px] text-muted-foreground">{o.status}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">ຍັງບໍ່ມີ</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">ໃບສ້ອມຫຼ້າສຸດ</CardTitle>
          </CardHeader>
          <CardContent>
            {recentTickets && recentTickets.length > 0 ? (
              <div className="space-y-2">
                {recentTickets.map((t) => (
                  <Link key={t.id} to="/repairs/$id" params={{ id: t.id }}
                    className="flex items-center justify-between p-2 rounded border hover:bg-accent">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{t.ticket_code}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {t.device_brand} {t.device_model}
                      </p>
                    </div>
                    <Badge variant="outline" className={`${STATUS_COLOR[t.status]} text-[10px] shrink-0 ml-2`}>
                      {STATUS_LABEL[t.status]}
                    </Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">ຍັງບໍ່ມີ</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              ສະຕັອກໃກ້ໝົດ
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.lowStock && stats.lowStock.length > 0 ? (
              <div className="space-y-2">
                {stats.lowStock.slice(0, 6).map((item) => (
                  <Link key={item.id} to="/inventory" className="flex justify-between p-2 rounded hover:bg-accent text-sm">
                    <span className="truncate">{item.name}</span>
                    <span className="text-amber-600 font-medium">{item.stock_qty}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">ສະຕັອກພຽງພໍ</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, highlight }: { label: string; value: string; icon: any; color: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-amber-400 bg-amber-50/50" : ""}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className="text-xl font-bold mt-1 truncate">{value}</p>
          </div>
          <Icon className={`h-7 w-7 shrink-0 ${color}`} />
        </div>
      </CardContent>
    </Card>
  );
}
