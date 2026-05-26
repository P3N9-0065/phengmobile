import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Phone, Mail, MapPin, Award, Apple, KeyRound, TrendingUp, TrendingDown, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL, STATUS_COLOR } from "@/lib/lao";
import { formatDate, formatLAK } from "@/lib/format";
import { useLoyaltySettings, computeTier, TIER_LABEL, TIER_COLOR } from "@/lib/loyalty";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/customers/$id")({
  component: CustomerDetailPage,
});

function CustomerDetailPage() {
  const { id } = Route.useParams();

  const { data: customer } = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("*").eq("id", id).single();
      return data;
    },
  });

  const { data: tickets } = useQuery({
    queryKey: ["customer-tickets", id],
    queryFn: async () => {
      const { data } = await supabase.from("repair_tickets").select("*").eq("customer_id", id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: signups } = useQuery({
    queryKey: ["customer-signups", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("account_signups")
        .select("*")
        .eq("customer_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  if (!customer) return <p>ກຳລັງໂຫຼດ...</p>;

  return (
    <div className="space-y-6">
      <Link to="/customers"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />ກັບຄືນ</Button></Link>

      <Card>
        <CardHeader>
          <CardTitle>{customer.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{customer.phone}</p>
          {customer.email && <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{customer.email}</p>}
          {customer.address && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{customer.address}</p>}
          <p className="flex items-center gap-2"><Award className="h-4 w-4 text-amber-600" />{customer.points} ແຕ້ມ</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>ປະຫວັດການສ້ອມ ({tickets?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {tickets && tickets.length > 0 ? (
            <div className="space-y-2">
              {tickets.map((t) => {
                const inWarranty = t.warranty_until && new Date(t.warranty_until) >= new Date();
                return (
                  <Link key={t.id} to="/repairs/$id" params={{ id: t.id }}
                    className="flex items-center justify-between p-3 rounded border hover:bg-accent">
                    <div>
                      <p className="font-medium text-sm">{t.ticket_code}</p>
                      <p className="text-xs text-muted-foreground">{t.device_brand} {t.device_model} — {formatDate(t.created_at)}</p>
                      {t.warranty_until && (
                        <p className={`text-xs mt-1 ${inWarranty ? "text-emerald-600" : "text-muted-foreground"}`}>
                          {inWarranty ? "ໃນປະກັນ" : "ໝົດປະກັນ"} ({formatDate(t.warranty_until)})
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className={STATUS_COLOR[t.status]}>{STATUS_LABEL[t.status]}</Badge>
                      {t.final_price && <p className="text-xs mt-1 font-medium">{formatLAK(Number(t.final_price))}</p>}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">ຍັງບໍ່ມີປະຫວັດການສ້ອມ</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>ປະຫວັດການສະໝັກບັນຊີ ({signups?.length ?? 0})</CardTitle>
          <Link to="/account-signups"><Button variant="outline" size="sm">ເບິ່ງທັງໝົດ</Button></Link>
        </CardHeader>
        <CardContent>
          {signups && signups.length > 0 ? (
            <div className="space-y-2">
              {signups.map((s: any) => {
                const Icon = s.account_type === "apple_id" ? Apple : s.account_type === "email" ? Mail : KeyRound;
                return (
                  <Link
                    key={s.id}
                    to="/account-signups"
                    search={{ q: s.account_email } as any}
                    className="flex items-center justify-between p-3 rounded border hover:bg-accent"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{s.account_email}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(s.created_at)}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="capitalize">{s.account_type.replace("_", " ")}</Badge>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">ຍັງບໍ່ມີການສະໝັກບັນຊີ</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
