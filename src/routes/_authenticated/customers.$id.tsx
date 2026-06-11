import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Phone, Mail, MapPin, Award, Apple, KeyRound, TrendingUp, TrendingDown, Settings as SettingsIcon, Pencil, ShoppingCart, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { STATUS_LABEL, STATUS_COLOR } from "@/lib/lao";
import { formatDate, formatLAK } from "@/lib/format";
import { useLoyaltySettings, computeTier, TIER_LABEL, TIER_COLOR } from "@/lib/loyalty";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/customers/$id")({
  component: CustomerDetailPage,
});

function CustomerDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data: customer } = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("*").eq("id", id).single();
      return data;
    },
  });

  const updateCustomer = useMutation({
    mutationFn: async (patch: { name: string; phone: string; email: string | null; address: string | null }) => {
      const { error } = await supabase.from("customers").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer", id] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success("ບັນທຶກລູກຄ້າສຳເລັດ");
      setEditOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
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

  const { data: pointHistory } = useQuery({
    queryKey: ["customer-points", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("point_transactions" as any)
        .select("*")
        .eq("customer_id", id)
        .order("created_at", { ascending: false })
        .limit(100);
      return ((data ?? []) as any[]);
    },
  });

  const { data: loyalty } = useLoyaltySettings();

  if (!customer) return <p>ກຳລັງໂຫຼດ...</p>;

  const tier = computeTier(customer.points ?? 0, loyalty);
  const nextThreshold =
    tier === "none" ? loyalty?.bronze_threshold :
    tier === "bronze" ? loyalty?.silver_threshold :
    tier === "silver" ? loyalty?.gold_threshold : null;
  const nextTierLabel =
    tier === "none" ? "Bronze" :
    tier === "bronze" ? "Silver" :
    tier === "silver" ? "Gold" : null;

  return (
    <div className="space-y-6">
      <Link to="/customers"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />ກັບຄືນ</Button></Link>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-3">
            {customer.name}
            {loyalty?.enabled && tier !== "none" && (
              <Badge variant="outline" className={cn("text-xs", TIER_COLOR[tier])}>
                {TIER_LABEL[tier]} Member
              </Badge>
            )}
          </CardTitle>
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Pencil className="h-3.5 w-3.5 mr-1" />ແກ້ໄຂ</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>ແກ້ໄຂຂໍ້ມູນລູກຄ້າ</DialogTitle></DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  updateCustomer.mutate({
                    name: String(fd.get("name") || "").trim(),
                    phone: String(fd.get("phone") || "").trim(),
                    email: (fd.get("email") as string)?.trim() || null,
                    address: (fd.get("address") as string)?.trim() || null,
                  });
                }}
                className="space-y-3"
              >
                <div><Label>ຊື່ລູກຄ້າ *</Label><Input name="name" defaultValue={customer.name ?? ""} required /></div>
                <div><Label>ເບີໂທ *</Label><Input name="phone" defaultValue={customer.phone ?? ""} required /></div>
                <div><Label>ອີເມວ</Label><Input name="email" type="email" defaultValue={customer.email ?? ""} /></div>
                <div><Label>ທີ່ຢູ່</Label><Textarea name="address" rows={2} defaultValue={customer.address ?? ""} /></div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>ຍົກເລີກ</Button>
                  <Button type="submit" disabled={updateCustomer.isPending}>ບັນທຶກ</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{customer.phone}</p>
          {customer.email && <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{customer.email}</p>}
          {customer.address && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{customer.address}</p>}
          <div className="flex items-center gap-2 pt-1">
            <Award className="h-4 w-4 text-amber-600" />
            <span className="font-semibold">{customer.points}</span>
            <span className="text-muted-foreground">ແຕ້ມ</span>
            {loyalty?.enabled && nextThreshold && nextTierLabel && (
              <span className="text-xs text-muted-foreground ml-2">
                (ອີກ {Math.max(0, nextThreshold - (customer.points ?? 0))} ແຕ້ມ ຈະຂຶ້ນ {nextTierLabel})
              </span>
            )}
          </div>
        </CardContent>
      </Card>


      {loyalty?.enabled && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>ປະຫວັດແຕ້ມ ({pointHistory?.length ?? 0})</CardTitle>
            <Link to="/settings"><Button variant="ghost" size="sm"><SettingsIcon className="h-3 w-3 mr-1" />ຕັ້ງຄ່າ</Button></Link>
          </CardHeader>
          <CardContent>
            {pointHistory && pointHistory.length > 0 ? (
              <div className="space-y-1.5">
                {pointHistory.map((t) => {
                  const pts = Number(t.points);
                  const isPositive = pts > 0;
                  const Icon = isPositive ? TrendingUp : TrendingDown;
                  const colors = isPositive
                    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                    : "text-rose-700 bg-rose-50 border-rose-200";
                  return (
                    <div key={t.id} className="flex items-center justify-between border rounded-md p-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={cn("h-7 w-7 rounded-full border flex items-center justify-center", colors)}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm truncate">{t.note || t.type}</p>
                          <p className="text-[11px] text-muted-foreground">{formatDate(t.created_at)}</p>
                        </div>
                      </div>
                      <span className={cn("text-sm font-bold", isPositive ? "text-emerald-700" : "text-rose-700")}>
                        {isPositive ? "+" : ""}{pts}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">ຍັງບໍ່ມີປະຫວັດແຕ້ມ</p>
            )}
          </CardContent>
        </Card>
      )}

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
