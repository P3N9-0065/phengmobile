import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  ScanLine, Plus, Minus, Trash2, Printer, Receipt as ReceiptIcon,
  Settings, User, Pause, ListChecks, Package, Eraser, Camera,
} from "lucide-react";
import { BarcodeScanner } from "@/components/inventory/BarcodeScanner";
import { toast } from "sonner";
import { formatLAK } from "@/lib/format";
import {
  CURRENCY_LABEL, formatCurrency, fromLAK, PAYMENT_METHOD_LABEL, toLAK,
  type Currency,
} from "@/lib/currency";
import { usePosSettings } from "@/lib/settings";
import { Receipt, printReceipt, type ReceiptData } from "@/components/pos/Receipt";
import { useAuth } from "@/lib/auth";
import { CATEGORY_LABEL, type ItemCategory } from "@/lib/lao";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pos")({
  component: POSPage,
});

interface CartLine {
  item_id: string;
  name: string;
  unit_price: number;
  qty: number;
  stock_qty: number;
}

const PAYMENT_METHODS = ["cash", "qr", "transfer", "card"] as const;
const CURRENCIES: Currency[] = ["LAK", "THB", "USD"];
const ALL_CATS: (ItemCategory | "all")[] = ["all", "part", "accessory", "phone_new", "phone_used", "tool"];
const CAT_LABEL_ALL: Record<string, string> = { all: "ທັງໝົດ", ...CATEGORY_LABEL };

function POSPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const settings = usePosSettings();
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<ItemCategory | "all">("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [discountPct, setDiscountPct] = useState(0);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [currency, setCurrency] = useState<Currency>("LAK");
  const [rate, setRate] = useState<number>(settings.rates.LAK);
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [showPay, setShowPay] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setRate(settings.rates[currency]); setAmountPaid(0); }, [currency, settings.rates]);
  useEffect(() => { scanRef.current?.focus(); }, []);

  const { data: items } = useQuery({
    queryKey: ["pos-items", search, activeCat],
    queryFn: async () => {
      let q = supabase.from("inventory_items").select("id,name,sku,barcode,sell_price,stock_qty,category").gt("stock_qty", 0).order("name").limit(120);
      if (activeCat !== "all") q = q.eq("category", activeCat);
      if (search.trim()) q = q.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["pos-customers"],
    queryFn: async () => (await supabase.from("customers").select("id,name,phone").order("name").limit(200)).data ?? [],
  });

  const subtotal = useMemo(() => cart.reduce((s, l) => s + l.unit_price * l.qty, 0), [cart]);
  const totalDiscount = Math.min(subtotal, discount + Math.floor((subtotal * discountPct) / 100));
  const total = Math.max(0, subtotal - totalDiscount);
  const paidLAK = toLAK(amountPaid, currency, rate);
  const change = Math.max(0, paidLAK - total);
  const canCheckout = cart.length > 0 && paidLAK >= total;

  function addToCart(item: { id: string; name: string; sell_price: number; stock_qty: number }) {
    setCart((c) => {
      const ex = c.find((l) => l.item_id === item.id);
      if (ex) {
        if (ex.qty + 1 > item.stock_qty) { toast.error("ສິນຄ້າບໍ່ພໍໃນສະຕັອກ"); return c; }
        return c.map((l) => l.item_id === item.id ? { ...l, qty: l.qty + 1 } : l);
      }
      return [...c, { item_id: item.id, name: item.name, unit_price: Number(item.sell_price), qty: 1, stock_qty: item.stock_qty }];
    });
  }

  function setQty(item_id: string, qty: number) {
    setCart((c) => c.map((l) => {
      if (l.item_id !== item_id) return l;
      const q = Math.max(1, Math.min(l.stock_qty, qty));
      return { ...l, qty: q };
    }));
  }

  function removeLine(item_id: string) { setCart((c) => c.filter((l) => l.item_id !== item_id)); }

  async function lookupAndAdd(code: string) {
    const c = code.trim();
    if (!c) return;
    const { data } = await supabase
      .from("inventory_items")
      .select("id,name,sell_price,stock_qty")
      .or(`barcode.eq.${c},sku.eq.${c},id.eq.${c}`)
      .limit(1)
      .maybeSingle();
    if (data) {
      addToCart(data as any);
      toast.success("ເພີ່ມ: " + data.name);
    } else {
      toast.error("ບໍ່ພົບສິນຄ້າລະຫັດ: " + c);
    }
  }

  async function handleScan(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const code = e.currentTarget.value.trim();
    if (!code) return;
    await lookupAndAdd(code);
    e.currentTarget.value = "";
    setSearch("");
  }

  function resetSale() {
    setCart([]); setDiscount(0); setDiscountPct(0); setCustomerId(null); setPaymentMethod("cash");
    setCurrency("LAK"); setAmountPaid(0); setShowPay(false); scanRef.current?.focus();
  }

  // Keyboard shortcuts: F2 = pay, F9 = focus barcode
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "F9") { e.preventDefault(); scanRef.current?.focus(); }
      if (e.key === "F2") { e.preventDefault(); if (cart.length > 0) setShowPay(true); }
      if (e.key === "Escape") setShowPay(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cart.length]);

  const checkout = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("ບໍ່ມີຜູ້ໃຊ້");
      const { data: sale, error } = await supabase.from("sales").insert({
        customer_id: customerId, cashier_id: user.id, subtotal, discount: totalDiscount, total,
        payment_method: paymentMethod as any, currency_paid: currency,
        exchange_rate: rate, amount_paid: amountPaid, change_lak: change,
      }).select().single();
      if (error) throw error;
      const lines = cart.map((l) => ({
        sale_id: sale.id, item_id: l.item_id, name_snapshot: l.name,
        qty: l.qty, unit_price: l.unit_price, line_total: l.unit_price * l.qty,
        created_by: user.id,
      }));
      const { error: e2 } = await supabase.from("sale_items").insert(lines);
      if (e2) throw e2;
      return sale;
    },
    onSuccess: (sale) => {
      const cust = customers?.find((c) => c.id === customerId);
      setReceipt({
        sale_code: sale.sale_code, created_at: sale.created_at,
        cashier_email: user?.email, customer_name: cust?.name ?? null,
        items: cart.map((l) => ({ name: l.name, qty: l.qty, unit_price: l.unit_price, line_total: l.unit_price * l.qty })),
        subtotal, discount: totalDiscount, total, payment_method: paymentMethod,
        currency_paid: currency, exchange_rate: rate, amount_paid: amountPaid, change_lak: change,
      });
      setShowPay(false);
      qc.invalidateQueries({ queryKey: ["pos-items"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("ບັນທຶກບິນສຳເລັດ: " + sale.sale_code);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="-m-4 md:-m-6 min-h-[calc(100vh-3.5rem)] bg-slate-100">
      {/* Top header — green bar */}
      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-4 py-3 shadow">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 min-w-[180px]">
            <Logo className="h-9 w-9 rounded bg-white/95 p-1" />
            <div className="leading-tight">
              <div className="font-bold">{settings.shop_name}</div>
              <div className="text-[11px] opacity-90">{settings.shop_name_en}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <User className="h-4 w-4 opacity-90" />
            <span className="opacity-90">ພະນັກງານ:</span>
            <span className="bg-white/15 px-2 py-1 rounded">{user?.email}</span>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-xs opacity-90">ລູກຄ້າ [F8]</Label>
            <Select value={customerId ?? "none"} onValueChange={(v) => setCustomerId(v === "none" ? null : v)}>
              <SelectTrigger className="h-8 w-56 bg-white text-slate-900"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">000 ລູກຄ້າທົ່ວໄປ</SelectItem>
                {customers?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.phone})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="bg-slate-900 text-amber-300 font-mono font-bold text-2xl px-5 py-1.5 rounded shadow-inner tracking-wider min-w-[180px] text-right">
              {formatLAK(total)}
            </div>
            <Link to="/settings">
              <Button size="sm" variant="secondary" className="bg-white/95 text-slate-800 hover:bg-white">
                <Settings className="h-4 w-4 mr-1" />ຕັ້ງຄ່າ POS
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-3 grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* LEFT — products */}
        <div className="lg:col-span-8 bg-white rounded-md shadow-sm border flex flex-col">
          {/* Search row */}
          <div className="flex items-center gap-2 p-3 border-b bg-slate-50">
            <div className="bg-slate-800 text-white p-2 rounded">
              <ScanLine className="h-5 w-5" />
            </div>
            <div className="relative flex-1">
              <Input
                ref={scanRef}
                placeholder="barcode [F9] — ສະແກນ ຫຼື ຄົ້ນຫາສິນຄ້າ"
                className="pl-3 h-10 bg-white border-slate-300"
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleScan}
              />
            </div>
            <div className="text-xs text-slate-600">
              ສິນຄ້າ <span className="font-bold text-slate-900">{items?.length ?? 0}</span> ລາຍການ
            </div>
          </div>

          {/* Category tabs */}
          <div className="flex flex-wrap gap-1 px-3 pt-3 pb-2 border-b">
            {ALL_CATS.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCat(c)}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-t border-b-2 transition-colors",
                  activeCat === c
                    ? "border-emerald-600 text-emerald-700 font-semibold bg-emerald-50"
                    : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                {CAT_LABEL_ALL[c]}
              </button>
            ))}
          </div>

          {/* Product grid */}
          <div className="p-3 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 overflow-auto" style={{ maxHeight: "calc(100vh - 16rem)" }}>
            {items?.map((it) => (
              <button
                key={it.id}
                onClick={() => addToCart(it as any)}
                className="group text-left bg-white border border-slate-200 rounded-md overflow-hidden hover:border-emerald-500 hover:shadow-md transition-all"
              >
                <div className="aspect-square bg-slate-50 flex items-center justify-center text-slate-300 relative">
                  <Package className="h-12 w-12" />
                  <Badge className="absolute top-1 right-1 bg-emerald-600 text-white text-[10px]">×{it.stock_qty}</Badge>
                  <div className="absolute bottom-1 left-1 bg-slate-900/80 text-amber-300 text-[11px] font-bold px-1.5 py-0.5 rounded">
                    {formatLAK(Number(it.sell_price))}
                  </div>
                </div>
                <div className="bg-sky-100 group-hover:bg-emerald-100 px-2 py-1.5 text-center">
                  <p className="text-xs font-medium line-clamp-2 min-h-[2rem] text-slate-800">{it.name}</p>
                  {it.sku && <p className="text-[10px] text-slate-500 truncate">{it.sku}</p>}
                </div>
              </button>
            ))}
            {items?.length === 0 && <p className="col-span-full text-center text-sm text-muted-foreground py-12">ບໍ່ພົບສິນຄ້າ</p>}
          </div>
        </div>

        {/* RIGHT — cart panel */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="border-amber-400 text-amber-700 hover:bg-amber-50">
              <Pause className="h-4 w-4 mr-1" />ພັກບິນ
            </Button>
            <Button variant="outline" className="border-blue-400 text-blue-700 hover:bg-blue-50" asChild>
              <Link to="/sales"><ListChecks className="h-4 w-4 mr-1" />ບິນທີ່ຜ່ານມາ</Link>
            </Button>
          </div>

          <Button
            className="w-full h-14 text-lg font-bold bg-violet-600 hover:bg-violet-700 shadow-md"
            disabled={cart.length === 0}
            onClick={() => setShowPay(true)}
          >
            <ReceiptIcon className="h-5 w-5 mr-2" />ຊຳລະເງິນ [F2]
          </Button>

          <div className="bg-white rounded-md shadow-sm border flex flex-col flex-1">
            <div className="grid grid-cols-12 bg-slate-800 text-white text-xs font-semibold px-2 py-2 rounded-t-md">
              <div className="col-span-1">#</div>
              <div className="col-span-6">ສິນຄ້າ</div>
              <div className="col-span-2 text-center">ຈຳນວນ</div>
              <div className="col-span-3 text-right pr-1">ລວມ</div>
            </div>
            <div className="flex-1 overflow-auto" style={{ maxHeight: "calc(100vh - 26rem)" }}>
              {cart.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-12">
                  ຍັງບໍ່ມີສິນຄ້າໃນບິນ
                </div>
              )}
              {cart.map((l, i) => (
                <div key={l.item_id} className="grid grid-cols-12 items-center px-2 py-2 border-b text-sm hover:bg-slate-50">
                  <div className="col-span-1 text-slate-500">{i + 1}</div>
                  <div className="col-span-6 min-w-0">
                    <p className="truncate font-medium">{l.name}</p>
                    <p className="text-[11px] text-slate-500">{formatLAK(l.unit_price)}</p>
                  </div>
                  <div className="col-span-2 flex items-center justify-center gap-0.5">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setQty(l.item_id, l.qty - 1)}><Minus className="h-3 w-3" /></Button>
                    <Input className="w-9 h-6 text-center text-xs px-1" value={l.qty} onChange={(e) => setQty(l.item_id, Number(e.target.value) || 1)} />
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setQty(l.item_id, l.qty + 1)}><Plus className="h-3 w-3" /></Button>
                  </div>
                  <div className="col-span-3 text-right pr-1 flex items-center justify-end gap-1">
                    <span className="font-semibold">{formatLAK(l.unit_price * l.qty)}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeLine(l.item_id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t p-3 space-y-2 bg-slate-50 rounded-b-md">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">ຈຳນວນລາຍການ</span>
                <span className="font-semibold">{cart.length} ລາຍການ</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">ສ່ວນຫຼຸດ %</span>
                <Input type="number" min={0} max={100} className="h-7 w-20 text-right" value={discountPct || ""} onChange={(e) => setDiscountPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} />
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">ສ່ວນຫຼຸດ ₭</span>
                <Input type="number" min={0} className="h-7 w-28 text-right" value={discount || ""} onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))} />
              </div>
              <div className="flex justify-between text-sm border-t pt-2">
                <span>ຍອດລວມ</span><span>{formatLAK(subtotal)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg">
                <span>ລວມຈ່າຍ</span>
                <span className="text-emerald-700">{formatLAK(total)}</span>
              </div>
              {cart.length > 0 && (
                <Button variant="ghost" size="sm" onClick={resetSale} className="w-full text-destructive hover:text-destructive hover:bg-red-50">
                  <Eraser className="h-4 w-4 mr-1" />ລ້າງລາຍການ
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Payment dialog */}
      <Dialog open={showPay} onOpenChange={setShowPay}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>ຊຳລະເງິນ — {formatLAK(total)}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">ວິທີຊຳລະ</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">ສະກຸນເງິນ</Label>
                <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{CURRENCY_LABEL[c]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {currency !== "LAK" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">ອັດຕາ (1 {currency} = ₭)</Label>
                  <Input type="number" className="h-9" value={rate} onChange={(e) => setRate(Number(e.target.value) || 1)} />
                </div>
                <div>
                  <Label className="text-xs">ຍອດລວມ ({currency})</Label>
                  <Input className="h-9" readOnly value={formatCurrency(fromLAK(total, currency, rate), currency)} />
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs">ຮັບເງິນ ({currency})</Label>
              <Input
                type="number"
                autoFocus
                className="h-12 text-2xl font-bold text-right"
                value={amountPaid || ""}
                onChange={(e) => setAmountPaid(Number(e.target.value) || 0)}
                onKeyDown={(e) => { if (e.key === "Enter" && canCheckout) checkout.mutate(); }}
              />
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[total, Math.ceil(total / 10000) * 10000, Math.ceil(total / 50000) * 50000, Math.ceil(total / 100000) * 100000].map((v, i) => (
                <Button key={i} variant="outline" size="sm" onClick={() => { setCurrency("LAK"); setAmountPaid(v); }}>
                  {formatLAK(v)}
                </Button>
              ))}
            </div>

            <div className="flex justify-between text-sm pt-2 border-t">
              <span>ຮັບຕີເປັນກີບ</span><span className="font-semibold">{formatLAK(paidLAK)}</span>
            </div>
            <div className={cn("flex justify-between text-xl font-bold", change > 0 ? "text-emerald-600" : "text-slate-400")}>
              <span>ເງິນທອນ</span><span>{formatLAK(change)}</span>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPay(false)}>ຍົກເລີກ</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={!canCheckout || checkout.isPending} onClick={() => checkout.mutate()}>
              ຢືນຢັນຊຳລະ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt dialog */}
      <Dialog open={!!receipt} onOpenChange={(o) => { if (!o) { setReceipt(null); resetSale(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>ໃບເສັດ</DialogTitle></DialogHeader>
          {receipt && <Receipt data={receipt} />}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setReceipt(null); resetSale(); }}>ປິດ</Button>
            <Button onClick={printReceipt}><Printer className="h-4 w-4 mr-2" />ພິມໃບເສັດ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
