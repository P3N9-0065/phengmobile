import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Printer, ExternalLink, Download, Copy, Camera } from "lucide-react";
import { toast } from "sonner";
import { QRCodeCanvas } from "qrcode.react";
import { STATUS_LABEL, STATUS_COLOR, STATUS_ORDER, ROLE_LABEL, type RepairStatus } from "@/lib/lao";
import { formatDateTime, formatLAK } from "@/lib/format";
import { RepairReceipt } from "@/components/repair/RepairReceipt";
import { BarcodeScanner } from "@/components/inventory/BarcodeScanner";
import { fallbackLookup, type LookupItem } from "@/lib/barcode-lookup";
import { clearScanCache } from "@/lib/scan-cache";

export const Route = createFileRoute("/_authenticated/repairs/$id")({
  component: RepairDetailPage,
  validateSearch: (s: Record<string, unknown>) => ({
    print: s.print === "1" || s.print === 1 ? ("1" as const) : undefined,
  }),
});

function RepairDetailPage() {
  const { id } = Route.useParams();
  const { print } = Route.useSearch();
  const qc = useQueryClient();
  const [partOpen, setPartOpen] = useState(false);
  const [editPriceOpen, setEditPriceOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [scanResults, setScanResults] = useState<LookupItem[] | null>(null);
  const [scanCode, setScanCode] = useState("");

  const { data: ticket } = useQuery({
    queryKey: ["ticket", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("repair_tickets")
        .select("*, customers(*)")
        .eq("id", id)
        .single();
      return data;
    },
  });

  const { data: history } = useQuery({
    queryKey: ["ticket-history", id],
    queryFn: async () => {
      const { data } = await supabase.from("repair_status_history").select("*").eq("ticket_id", id).order("changed_at");
      return data ?? [];
    },
  });

  const { data: parts } = useQuery({
    queryKey: ["ticket-parts", id],
    queryFn: async () => {
      const { data } = await supabase.from("repair_parts_used").select("*, inventory_items(name, sku)").eq("ticket_id", id);
      return data ?? [];
    },
  });

  const { data: technicians } = useQuery({
    queryKey: ["technicians"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "technician");
      const ids = (roles ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      return data ?? [];
    },
  });

  const { data: items } = useQuery({
    queryKey: ["inventory-min"],
    queryFn: async () => {
      const { data } = await supabase.from("inventory_items").select("id, name, barcode, sku, stock_qty, cost_price, sell_price").gt("stock_qty", 0).order("name");
      return data ?? [];
    },
  });

  const updateTicket = useMutation({
    mutationFn: async (patch: any) => {
      const { error } = await supabase.from("repair_tickets").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["ticket-history", id] });
      toast.success("ບັນທຶກສຳເລັດ");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addPart = useMutation({
    mutationFn: async ({ item_id, qty, unit_cost, unit_price }: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("repair_parts_used").insert({
        ticket_id: id, item_id, qty, unit_cost, unit_price, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-parts", id] });
      qc.invalidateQueries({ queryKey: ["inventory-min"] });
      toast.success("ເພີ່ມອາໄຫຼ່ສຳເລັດ (ສະຕັອກຖືກຕັດອັດຕະໂນມັດ)");
      setPartOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  useEffect(() => {
    if (print === "1" && ticket) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [print, ticket?.id]);

  if (!ticket) return <p>ກຳລັງໂຫຼດ...</p>;

  const partsTotal = (parts ?? []).reduce((s, p) => s + Number(p.unit_price) * p.qty, 0);
  const trackUrl = `${window.location.origin}/track/${ticket.ticket_code}`;

  return (
    <>
      <div className="print-only">
        <RepairReceipt ticket={ticket} customer={ticket.customers as any} trackUrl={trackUrl} />
      </div>
    <div className="space-y-6 no-print">
      <div className="flex items-center justify-between">
        <Link to="/repairs"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />ກັບຄືນ</Button></Link>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />ພິມໃບຮັບສ້ອມ</Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{ticket.ticket_code}</h1>
          <p className="text-muted-foreground text-sm">{formatDateTime(ticket.created_at)}</p>
        </div>
        <Badge variant="outline" className={`${STATUS_COLOR[ticket.status]} text-base px-3 py-1`}>{STATUS_LABEL[ticket.status]}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle>ຂໍ້ມູນເຄື່ອງ</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p><b>ຍີ່ຫໍ້ / ຮຸ່ນ:</b> {ticket.device_brand} {ticket.device_model}</p>
              {ticket.device_imei && <p><b>IMEI:</b> {ticket.device_imei}</p>}
              {ticket.device_color && <p><b>ສີ:</b> {ticket.device_color}</p>}
              <p><b>ອາການ:</b> {ticket.problem_description}</p>
              {ticket.lock_code && <p><b>ລະຫັດປົດລ໋ອກ:</b> {ticket.lock_code}</p>}
              {ticket.accessories && ticket.accessories.length > 0 && (
                <p><b>ອຸປະກອນທີ່ຝາກ:</b> {ticket.accessories.join(", ")}</p>
              )}
            </CardContent>
          </Card>

          {ticket.photo_urls && ticket.photo_urls.length > 0 && (
            <Card>
              <CardHeader><CardTitle>ຮູບເຄື່ອງ</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {ticket.photo_urls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt="" className="w-full h-24 object-cover rounded" />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>ອາໄຫຼ່ທີ່ໃຊ້</CardTitle>
              <Dialog open={partOpen} onOpenChange={setPartOpen}>
                <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />ເພີ່ມ</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>ເພີ່ມອາໄຫຼ່ທີ່ໃຊ້ໃນການສ້ອມ</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const itemId = (fd.get("item_id") as string) || selectedItemId;
                    const item = items?.find((i) => i.id === itemId);
                    if (!item) { toast.error("ກະລຸນາເລືອກສິນຄ້າ"); return; }
                    addPart.mutate({
                      item_id: itemId,
                      qty: Number(fd.get("qty")),
                      unit_cost: item?.cost_price ?? 0,
                      unit_price: Number(fd.get("unit_price") || item?.sell_price || 0),
                    });
                  }} className="space-y-3">
                    <div>
                      <Label>ສິນຄ້າ</Label>
                      <div className="flex gap-2">
                        <Select name="item_id" value={selectedItemId} onValueChange={setSelectedItemId} required>
                          <SelectTrigger><SelectValue placeholder="ເລືອກສິນຄ້າ" /></SelectTrigger>
                          <SelectContent>
                            {items?.map((i) => (
                              <SelectItem key={i.id} value={i.id}>{i.name} (ຄົງເຫຼືອ: {i.stock_qty})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="outline" size="sm" onClick={() => setScanOpen(true)} title="ສະແກນ">
                          <Camera className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>ຈຳນວນ</Label><Input name="qty" type="number" min="1" defaultValue="1" required /></div>
                      <div><Label>ລາຄາ/ໜ່ວຍ (₭)</Label><Input name="unit_price" type="number" /></div>
                    </div>
                    <DialogFooter><Button type="submit" disabled={addPart.isPending}>ບັນທຶກ</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {parts && parts.length > 0 ? (
                <div className="space-y-1 text-sm">
                  {parts.map((p) => (
                    <div key={p.id} className="flex justify-between p-2 border-b">
                      <span>{(p.inventory_items as any)?.name} × {p.qty}</span>
                      <span className="font-medium">{formatLAK(Number(p.unit_price) * p.qty)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 font-semibold">
                    <span>ລວມຄ່າອາໄຫຼ່</span>
                    <span>{formatLAK(partsTotal)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">ຍັງບໍ່ມີອາໄຫຼ່ທີ່ໃຊ້</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>ປະຫວັດສະຖານະ</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {history?.map((h) => (
                  <div key={h.id} className="flex items-center gap-3 text-sm">
                    <Badge variant="outline" className={STATUS_COLOR[h.status]}>{STATUS_LABEL[h.status]}</Badge>
                    <span className="text-muted-foreground text-xs">{formatDateTime(h.changed_at)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>ລູກຄ້າ</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <Link to="/customers/$id" params={{ id: ticket.customer_id }} className="font-medium hover:underline">
                {(ticket.customers as any)?.name}
              </Link>
              <p>{(ticket.customers as any)?.phone}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>ຈັດການ</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>ສະຖານະ</Label>
                <Select value={ticket.status} onValueChange={(v) => updateTicket.mutate({ status: v as RepairStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_ORDER.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>ມອບໝາຍຊ່າງ</Label>
                <Select value={ticket.technician_id ?? ""} onValueChange={(v) => updateTicket.mutate({ technician_id: v || null })}>
                  <SelectTrigger><SelectValue placeholder="ຍັງບໍ່ໄດ້ມອບໝາຍ" /></SelectTrigger>
                  <SelectContent>
                    {technicians?.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                    {(technicians?.length ?? 0) === 0 && <div className="p-2 text-xs text-muted-foreground">ຍັງບໍ່ມີຊ່າງ</div>}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>ລາຄາ</CardTitle>
              <Dialog open={editPriceOpen} onOpenChange={setEditPriceOpen}>
                <DialogTrigger asChild><Button size="sm" variant="outline">ແກ້ໄຂ</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>ກຳນົດລາຄາ</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    updateTicket.mutate({
                      estimated_price: fd.get("estimated_price") ? Number(fd.get("estimated_price")) : null,
                      labor_cost: Number(fd.get("labor_cost") || 0),
                      final_price: fd.get("final_price") ? Number(fd.get("final_price")) : null,
                    });
                    setEditPriceOpen(false);
                  }} className="space-y-3">
                    <div><Label>ປະເມີນ (₭)</Label><Input name="estimated_price" type="number" defaultValue={ticket.estimated_price ?? ""} /></div>
                    <div><Label>ຄ່າແຮງ (₭)</Label><Input name="labor_cost" type="number" defaultValue={ticket.labor_cost ?? "0"} /></div>
                    <div><Label>ລາຄາສຸດທ້າຍ (₭)</Label><Input name="final_price" type="number" defaultValue={ticket.final_price ?? ""} /></div>
                    <DialogFooter><Button type="submit">ບັນທຶກ</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              {ticket.estimated_price && <p>ປະເມີນ: {formatLAK(Number(ticket.estimated_price))}</p>}
              <p>ຄ່າອາໄຫຼ່: {formatLAK(partsTotal)}</p>
              {ticket.labor_cost != null && <p>ຄ່າແຮງ: {formatLAK(Number(ticket.labor_cost))}</p>}
              {ticket.final_price && <p className="text-base font-bold pt-1 border-t">ລວມ: {formatLAK(Number(ticket.final_price))}</p>}
            </CardContent>
          </Card>

          {ticket.signature_url && (
            <Card>
              <CardHeader><CardTitle>ລາຍເຊັນ</CardTitle></CardHeader>
              <CardContent>
                <img src={ticket.signature_url} alt="signature" className="border rounded bg-white" />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>QR ຕິດຕາມສະຖານະ</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-center bg-white p-4 rounded border" id="track-qr">
                <QRCodeCanvas
                  value={trackUrl}
                  size={200}
                  level="M"
                  includeMargin
                />
              </div>
              <p className="text-center text-xs text-muted-foreground">
                ສະແກນເພື່ອເຊັກສະຖານະງານສ້ອມ<br/>
                <span className="font-mono">{ticket.ticket_code}</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const canvas = document.querySelector("#track-qr canvas") as HTMLCanvasElement | null;
                    if (!canvas) return;
                    const link = document.createElement("a");
                    link.download = `${ticket.ticket_code}-qr.png`;
                    link.href = canvas.toDataURL("image/png");
                    link.click();
                  }}
                >
                  <Download className="h-4 w-4 mr-1" />ດາວໂຫຼດ
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(trackUrl);
                    toast.success("ສຳເນົາລິ້ງແລ້ວ");
                  }}
                >
                  <Copy className="h-4 w-4 mr-1" />ສຳເນົາລິ້ງ
                </Button>
              </div>
              <a
                href={`/track/${ticket.ticket_code}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1 break-all justify-center"
              >
                <ExternalLink className="h-3 w-3 shrink-0" />{trackUrl}
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    <BarcodeScanner
      open={scanOpen}
      onOpenChange={setScanOpen}
      title="ສະແກນເພື່ອເລືອກສິນຄ້າ"
      onScan={async (code) => {
        const results = await fallbackLookup(code);
        if (results.length === 1) {
          setSelectedItemId(results[0].id);
          toast.success("ເລືອກ: " + results[0].name);
        } else if (results.length > 1) {
          setScanCode(code);
          setScanResults(results);
        } else {
          toast.error("ບໍ່ພົບສິນຄ້າ: " + code);
        }
      }}
    />

    {/* Fallback scan results */}
    <Dialog open={!!scanResults} onOpenChange={(o) => { if (!o) setScanResults(null); }}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>ເລືອກສິນຄ້າ ({scanResults?.length} ລາຍການ)</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">ຄົ້ນຫາ: <b>{scanCode}</b></p>
        <div className="space-y-2">
          {scanResults?.map((it) => (
            <button
              key={it.id}
              onClick={() => { setSelectedItemId(it.id); setScanResults(null); toast.success("ເລືອກ: " + it.name); }}
              className="w-full text-left border rounded-md p-3 hover:bg-emerald-50 hover:border-emerald-300 transition-colors flex items-center justify-between"
            >
              <div>
                <p className="font-medium text-sm">{it.name}</p>
                {it.sku && <p className="text-xs text-muted-foreground">SKU: {it.sku}</p>}
                {it.barcode && <p className="text-xs text-muted-foreground font-mono">{it.barcode}</p>}
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{formatLAK(Number(it.sell_price))}</p>
                <p className="text-xs text-muted-foreground">ຄົງເຫຼືອ {it.stock_qty}</p>
              </div>
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setScanResults(null)}>ຍົກເລີກ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
