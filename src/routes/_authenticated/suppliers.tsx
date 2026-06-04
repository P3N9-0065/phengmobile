import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Pencil, Search, PackageCheck, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { formatLAK } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/suppliers")({
  component: SuppliersPage,
});

// ---------- Suppliers ----------
type SupplierForm = { name: string; phone: string; contact_person: string; address: string; notes: string };
const EMPTY_SUP: SupplierForm = { name: "", phone: "", contact_person: "", address: "", notes: "" };

function SuppliersTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SupplierForm>(EMPTY_SUP);

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", search],
    queryFn: async () => {
      let q = supabase.from("suppliers").select("*").order("name").limit(500);
      const s = search.trim();
      if (s) q = q.or(`name.ilike.%${s}%,phone.ilike.%${s}%,contact_person.ilike.%${s}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("ກະລຸນາໃສ່ຊື່ຜູ້ສະໜອງ");
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        contact_person: form.contact_person.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (editingId) {
        const { error } = await supabase.from("suppliers").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suppliers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success(editingId ? "ແກ້ໄຂສຳເລັດ" : "ເພີ່ມສຳເລັດ");
      setOpen(false); setEditingId(null); setForm(EMPTY_SUP);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); toast.success("ລຶບແລ້ວ"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="ຄົ້ນຫາຜູ້ສະໜອງ..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button onClick={() => { setEditingId(null); setForm(EMPTY_SUP); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />ເພີ່ມຜູ້ສະໜອງ
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {suppliers?.map((s) => (
          <Card key={s.id}>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{s.name}</p>
                  {s.contact_person && <p className="text-xs text-muted-foreground">ຕິດຕໍ່: {s.contact_person}</p>}
                  {s.phone && <p className="text-xs text-muted-foreground">📞 {s.phone}</p>}
                  {s.address && <p className="text-xs text-muted-foreground line-clamp-2">{s.address}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7"
                    onClick={() => {
                      setEditingId(s.id);
                      setForm({ name: s.name, phone: s.phone ?? "", contact_person: s.contact_person ?? "", address: s.address ?? "", notes: s.notes ?? "" });
                      setOpen(true);
                    }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                    onClick={() => { if (confirm(`ລຶບ ${s.name}?`)) del.mutate(s.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {suppliers?.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full text-center py-8">ຍັງບໍ່ມີຜູ້ສະໜອງ</p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "ແກ້ໄຂຜູ້ສະໜອງ" : "ເພີ່ມຜູ້ສະໜອງໃໝ່"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (!save.isPending) save.mutate(); }} className="space-y-3">
            <div><Label>ຊື່ *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>ເບີໂທ</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>ຜູ້ຕິດຕໍ່</Label><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
            </div>
            <div><Label>ທີ່ຢູ່</Label><Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>ໝາຍເຫດ</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>ຍົກເລີກ</Button>
              <Button type="submit" disabled={save.isPending}>{save.isPending ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- Purchase Orders ----------
type POLine = { item_id: string; name: string; qty: number; unit_cost: number };

function PurchaseOrdersTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [receiveId, setReceiveId] = useState<string | null>(null);

  const { data: pos } = useQuery({
    queryKey: ["purchase_orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*, suppliers(name), purchase_order_items(qty, received_qty)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("purchase_orders").update({ status: "cancelled" }).eq("id", id).eq("status","draft");
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["purchase_orders"] }); toast.success("ຍົກເລີກ PO ແລ້ວ"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("purchase_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["purchase_orders"] }); toast.success("ລຶບ PO ແລ້ວ"); },
    onError: (e: any) => toast.error(e.message),
  });

  const statusLabel = (s: string) =>
    s === "draft" ? "ຮ່າງ" : s === "partial" ? "ຮັບບາງສ່ວນ" : s === "received" ? "ຮັບແລ້ວ" : "ຍົກເລີກ";

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />ສ້າງໃບສັ່ງຊື້</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ລະຫັດ</TableHead>
                <TableHead>ຜູ້ສະໜອງ</TableHead>
                <TableHead>ວັນທີ</TableHead>
                <TableHead>ຄືບໜ້າ</TableHead>
                <TableHead className="text-right">ລວມ</TableHead>
                <TableHead>ສະຖານະ</TableHead>
                <TableHead className="text-right">ການກະທຳ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pos?.map((p: any) => {
                const totalQty = p.purchase_order_items?.reduce((a: number, b: any) => a + (b.qty || 0), 0) ?? 0;
                const recvQty = p.purchase_order_items?.reduce((a: number, b: any) => a + (b.received_qty || 0), 0) ?? 0;
                const canReceive = (p.status === "draft" || p.status === "partial") && recvQty < totalQty;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.po_code}</TableCell>
                    <TableCell>{p.suppliers?.name ?? "-"}</TableCell>
                    <TableCell className="text-xs">{new Date(p.created_at).toLocaleDateString("lo-LA")}</TableCell>
                    <TableCell className="text-xs">{recvQty} / {totalQty} ຊິ້ນ</TableCell>
                    <TableCell className="text-right">{formatLAK(Number(p.total))}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === "received" ? "default" : p.status === "cancelled" ? "destructive" : "secondary"}>
                        {statusLabel(p.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => setViewId(p.id)}>
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
                        {canReceive && (
                          <Button size="sm" onClick={() => setReceiveId(p.id)}>
                            <PackageCheck className="h-3.5 w-3.5 mr-1" />ຮັບເຂົ້າ
                          </Button>
                        )}
                        {p.status === "draft" && (
                          <Button size="sm" variant="outline" onClick={() => cancel.mutate(p.id)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {p.status !== "received" && p.status !== "partial" && (
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm("ລຶບ PO?")) del.mutate(p.id); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {pos?.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">ຍັງບໍ່ມີໃບສັ່ງຊື້</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {open && <CreatePODialog onClose={() => setOpen(false)} />}
      {viewId && <ViewPODialog poId={viewId} onClose={() => setViewId(null)} />}
      {receiveId && <ReceivePODialog poId={receiveId} onClose={() => setReceiveId(null)} />}
    </div>
  );
}

function ReceivePODialog({ poId, onClose }: { poId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: lines, isLoading } = useQuery({
    queryKey: ["po-receive", poId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_order_items")
        .select("id, item_id, qty, received_qty, unit_cost, inventory_items(name, sku)")
        .eq("po_id", poId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [initialized, setInitialized] = useState(false);
  if (lines && !initialized) {
    const next: Record<string, number> = {};
    for (const l of lines as any[]) {
      next[l.item_id] = Math.max(0, (l.qty || 0) - (l.received_qty || 0));
    }
    setQtyMap(next);
    setInitialized(true);
  }

  const submit = useMutation({
    mutationFn: async () => {
      const items = Object.entries(qtyMap)
        .filter(([, q]) => (q || 0) > 0)
        .map(([item_id, qty]) => ({ item_id, qty }));
      if (items.length === 0) throw new Error("ກະລຸນາໃສ່ຈຳນວນຮັບເຂົ້າຢ່າງໜ້ອຍ 1 ລາຍການ");
      const { error } = await supabase.rpc("receive_purchase_order_partial", { _po_id: poId, _items: items });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["po-detail", poId] });
      toast.success("ບັນທຶກການຮັບເຂົ້າສຳເລັດ");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ຮັບເຂົ້າສະຕັອກ</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">ກຳລັງໂຫຼດ...</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              ໃສ່ຈຳນວນທີ່ໄດ້ຮັບຈິງໃນຮອບນີ້. ສາມາດຮັບເຂົ້າຫຼາຍຮອບຕໍ່ໃບສັ່ງຊື້ໄດ້. ສະຕັອກ ແລະ ລາຄາທຶນຈະຖືກອັບເດດຕາມຈຳນວນທີ່ຮັບແຕ່ລະຮອບ.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ສິນຄ້າ</TableHead>
                  <TableHead className="text-right w-20">ສັ່ງ</TableHead>
                  <TableHead className="text-right w-20">ຮັບແລ້ວ</TableHead>
                  <TableHead className="text-right w-20">ຍັງເຫຼືອ</TableHead>
                  <TableHead className="w-28">ຮັບຮອບນີ້</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(lines as any[])?.map((l) => {
                  const rem = (l.qty || 0) - (l.received_qty || 0);
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="text-sm">
                        {l.inventory_items?.name}
                        {l.inventory_items?.sku && <span className="text-xs text-muted-foreground"> ({l.inventory_items.sku})</span>}
                      </TableCell>
                      <TableCell className="text-right">{l.qty}</TableCell>
                      <TableCell className="text-right">{l.received_qty}</TableCell>
                      <TableCell className="text-right">{rem}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={rem}
                          disabled={rem <= 0}
                          value={qtyMap[l.item_id] ?? 0}
                          onChange={(e) => {
                            const v = Math.max(0, Math.min(rem, Number(e.target.value) || 0));
                            setQtyMap({ ...qtyMap, [l.item_id]: v });
                          }}
                          className="h-8"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ຍົກເລີກ</Button>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending || isLoading}>
            {submit.isPending ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກການຮັບເຂົ້າ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreatePODialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [supplierId, setSupplierId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState(0);
  const [lines, setLines] = useState<POLine[]>([]);
  const [itemSearch, setItemSearch] = useState("");

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", "all"],
    queryFn: async () => {
      const { data } = await supabase.from("suppliers").select("id, name").order("name");
      return data ?? [];
    },
  });

  const { data: items } = useQuery({
    queryKey: ["inv-pick", itemSearch],
    queryFn: async () => {
      let q = supabase.from("inventory_items").select("id, name, sku, cost_price").order("name").limit(20);
      const s = itemSearch.trim();
      if (s) q = q.or(`name.ilike.%${s}%,sku.ilike.%${s}%,barcode.ilike.%${s}%`);
      const { data } = await q;
      return data ?? [];
    },
    enabled: itemSearch.trim().length > 0,
  });

  const subtotal = useMemo(() => lines.reduce((a, l) => a + l.qty * l.unit_cost, 0), [lines]);
  const total = Math.max(0, subtotal - discount);

  function addItem(it: any) {
    if (lines.find((l) => l.item_id === it.id)) { toast.info("ມີໃນລາຍການແລ້ວ"); return; }
    setLines([...lines, { item_id: it.id, name: it.name, qty: 1, unit_cost: Number(it.cost_price) || 0 }]);
    setItemSearch("");
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!supplierId) throw new Error("ກະລຸນາເລືອກຜູ້ສະໜອງ");
      if (lines.length === 0) throw new Error("ກະລຸນາເພີ່ມຢ່າງໜ້ອຍ 1 ລາຍການ");
      const { data: { user } } = await supabase.auth.getUser();
      const { data: po, error } = await supabase
        .from("purchase_orders")
        .insert({
          supplier_id: supplierId,
          subtotal, discount, total,
          notes: notes.trim() || null,
          created_by: user?.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      const items = lines.map((l) => ({
        po_id: po.id, item_id: l.item_id, qty: l.qty, unit_cost: l.unit_cost,
        line_total: l.qty * l.unit_cost,
      }));
      const { error: e2 } = await supabase.from("purchase_order_items").insert(items);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      toast.success("ສ້າງໃບສັ່ງຊື້ສຳເລັດ");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>ສ້າງໃບສັ່ງຊື້ໃໝ່</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>ຜູ້ສະໜອງ *</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger><SelectValue placeholder="ເລືອກຜູ້ສະໜອງ" /></SelectTrigger>
              <SelectContent>
                {suppliers?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>ເພີ່ມສິນຄ້າ</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="ຄົ້ນຫາສິນຄ້າ..." value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} />
            </div>
            {itemSearch.trim() && items && items.length > 0 && (
              <div className="border rounded-md mt-1 max-h-48 overflow-auto">
                {items.map((it) => (
                  <button key={it.id} onClick={() => addItem(it)}
                    className="w-full text-left px-3 py-2 hover:bg-accent text-sm border-b last:border-b-0 flex justify-between">
                    <span>{it.name}{it.sku && <span className="text-muted-foreground"> ({it.sku})</span>}</span>
                    <span className="text-muted-foreground">{formatLAK(Number(it.cost_price))}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {lines.length > 0 && (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ສິນຄ້າ</TableHead>
                    <TableHead className="w-24">ຈຳນວນ</TableHead>
                    <TableHead className="w-32">ລາຄາທຶນ</TableHead>
                    <TableHead className="text-right">ລວມ</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l, i) => (
                    <TableRow key={l.item_id}>
                      <TableCell className="text-sm">{l.name}</TableCell>
                      <TableCell>
                        <Input type="number" min={1} value={l.qty}
                          onChange={(e) => { const v = [...lines]; v[i].qty = Math.max(1, Number(e.target.value) || 1); setLines(v); }}
                          className="h-8" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" min={0} value={l.unit_cost}
                          onChange={(e) => { const v = [...lines]; v[i].unit_cost = Math.max(0, Number(e.target.value) || 0); setLines(v); }}
                          className="h-8" />
                      </TableCell>
                      <TableCell className="text-right text-sm">{formatLAK(l.qty * l.unit_cost)}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setLines(lines.filter((_, x) => x !== i))}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div><Label>ໝາຍເຫດ</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm"><span>ຍອດລວມ</span><b>{formatLAK(subtotal)}</b></div>
              <div className="flex items-center justify-between text-sm gap-2">
                <span>ສ່ວນຫຼຸດ</span>
                <Input type="number" min={0} value={discount} onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))} className="h-8 w-32" />
              </div>
              <div className="flex justify-between text-base border-t pt-2"><span>ສຸດທິ</span><b>{formatLAK(total)}</b></div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ຍົກເລີກ</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ (ຮ່າງ)"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ViewPODialog({ poId, onClose }: { poId: string; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ["po-detail", poId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*, suppliers(name, phone, address), purchase_order_items(*, inventory_items(name, sku))")
        .eq("id", poId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>ໃບສັ່ງຊື້ {data?.po_code}</DialogTitle></DialogHeader>
        {data && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">ຜູ້ສະໜອງ</p>
                <p className="font-medium">{data.suppliers?.name}</p>
                {data.suppliers?.phone && <p className="text-xs">{data.suppliers.phone}</p>}
              </div>
              <div>
                <p className="text-muted-foreground">ສະຖານະ</p>
                <Badge>{data.status}</Badge>
                <p className="text-xs mt-1">ສ້າງ: {new Date(data.created_at).toLocaleString("lo-LA")}</p>
                {data.received_at && <p className="text-xs">ຮັບ: {new Date(data.received_at).toLocaleString("lo-LA")}</p>}
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ສິນຄ້າ</TableHead>
                  <TableHead className="text-right">ສັ່ງ</TableHead>
                  <TableHead className="text-right">ຮັບແລ້ວ</TableHead>
                  <TableHead className="text-right">ທຶນ/ຊິ້ນ</TableHead>
                  <TableHead className="text-right">ລວມ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.purchase_order_items?.map((it: any) => (
                  <TableRow key={it.id}>
                    <TableCell>{it.inventory_items?.name}{it.inventory_items?.sku && <span className="text-xs text-muted-foreground"> ({it.inventory_items.sku})</span>}</TableCell>
                    <TableCell className="text-right">{it.qty}</TableCell>
                    <TableCell className="text-right">{it.received_qty ?? 0}</TableCell>
                    <TableCell className="text-right">{formatLAK(Number(it.unit_cost))}</TableCell>
                    <TableCell className="text-right">{formatLAK(Number(it.line_total))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="text-right space-y-1 text-sm">
              <p>ຍອດລວມ: <b>{formatLAK(Number(data.subtotal))}</b></p>
              {Number(data.discount) > 0 && <p>ສ່ວນຫຼຸດ: {formatLAK(Number(data.discount))}</p>}
              <p className="text-base">ສຸດທິ: <b>{formatLAK(Number(data.total))}</b></p>
            </div>
            {data.notes && <p className="text-sm text-muted-foreground border-t pt-2">ໝາຍເຫດ: {data.notes}</p>}

            <ReceiptHistory poId={poId} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SuppliersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ຜູ້ສະໜອງ ແລະ ການສັ່ງຊື້</h1>
        <p className="text-sm text-muted-foreground">ຈັດການຜູ້ຂາຍສົ່ງ ແລະ ໃບສັ່ງຊື້ສິນຄ້າເຂົ້າຮ້ານ</p>
      </div>
      <Tabs defaultValue="po">
        <TabsList>
          <TabsTrigger value="po">ໃບສັ່ງຊື້ (PO)</TabsTrigger>
          <TabsTrigger value="suppliers">ຜູ້ສະໜອງ</TabsTrigger>
        </TabsList>
        <TabsContent value="po" className="mt-4"><PurchaseOrdersTab /></TabsContent>
        <TabsContent value="suppliers" className="mt-4"><SuppliersTab /></TabsContent>
      </Tabs>
    </div>
  );
}
