import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Phone, ChevronRight, Smartphone } from "lucide-react";
import { toast } from "sonner";
import {
  STATUS_LABEL, STATUS_COLOR, STATUS_ORDER, type RepairStatus,
} from "@/lib/lao";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/repairs/")({
  component: RepairsPage,
});

const QUICK_FILTERS: (RepairStatus | "all" | "active")[] = [
  "all", "active", "received", "inspecting", "waiting_parts",
  "repairing", "testing", "done", "picked_up",
];

const FILTER_LABEL: Record<string, string> = {
  all: "ທັງໝົດ",
  active: "ກຳລັງດຳເນີນ",
  ...STATUS_LABEL,
};

const ACTIVE_STATUSES: RepairStatus[] = [
  "received", "inspecting", "waiting_parts", "repairing", "testing", "done",
];

function RepairsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RepairStatus | "all" | "active">("active");

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["tickets", search, status],
    queryFn: async () => {
      let q = supabase
        .from("repair_tickets")
        .select("id, ticket_code, status, device_brand, device_model, problem_description, created_at, customer_id, customers(name, phone)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (status === "active") q = q.in("status", ACTIVE_STATUSES);
      else if (status !== "all") q = q.eq("status", status);
      if (search.trim()) {
        q = q.or(
          `ticket_code.ilike.%${search}%,device_brand.ilike.%${search}%,device_model.ilike.%${search}%,device_imei.ilike.%${search}%`,
        );
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: tickets?.length ?? 0 };
    let active = 0;
    for (const t of tickets ?? []) {
      m[t.status] = (m[t.status] ?? 0) + 1;
      if (ACTIVE_STATUSES.includes(t.status as RepairStatus)) active++;
    }
    m.active = active;
    return m;
  }, [tickets]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: RepairStatus }) => {
      const { error } = await supabase
        .from("repair_tickets")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ອັບເດດສະຖານະສຳເລັດ");
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "ອັບເດດບໍ່ສຳເລັດ"),
  });

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold truncate">ຄິວສ້ອມ</h1>
          <p className="text-muted-foreground text-xs sm:text-sm">ຈັດການໃບສ້ອມມືຖືທັງໝົດ</p>
        </div>
        <Link to="/repairs/new" className="hidden sm:block">
          <Button><Plus className="h-4 w-4 mr-2" />ເປີດໃບສ້ອມໃໝ່</Button>
        </Link>
      </div>

      {/* Sticky search + filters */}
      <div className="sticky top-0 z-20 -mx-3 sm:mx-0 px-3 sm:px-0 py-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ຄົ້ນຫາລະຫັດ, ຍີ່ຫໍ້, ຮຸ່ນ, IMEI..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11"
            inputMode="search"
          />
        </div>
        <div className="-mx-3 sm:mx-0 overflow-x-auto no-scrollbar">
          <div className="flex gap-2 px-3 sm:px-0 pb-1">
            {QUICK_FILTERS.map((f) => {
              const active = status === f;
              const count = counts[f] ?? 0;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setStatus(f)}
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 h-9 text-sm transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card hover:bg-accent"
                  }`}
                >
                  <span>{FILTER_LABEL[f]}</span>
                  {count > 0 && (
                    <span className={`text-[11px] rounded-full px-1.5 ${
                      active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
                    }`}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Ticket list */}
      <div className="space-y-2.5">
        {isLoading && (
          <p className="text-center text-muted-foreground py-8 text-sm">ກຳລັງໂຫຼດ...</p>
        )}
        {tickets?.map((t) => {
          const cust: any = t.customers;
          return (
            <Card key={t.id} className="overflow-hidden">
              <CardContent className="p-0">
                {/* Tappable header → details */}
                <Link
                  to="/repairs/$id"
                  params={{ id: t.id }}
                  className="block p-3.5 active:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 shrink-0 rounded-lg bg-muted flex items-center justify-center">
                      <Smartphone className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold tabular-nums">{t.ticket_code}</p>
                        <Badge variant="outline" className={`${STATUS_COLOR[t.status as RepairStatus]} text-xs`}>
                          {STATUS_LABEL[t.status as RepairStatus]}
                        </Badge>
                      </div>
                      <p className="text-sm mt-0.5 truncate">{t.device_brand} {t.device_model}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {cust?.name}{cust?.phone ? ` · ${cust.phone}` : ""}
                      </p>
                      {t.problem_description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{t.problem_description}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground/80 mt-1">{formatDateTime(t.created_at)}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                </Link>

                {/* Action row */}
                <div className="border-t flex items-stretch divide-x bg-muted/30">
                  {cust?.phone && (
                    <a
                      href={`tel:${cust.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
                      aria-label={`ໂທຫາ ${cust.name}`}
                    >
                      <Phone className="h-4 w-4" />ໂທ
                    </a>
                  )}
                  <div className="flex-[2] p-1.5" onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={t.status}
                      onValueChange={(v) => updateStatus.mutate({ id: t.id, status: v as RepairStatus })}
                    >
                      <SelectTrigger className="h-9 border-0 bg-transparent shadow-none focus:ring-0 text-sm">
                        <SelectValue placeholder="ປ່ຽນສະຖານະ" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_ORDER.map((s) => (
                          <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/repairs/$id", params: { id: t.id } })}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-primary hover:bg-accent transition-colors"
                  >
                    ເປີດ <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {tickets?.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">ບໍ່ພົບໃບສ້ອມ</p>
            <Link to="/repairs/new">
              <Button variant="outline" className="mt-3">
                <Plus className="h-4 w-4 mr-1.5" />ເປີດໃບສ້ອມໃໝ່
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Floating action button (mobile) */}
      <Link
        to="/repairs/new"
        className="sm:hidden fixed bottom-20 right-4 z-30 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        aria-label="ເປີດໃບສ້ອມໃໝ່"
      >
        <Plus className="h-6 w-6" />
      </Link>
    </div>
  );
}
