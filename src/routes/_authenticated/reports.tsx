import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatLAK, formatDate } from "@/lib/format";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { TrendingUp, DollarSign, Receipt, Package, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ReportsPage() {
  const today = new Date();
  const monthAgo = new Date();
  monthAgo.setDate(today.getDate() - 29);

  const [from, setFrom] = useState(ymd(monthAgo));
  const [to, setTo] = useState(ymd(today));

  function setRange(days: number) {
    const t = new Date();
    const f = new Date();
    f.setDate(t.getDate() - (days - 1));
    setFrom(ymd(f));
    setTo(ymd(t));
  }

  const fromISO = useMemo(() => new Date(from + "T00:00:00").toISOString(), [from]);
  const toISO = useMemo(() => {
    const d = new Date(to + "T00:00:00");
    d.setDate(d.getDate() + 1);
    return d.toISOString();
  }, [to]);

  const { data, isLoading } = useQuery({
    queryKey: ["reports", fromISO, toISO],
    queryFn: async () => {
      const [salesRes, profilesRes, itemsRes] = await Promise.all([
        supabase
          .from("sales")
          .select(
            "id, sale_code, created_at, subtotal, discount, total, points_discount, cashier_id, customer_id, sale_items(item_id, name_snapshot, qty, unit_price, line_total)"
          )
          .gte("created_at", fromISO)
          .lt("created_at", toISO)
          .order("created_at", { ascending: true })
          .limit(5000),
        supabase.from("profiles").select("id, full_name"),
        supabase.from("inventory_items").select("id, cost_price"),
      ]);
      if (salesRes.error) throw salesRes.error;
      const profiles = new Map((profilesRes.data ?? []).map((p) => [p.id, p.full_name]));
      const cost = new Map(
        (itemsRes.data ?? []).map((i) => [i.id, Number(i.cost_price) || 0])
      );
      return { sales: salesRes.data ?? [], profiles, cost };
    },
  });

  const agg = useMemo(() => {
    if (!data) return null;
    const { sales, profiles, cost } = data;

    let revenue = 0;
    let cogs = 0;
    let units = 0;
    let txCount = sales.length;

    const byDay = new Map<string, { day: string; revenue: number; profit: number }>();
    const byMonth = new Map<string, { month: string; revenue: number; profit: number }>();
    const byCashier = new Map<
      string,
      { name: string; revenue: number; profit: number; tx: number }
    >();
    const byProduct = new Map<
      string,
      { name: string; qty: number; revenue: number; profit: number }
    >();

    for (const s of sales as any[]) {
      const sTotal = Number(s.total) || 0;
      revenue += sTotal;
      const day = (s.created_at as string).slice(0, 10);
      const month = (s.created_at as string).slice(0, 7);

      let saleCogs = 0;
      let saleProfit = 0;
      for (const li of (s.sale_items ?? []) as any[]) {
        const q = Number(li.qty) || 0;
        const lt = Number(li.line_total) || 0;
        const c = (cost.get(li.item_id) ?? 0) * q;
        saleCogs += c;
        const p = lt - c;
        saleProfit += p;
        units += q;
        const pk = li.item_id || li.name_snapshot;
        const prev = byProduct.get(pk) ?? { name: li.name_snapshot, qty: 0, revenue: 0, profit: 0 };
        prev.qty += q;
        prev.revenue += lt;
        prev.profit += p;
        byProduct.set(pk, prev);
      }
      cogs += saleCogs;

      const d = byDay.get(day) ?? { day, revenue: 0, profit: 0 };
      d.revenue += sTotal;
      d.profit += saleProfit;
      byDay.set(day, d);

      const m = byMonth.get(month) ?? { month, revenue: 0, profit: 0 };
      m.revenue += sTotal;
      m.profit += saleProfit;
      byMonth.set(month, m);

      const cid = s.cashier_id ?? "unknown";
      const cName = profiles.get(cid) ?? "(ບໍ່ມີຊື່)";
      const c = byCashier.get(cid) ?? { name: cName, revenue: 0, profit: 0, tx: 0 };
      c.revenue += sTotal;
      c.profit += saleProfit;
      c.tx += 1;
      byCashier.set(cid, c);
    }

    // Fill missing days for chart
    const dayList: { day: string; revenue: number; profit: number }[] = [];
    const start = new Date(from + "T00:00:00");
    const end = new Date(to + "T00:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const k = ymd(d);
      dayList.push(byDay.get(k) ?? { day: k, revenue: 0, profit: 0 });
    }

    return {
      revenue,
      cogs,
      profit: revenue - cogs,
      margin: revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0,
      units,
      txCount,
      avgTicket: txCount > 0 ? revenue / txCount : 0,
      byDay: dayList,
      byMonth: [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)),
      byCashier: [...byCashier.values()].sort((a, b) => b.revenue - a.revenue),
      topByQty: [...byProduct.values()].sort((a, b) => b.qty - a.qty).slice(0, 10),
      topByRevenue: [...byProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10),
    };
  }, [data, from, to]);

  function exportCSV() {
    if (!agg) return;
    const rows = [
      ["ວັນທີ", "ຍອດຂາຍ (LAK)", "ກຳໄລ (LAK)"],
      ...agg.byDay.map((d) => [d.day, String(Math.round(d.revenue)), String(Math.round(d.profit))]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">ລາຍງານ</h1>
          <p className="text-sm text-muted-foreground">ກຳໄລ, ສິນຄ້າຂາຍດີ, ຍອດຕາມພະນັກງານ ແລະ ວັນ/ເດືອນ</p>
        </div>
        <Button variant="outline" onClick={exportCSV} disabled={!agg}>
          <Download className="h-4 w-4 mr-1" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>ຈາກວັນທີ</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
          </div>
          <div className="space-y-1">
            <Label>ຫາວັນທີ</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
          </div>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={() => setRange(7)}>7 ມື້</Button>
            <Button variant="outline" size="sm" onClick={() => setRange(30)}>30 ມື້</Button>
            <Button variant="outline" size="sm" onClick={() => setRange(90)}>90 ມື້</Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const t = new Date();
                setFrom(ymd(new Date(t.getFullYear(), 0, 1)));
                setTo(ymd(t));
              }}
            >
              ປີນີ້
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="ຍອດຂາຍລວມ" value={formatLAK(agg?.revenue ?? 0)} icon={DollarSign} color="text-blue-600" />
        <KPI
          label={`ກຳໄລຂັ້ນຕົ້ນ (${(agg?.margin ?? 0).toFixed(1)}%)`}
          value={formatLAK(agg?.profit ?? 0)}
          icon={TrendingUp}
          color="text-emerald-600"
        />
        <KPI label="ຈຳນວນບິນ" value={String(agg?.txCount ?? 0)} icon={Receipt} color="text-purple-600" />
        <KPI label="ສິນຄ້າຂາຍ (ຊິ້ນ)" value={String(agg?.units ?? 0)} icon={Package} color="text-amber-600" />
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">ກຳລັງໂຫຼດ...</p>}

      <Card>
        <CardHeader>
          <CardTitle>ຍອດຂາຍຕາມມື້</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agg?.byDay ?? []}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <RTooltip
                  formatter={(v: any) => formatLAK(Number(v))}
                  labelFormatter={(l) => formatDate(String(l))}
                />
                <Legend />
                <Bar dataKey="revenue" name="ຍອດຂາຍ" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="ກຳໄລ" fill="hsl(var(--chart-2, 142 70% 45%))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ຍອດຂາຍຕາມເດືອນ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={agg?.byMonth ?? []}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <RTooltip formatter={(v: any) => formatLAK(Number(v))} />
                <Legend />
                <Line type="monotone" dataKey="revenue" name="ຍອດຂາຍ" stroke="hsl(var(--primary))" strokeWidth={2} />
                <Line type="monotone" dataKey="profit" name="ກຳໄລ" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">ສິນຄ້າຂາຍດີ</TabsTrigger>
          <TabsTrigger value="cashiers">ຍອດຕາມພະນັກງານ</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top 10 — ຕາມຈຳນວນ</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ສິນຄ້າ</TableHead>
                      <TableHead className="text-right">ຈຳນວນ</TableHead>
                      <TableHead className="text-right">ຍອດຂາຍ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agg?.topByQty.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-right">{p.qty}</TableCell>
                        <TableCell className="text-right">{formatLAK(p.revenue)}</TableCell>
                      </TableRow>
                    ))}
                    {(!agg || agg.topByQty.length === 0) && (
                      <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">ບໍ່ມີຂໍ້ມູນ</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top 10 — ຕາມຍອດຂາຍ</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ສິນຄ້າ</TableHead>
                      <TableHead className="text-right">ຍອດຂາຍ</TableHead>
                      <TableHead className="text-right">ກຳໄລ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agg?.topByRevenue.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-right">{formatLAK(p.revenue)}</TableCell>
                        <TableCell className="text-right text-emerald-600">{formatLAK(p.profit)}</TableCell>
                      </TableRow>
                    ))}
                    {(!agg || agg.topByRevenue.length === 0) && (
                      <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">ບໍ່ມີຂໍ້ມູນ</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cashiers">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">ຍອດຕາມພະນັກງານຂາຍ</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ພະນັກງານ</TableHead>
                    <TableHead className="text-right">ບິນ</TableHead>
                    <TableHead className="text-right">ຍອດຂາຍ</TableHead>
                    <TableHead className="text-right">ກຳໄລ</TableHead>
                    <TableHead className="text-right">ສະເລ່ຍ/ບິນ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agg?.byCashier.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-right">{c.tx}</TableCell>
                      <TableCell className="text-right">{formatLAK(c.revenue)}</TableCell>
                      <TableCell className="text-right text-emerald-600">{formatLAK(c.profit)}</TableCell>
                      <TableCell className="text-right">{formatLAK(c.tx > 0 ? c.revenue / c.tx : 0)}</TableCell>
                    </TableRow>
                  ))}
                  {(!agg || agg.byCashier.length === 0) && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">ບໍ່ມີຂໍ້ມູນ</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">
        * ກຳໄລຂັ້ນຕົ້ນຄຳນວນຈາກ (ລາຄາຂາຍ − ລາຄາທຶນປັດຈຸບັນ) ຂອງສິນຄ້າແຕ່ລະຊິ້ນ
      </p>
    </div>
  );
}

function KPI({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className="text-lg font-bold mt-1 truncate">{value}</p>
          </div>
          <Icon className={`h-6 w-6 shrink-0 ${color}`} />
        </div>
      </CardContent>
    </Card>
  );
}
