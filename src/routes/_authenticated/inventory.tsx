import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, AlertTriangle, Package as PackageIcon, Pencil, Upload, X, Barcode as BarcodeIcon, Printer, Camera } from "lucide-react";
import { toast } from "sonner";
import { CATEGORY_LABEL, type ItemCategory } from "@/lib/lao";
import { formatLAK } from "@/lib/format";
import { Barcode } from "@/components/inventory/Barcode";
import { BarcodeScanner } from "@/components/inventory/BarcodeScanner";
import { usePosSettings } from "@/lib/settings";
import { fallbackLookup, type LookupItem } from "@/lib/barcode-lookup";

export const Route = createFileRoute("/_authenticated/inventory")({
  component: InventoryPage,
});

const CATEGORIES: ItemCategory[] = ["part", "accessory", "tool", "phone_new", "phone_used"];

type FormState = {
  name: string;
  sku: string;
  barcode: string;
  category: ItemCategory;
  cost_price: string;
  sell_price: string;
  stock_qty: string;
  low_stock_threshold: string;
  image_url: string;
  description: string;
};

const EMPTY: FormState = {
  name: "", sku: "", barcode: "", category: "part",
  cost_price: "0", sell_price: "0", stock_qty: "0", low_stock_threshold: "5",
  image_url: "", description: "",
};

function genBarcode() {
  // 12-digit numeric, easy to scan with CODE128
  return Date.now().toString().slice(-9) + Math.floor(100 + Math.random() * 900).toString();
}

