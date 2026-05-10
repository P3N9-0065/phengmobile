import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wrench, Clock, Package, AlertCircle, CheckCircle2 } from "lucide-react";
import { STATUS_LABEL, STATUS_COLOR } from "@/lib/lao";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [todayRes, openRes, waitingRes, doneRes, lowStockRes] = await Promise.all([
        supabase.from("repair_tickets").select("id", { count: "exact", head: true }).gte("created_at", today.toISOString()),
        supabase.from("repair_tickets").select("id", { count: "exact", head: true }).in("status", ["received", "inspecting", "repairing", "testing"]),
        supabase.from("repair_tickets").select("id", { count: "exact", head: true }).eq("status", "waiting_parts"),
        supabase.from("repair_tickets").select("id", { count: "exact", head: true }).eq("status", "done"),
        supabase.from("inventory_items").select("id, name, stock_qty, low_stock_threshold").order("stock_qty"),
      ]);

      const lowStock = (lowStockRes.data ?? []).filter((i) => i.stock_qty <= i.low_stock_threshold);

      return {
        todayCount: todayRes.count ?? 0,
        openCount: openRes.count ?? 0,
        waitingCount: waitingRes.count ?? 0,
        doneCount: doneRes.count ?? 0,
        lowStock,
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
        .limit(8);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ໜ້າລວມ</h1>
        <p className="text-muted-foreground text-sm">ສະຫຼຸບສະຖານະຮ້ານປະຈຸບັນ</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="ໃບສ້ອມມື້ນີ້" value={stats?.todayCount ?? 0} icon={Wrench} color="text-blue-600" />
        <StatCard label="ກຳລັງສ້ອມ" value={stats?.openCount ?? 0} icon={Clock} color="text-purple-600" />
        <StatCard label="ລໍຖ້າອາໄຫຼ່" value={stats?.waitingCount ?? 0} icon={Package} color="text-amber-600" />
        <StatCard label="ລໍຖ້າລູກຄ້າຮັບ" value={stats?.doneCount ?? 0} icon={CheckCircle2} color="text-emerald-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>ໃບສ້ອມຫຼ້າສຸດ</CardTitle>
          </CardHeader>
          <CardContent>
            {recentTickets && recentTickets.length > 0 ? (
              <div className="space-y-2">
                {recentTickets.map((t) => (
                  <Link
                    key={t.id}
                    to="/repairs/$id"
                    params={{ id: t.id }}
                    className="flex items-center justify-between p-3 rounded-md border hover:bg-accent transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm">{t.ticket_code}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.device_brand} {t.device_model} — {(t.customers as any)?.name ?? "-"}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className={STATUS_COLOR[t.status]}>
                        {STATUS_LABEL[t.status]}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">{formatDateTime(t.created_at)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">ຍັງບໍ່ມີໃບສ້ອມ</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              ສະຕັອກໃກ້ໝົດ
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.lowStock && stats.lowStock.length > 0 ? (
              <div className="space-y-2">
                {stats.lowStock.slice(0, 8).map((item) => (
                  <Link
                    key={item.id}
                    to="/inventory"
                    className="flex justify-between p-2 rounded hover:bg-accent text-sm"
                  >
                    <span className="truncate">{item.name}</span>
                    <span className="text-amber-600 font-medium">{item.stock_qty}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">ສະຕັອກພຽງພໍ</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
          <Icon className={`h-8 w-8 ${color}`} />
        </div>
      </CardContent>
    </Card>
  );
}
