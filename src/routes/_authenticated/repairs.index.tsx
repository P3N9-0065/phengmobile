import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
import { STATUS_LABEL, STATUS_COLOR, STATUS_ORDER, type RepairStatus } from "@/lib/lao";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/repairs/")({
  component: RepairsPage,
});

function RepairsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RepairStatus | "all">("all");

  const { data: tickets } = useQuery({
    queryKey: ["tickets", search, status],
    queryFn: async () => {
      let q = supabase
        .from("repair_tickets")
        .select("*, customers(name, phone)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (status !== "all") q = q.eq("status", status);
      if (search.trim()) q = q.or(`ticket_code.ilike.%${search}%,device_brand.ilike.%${search}%,device_model.ilike.%${search}%,device_imei.ilike.%${search}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ໃບສ້ອມ</h1>
          <p className="text-muted-foreground text-sm">ຈັດການໃບສ້ອມມືຖືທັງໝົດ</p>
        </div>
        <Link to="/repairs/new"><Button><Plus className="h-4 w-4 mr-2" />ເປີດໃບສ້ອມໃໝ່</Button></Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="ຄົ້ນຫາລະຫັດ, ຍີ່ຫໍ້, ຮຸ່ນ, IMEI..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as any)}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ທຸກສະຖານະ</SelectItem>
            {STATUS_ORDER.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {tickets?.map((t) => (
          <Link key={t.id} to="/repairs/$id" params={{ id: t.id }}>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{t.ticket_code}</p>
                      <Badge variant="outline" className={STATUS_COLOR[t.status]}>{STATUS_LABEL[t.status]}</Badge>
                    </div>
                    <p className="text-sm mt-1">{t.device_brand} {t.device_model}</p>
                    <p className="text-xs text-muted-foreground">
                      {(t.customers as any)?.name} — {(t.customers as any)?.phone}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{t.problem_description}</p>
                  </div>
                  <p className="text-xs text-muted-foreground sm:text-right shrink-0">{formatDateTime(t.created_at)}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {tickets?.length === 0 && (
          <p className="text-center text-muted-foreground py-8">ບໍ່ພົບໃບສ້ອມ</p>
        )}
      </div>
    </div>
  );
}
