import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatLAK } from "@/lib/format";
import { ShoppingBag, Phone, MapPin, Image as ImageIcon, FileText, Truck, ChevronDown, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useSignedUrl } from "@/lib/signed-url";
import { useAuth } from "@/lib/auth";
import { useShippingSettings, DEFAULT_SHIPPING } from "@/lib/shipping";

export const Route = createFileRoute("/_authenticated/orders")({
  component: OrdersPage,
});

type Status = "pending" | "confirmed" | "ready" | "completed" | "cancelled";

const STATUS_LABEL: Record<Status, string> = {
  pending: "ລໍຖ້າຢືນຢັນ",
  confirmed: "ຢືນຢັນແລ້ວ",
  ready: "ພ້ອມຮັບ/ສົ່ງ",
  completed: "ສຳເລັດ",
  cancelled: "ຍົກເລີກ",
};

const STATUS_VARIANT: Record<Status, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  confirmed: "default",
  ready: "default",
  completed: "outline",
  cancelled: "destructive",
};

function OrdersPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Status | "all">("all");
  const [slipPath, setSlipPath] = useState<string | null>(null);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["shop-orders", filter],
    queryFn: async () => {
      let q = supabase
        .from("shop_orders")
        .select("*, shop_order_items(*)")
        .order("created_at", { ascending: false });
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await supabase.from("shop_orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shop-orders"] });
      toast.success("ອັບເດດສະຖານະແລ້ວ");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShoppingBag className="h-6 w-6" />ໃບສັ່ງຊື້ອອນລາຍ
        </h1>
        <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ທັງໝົດ</SelectItem>
            {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isAdmin && <ShippingSettingsCard />}

      {isLoading && <p className="text-muted-foreground">ກຳລັງໂຫລດ...</p>}
      {!isLoading && (orders?.length ?? 0) === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">ຍັງບໍ່ມີໃບສັ່ງຊື້</CardContent></Card>
      )}

      <div className="grid gap-3">
        {orders?.map((o: any) => (
          <Card key={o.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="text-base">{o.order_code}</CardTitle>
                  <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("lo-LA")}</p>
                </div>
                <Badge variant={STATUS_VARIANT[o.status as Status]}>{STATUS_LABEL[o.status as Status]}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm space-y-1">
                <p className="font-medium">{o.customer_name}</p>
                <p className="flex items-center gap-1 text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  <a href={`tel:${o.customer_phone}`} className="hover:underline">{o.customer_phone}</a>
                </p>
                <p className="flex items-start gap-1 text-muted-foreground">
                  <MapPin className="h-3 w-3 mt-0.5" />
                  {o.delivery_method === "pickup" ? "ມາຮັບທີ່ຮ້ານ" : `ສົ່ງເດລີເວີຣີ່: ${o.address || "-"}`}
                </p>
                {o.note && <p className="flex items-start gap-1 text-muted-foreground"><FileText className="h-3 w-3 mt-0.5" />{o.note}</p>}
              </div>

              <div className="border rounded p-2 text-sm space-y-1">
                {o.shop_order_items?.map((it: any) => (
                  <div key={it.id} className="flex justify-between">
                    <span className="truncate">{it.name_snapshot} × {it.qty}</span>
                    <span>{formatLAK(Number(it.line_total))}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold border-t pt-1">
                  <span>ລວມ</span><span className="text-primary">{formatLAK(Number(o.subtotal))}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {o.slip_url && (
                  <Button size="sm" variant="outline" onClick={() => setSlipPath(o.slip_url)}>
                    <ImageIcon className="h-3.5 w-3.5 mr-1" />ເບິ່ງສະລິບ
                  </Button>
                )}
                <Select
                  value={o.status}
                  onValueChange={(v) => updateStatus.mutate({ id: o.id, status: v as Status })}
                >
                  <SelectTrigger className="w-44 ml-auto"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <SlipDialog path={slipPath} onClose={() => setSlipPath(null)} />
    </div>
  );
}

function SlipDialog({ path, onClose }: { path: string | null; onClose: () => void }) {
  const url = useSignedUrl(path ? `payment-slips/${path}` : null);
  return (
    <Dialog open={!!path} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>ສະລິບໂອນເງິນ</DialogTitle></DialogHeader>
        {url ? (
          <img src={url} alt="payment slip" className="w-full rounded border" />
        ) : (
          <p className="text-center text-muted-foreground py-8">ກຳລັງໂຫລດ...</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