function InventoryPage() {
  const settings = usePosSettings();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [uploading, setUploading] = useState(false);
  const [adjustItem, setAdjustItem] = useState<any>(null);
  const [printItem, setPrintItem] = useState<any>(null);
  const [printQty, setPrintQty] = useState(1);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanFormOpen, setScanFormOpen] = useState(false);
  const [scanResults, setScanResults] = useState<LookupItem[] | null>(null);
  const [scanCode, setScanCode] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const { data: items } = useQuery({
    queryKey: ["inventory", search],
    queryFn: async () => {
      let q = supabase.from("inventory_items").select("*").order("name").limit(500);
      const s = search.trim();
      if (s) q = q.or(`name.ilike.%${s}%,sku.ilike.%${s}%,barcode.ilike.%${s}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("ກະລຸນາໃສ່ຊື່ສິນຄ້າ");
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        barcode: form.barcode.trim() || null,
        category: form.category,
        cost_price: Number(form.cost_price) || 0,
        sell_price: Number(form.sell_price) || 0,
        low_stock_threshold: Number(form.low_stock_threshold) || 5,
        image_url: form.image_url || null,
        description: form.description.trim() || null,
      };
      if (editingId) {
        const { error } = await supabase.from("inventory_items").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("inventory_items")
          .insert({ ...payload, stock_qty: Number(form.stock_qty) || 0 });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success(editingId ? "ແກ້ໄຂສຳເລັດ" : "ເພີ່ມສິນຄ້າສຳເລັດ");
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const adjust = useMutation({
    mutationFn: async ({ itemId, qty, note }: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("stock_movements").insert({
        item_id: itemId, qty, type: qty > 0 ? "purchase" : "adjustment", note, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("ປັບສະຕັອກສຳເລັດ");
      setAdjustItem(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: data.publicUrl }));
      toast.success("ອັບໂຫຼດຮູບສຳເລັດ");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(item: any) {
    setEditingId(item.id);
    setForm({
      name: item.name ?? "",
      sku: item.sku ?? "",
      barcode: item.barcode ?? "",
      category: item.category ?? "part",
      cost_price: String(item.cost_price ?? "0"),
      sell_price: String(item.sell_price ?? "0"),
      stock_qty: String(item.stock_qty ?? "0"),
      low_stock_threshold: String(item.low_stock_threshold ?? "5"),
      image_url: item.image_url ?? "",
      description: item.description ?? "",
    });
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
    setEditingId(null);
    setForm(EMPTY);
  }

  function handleAdjust(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    adjust.mutate({
      itemId: adjustItem.id,
      qty: Number(fd.get("qty")),
      note: fd.get("note") || null,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ສະຕັອກອາໄຫຼ່ ແລະ ສິນຄ້າ</h1>
          <p className="text-muted-foreground text-sm">ຈັດການສິນຄ້າທີ່ມີໃນຮ້ານ</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />ເພີ່ມສິນຄ້າ</Button>
      </div>

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "ແກ້ໄຂສິນຄ້າ" : "ເພີ່ມສິນຄ້າໃໝ່"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); if (!save.isPending) save.mutate(); }}
            className="space-y-3"
          >
            <div>
              <Label>ຮູບສິນຄ້າ</Label>
              <div className="flex items-center gap-3 mt-1">
                {form.image_url ? (
                  <div className="relative">
                    <img src={form.image_url} alt="" className="h-20 w-20 rounded-md object-cover border" />
                    <Button
                      type="button" size="icon" variant="destructive"
                      className="absolute -top-2 -right-2 h-5 w-5"
                      onClick={() => setForm({ ...form, image_url: "" })}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="h-20 w-20 rounded-md border border-dashed flex items-center justify-center text-muted-foreground">
                    <PackageIcon className="h-6 w-6" />
                  </div>
                )}
                <div>
                  <input
                    ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
                  />
                  <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                    <Upload className="h-3.5 w-3.5 mr-1" />
                    {uploading ? "ກຳລັງອັບໂຫຼດ..." : form.image_url ? "ປ່ຽນຮູບ" : "ອັບໂຫຼດຮູບ"}
                  </Button>
                </div>
              </div>
            </div>

            <div><Label>ຊື່ສິນຄ້າ *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>ລະຫັດ SKU</Label>
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              </div>
              <div>
                <Label>ໝວດ *</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as ItemCategory })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>ບາໂຄດ (Barcode)</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={form.barcode}
                  onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                  placeholder="ສະແກນ ຫຼື ປ້ອນເລກ"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => setScanFormOpen(true)} title="ສະແກນດ້ວຍກ້ອງ">
                  <Camera className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...form, barcode: genBarcode() })}>
                  <BarcodeIcon className="h-4 w-4 mr-1" />ສ້າງ
                </Button>
              </div>
              {form.barcode && (
                <div className="mt-2 flex justify-center border rounded-md py-2 bg-white">
                  <Barcode value={form.barcode} format={settings.barcode_format} height={40} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>ລາຄາທຶນ (₭)</Label>
                <Input type="number" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} />
              </div>
              <div><Label>ລາຄາຂາຍ (₭)</Label>
                <Input type="number" value={form.sell_price} onChange={(e) => setForm({ ...form, sell_price: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {!editingId && (
                <div><Label>ຈຳນວນເລີ່ມຕົ້ນ</Label>
                  <Input type="number" value={form.stock_qty} onChange={(e) => setForm({ ...form, stock_qty: e.target.value })} />
                </div>
              )}
              <div><Label>ແຈ້ງເຕືອນເມື່ອເຫຼືອ</Label>
                <Input type="number" value={form.low_stock_threshold}
                  onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>ລາຍລະອຽດ</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            {editingId && (
              <p className="text-xs text-muted-foreground">
                * ການແກ້ໄຂນີ້ບໍ່ປ່ຽນຈຳນວນສະຕັອກ. ໃຊ້ປຸ່ມ "ປັບສະຕັອກ" ເພື່ອປ່ຽນຈຳນວນ.
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>ຍົກເລີກ</Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="ຄົ້ນຫາສິນຄ້າ ຫຼື ສະແກນບາໂຄດ..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" onClick={() => setScanOpen(true)} title="ສະແກນດ້ວຍກ້ອງ">
          <Camera className="h-4 w-4 mr-1" />ສະແກນ
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {items?.map((item) => {
          const low = item.stock_qty <= item.low_stock_threshold;
          return (
            <Card key={item.id} className={low ? "border-amber-300" : ""}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="h-14 w-14 rounded-md object-cover border shrink-0" />
                  ) : (
                    <div className="h-14 w-14 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <PackageIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.name}</p>
                    <Badge variant="secondary" className="mt-1 text-xs">{CATEGORY_LABEL[item.category]}</Badge>
                    {item.sku && <p className="text-xs text-muted-foreground mt-1">SKU: {item.sku}</p>}
                    {item.barcode && <p className="text-xs text-muted-foreground font-mono">{item.barcode}</p>}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(item)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {item.barcode && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setPrintItem(item)} title="ພິມບາໂຄດ">
                        <Printer className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">ຄົງເຫຼືອ</p>
                    <p className={`text-2xl font-bold ${low ? "text-amber-600" : ""}`}>
                      {item.stock_qty}
                      {low && <AlertTriangle className="inline h-4 w-4 ml-1" />}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">ລາຄາຂາຍ</p>
                    <p className="font-medium">{formatLAK(Number(item.sell_price))}</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="w-full mt-3" onClick={() => setAdjustItem(item)}>
                  ປັບສະຕັອກ
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!adjustItem} onOpenChange={(o) => !o && setAdjustItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>ປັບສະຕັອກ: {adjustItem?.name}</DialogTitle></DialogHeader>
          <form onSubmit={handleAdjust} className="space-y-3">
            <p className="text-sm text-muted-foreground">ຄົງເຫຼືອປະຈຸບັນ: <b>{adjustItem?.stock_qty}</b></p>
            <div>
              <Label>ຈຳນວນ (ບວກ = ເພີ່ມ, ລົບ = ຫຼຸດ)</Label>
              <Input name="qty" type="number" required />
            </div>
            <div><Label>ໝາຍເຫດ</Label><Textarea name="note" rows={2} /></div>
            <DialogFooter><Button type="submit" disabled={adjust.isPending}>ຢືນຢັນ</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!printItem} onOpenChange={(o) => { if (!o) { setPrintItem(null); setPrintQty(1); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>ພິມປ້າຍບາໂຄດ</DialogTitle></DialogHeader>
          <div className="flex items-center justify-between gap-2 text-sm">
            <div>
              <p className="text-muted-foreground">ຮູບແບບ: <b>{settings.barcode_format}</b></p>
              <p className="text-muted-foreground">ຂະໜາດ: <b>{settings.label_width_mm}×{settings.label_height_mm} mm</b></p>
            </div>
            <div className="flex items-center gap-2">
              <Label>ຈຳນວນປ້າຍ</Label>
              <Input type="number" min={1} max={100} value={printQty} onChange={(e) => setPrintQty(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} className="w-20 h-8" />
            </div>
          </div>
          <div className="bg-muted/40 p-3 rounded max-h-72 overflow-auto">
            <div id="barcode-print-area" className="barcode-labels">
              {Array.from({ length: printQty }).map((_, i) => (
                <div
                  key={i}
                  className="barcode-label bg-white text-black border rounded-sm flex flex-col items-center justify-center px-1 py-0.5 mx-auto mb-2"
                  style={{ width: `${settings.label_width_mm}mm`, height: `${settings.label_height_mm}mm` }}
                >
                  {settings.barcode_show_shop && <div className="text-[8px] font-semibold truncate w-full text-center leading-tight">{settings.shop_name}</div>}
                  {settings.barcode_show_name && <div className="text-[10px] font-medium truncate w-full text-center leading-tight">{printItem?.name}</div>}
                  {printItem?.barcode && <Barcode value={printItem.barcode} format={settings.barcode_format} height={settings.barcode_bar_height} fontSize={10} />}
                  {settings.barcode_show_price && <div className="text-[10px] font-bold leading-tight">{formatLAK(Number(printItem?.sell_price ?? 0))}</div>}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPrintItem(null); setPrintQty(1); }}>ປິດ</Button>
            <Button onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />ພິມ ({printQty})</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BarcodeScanner
        open={scanOpen}
        onOpenChange={setScanOpen}
        title="ສະແກນເພື່ອຄົ້ນຫາສິນຄ້າ"
        onScan={(code) => { setSearch(code); toast.success("ສະແກນໄດ້: " + code); }}
      />
      <BarcodeScanner
        open={scanFormOpen}
        onOpenChange={setScanFormOpen}
        title="ສະແກນບາໂຄດສິນຄ້າ"
        onScan={(code) => setForm((f) => ({ ...f, barcode: code }))}
      />
    </div>
  );
}
