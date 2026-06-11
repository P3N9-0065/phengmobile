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
import { ShoppingBag, Phone, MapPin, Image as ImageIcon, FileText, Truck, ChevronDown, MessageCircle, ShieldCheck, ShieldAlert, ShieldQuestion, Loader2, Landmark } from "lucide-react";
import { toast } from "sonner";
import { useSignedUrl } from "@/lib/signed-url";
import { useAuth } from "@/lib/auth";
import { useShippingSettings, DEFAULT_SHIPPING } from "@/lib/shipping";
import { useServerFn } from "@tanstack/react-start";
import { verifySlip } from "@/lib/slip-ocr.functions";

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
                <div className="flex justify-between text-muted-foreground border-t pt-1">
                  <span>ລວມສິນຄ້າ</span><span>{formatLAK(Number(o.subtotal))}</span>
                </div>
                {Number(o.shipping_fee) > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>ຄ່າສົ່ງ</span><span>{formatLAK(Number(o.shipping_fee))}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t pt-1">
                  <span>ລວມຈ່າຍ</span><span className="text-primary">{formatLAK(Number(o.total || o.subtotal))}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {o.slip_url && (
                  <Button size="sm" variant="outline" onClick={() => setSlipPath(o.slip_url)}>
                    <ImageIcon className="h-3.5 w-3.5 mr-1" />ເບິ່ງສະລິບ
                  </Button>
                )}
                <Button size="sm" variant="outline" asChild>
                  <a href={waLink(o)} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-3.5 w-3.5 mr-1" />WhatsApp
                  </a>
                </Button>
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

function waLink(o: any) {
  const phone = String(o.customer_phone || "").replace(/[^\d+]/g, "").replace(/^\+/, "");
  const status = STATUS_LABEL[o.status as Status] || o.status;
  const msg = `ສະບາຍດີ ${o.customer_name}, ໃບສັ່ງຊື້ ${o.order_code} ສະຖານະ: ${status}. ລວມ ${formatLAK(Number(o.total || o.subtotal))}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

function ShippingSettingsCard() {
  const qc = useQueryClient();
  const { data } = useShippingSettings();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...DEFAULT_SHIPPING });
  useEffect(() => { if (data) setForm({ flat_rate: Number((data as any).flat_rate), free_threshold: Number((data as any).free_threshold), enabled: (data as any).enabled }); }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("shipping_settings" as any).update({
        flat_rate: form.flat_rate,
        free_threshold: form.free_threshold,
        enabled: form.enabled,
        updated_at: new Date().toISOString(),
      }).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shipping-settings"] }); toast.success("ບັນທຶກແລ້ວ"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition">
            <span className="flex items-center gap-2 font-medium text-sm"><Truck className="h-4 w-4" />ຕັ້ງຄ່າຄ່າສົ່ງ</span>
            <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            <div className="flex items-center justify-between">
              <Label htmlFor="ship-enabled">ເປີດໃຊ້ການຄິດຄ່າສົ່ງ</Label>
              <Switch id="ship-enabled" checked={form.enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))} />
            </div>
            <div className="space-y-1">
              <Label>ຄ່າສົ່ງຄົງທີ່ (LAK)</Label>
              <Input type="number" value={form.flat_rate} onChange={(e) => setForm((f) => ({ ...f, flat_rate: Number(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-1">
              <Label>ສົ່ງຟຣີເມື່ອຊື້ເກີນ (LAK)</Label>
              <Input type="number" value={form.free_threshold} onChange={(e) => setForm((f) => ({ ...f, free_threshold: Number(e.target.value) || 0 }))} />
              <p className="text-xs text-muted-foreground">ໃສ່ 0 ເພື່ອປິດການສົ່ງຟຣີ</p>
            </div>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>ບັນທຶກ</Button>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
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
