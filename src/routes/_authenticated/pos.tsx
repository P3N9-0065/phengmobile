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
  Settings, User, Pause, ListChecks, Package, Eraser, Repeat,
} from "lucide-react";
import { BarcodeScanner } from "@/components/inventory/BarcodeScanner";
import { toast } from "sonner";
import { formatLAK } from "@/lib/format";
import { CURRENCY_LABEL, formatCurrency, fromLAK, PAYMENT_METHOD_LABEL, toLAK,
  type Currency,
} from "@/lib/currency";
import { usePosSettings } from "@/lib/settings";
import { Receipt, printReceipt, type ReceiptData } from "@/components/pos/Receipt";
import { useAuth } from "@/lib/auth";
import { CATEGORY_LABEL, type ItemCategory } from "@/lib/lao";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { fallbackLookup, type LookupItem } from "@/lib/barcode-lookup";
import { clearScanCache } from "@/lib/scan-cache";
import { useLoyaltySettings, computeTier, TIER_LABEL, TIER_COLOR } from "@/lib/loyalty";
import { Award } from "lucide-react";
import { SignedImg } from "@/components/SignedImg";

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
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [currency, setCurrency] = useState<Currency>("LAK");
  const [rate, setRate] = useState<number>(settings.rates.LAK);
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [showPay, setShowPay] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanContinuous, setScanContinuous] = useState(false);
  const [scanResults, setScanResults] = useState<LookupItem[] | null>(null);
  const [scanCode, setScanCode] = useState("");
  const scanRef = useRef<HTMLInputElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data: loyalty } = useLoyaltySettings();

  useEffect(() => { setRate(settings.rates[currency]); setAmountPaid(0); }, [currency, settings.rates]);
  useEffect(() => { scanRef.current?.focus(); }, []);
  useEffect(() => { setPointsToRedeem(0); }, [customerId]);

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["pos-items", search, activeCat],
    queryFn: async () => {
      let q = supabase.from("inventory_items").select("id,name,sku,barcode,sell_price,stock_qty,category,description,cost_price,low_stock_threshold,image_url").gt("stock_qty", 0).order("name").limit(120);
      if (activeCat !== "all") q = q.eq("category", activeCat);
      if (search.trim()) q = q.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["pos-customers"],
    queryFn: async () => (await supabase.from("customers").select("id,name,phone,points").order("name").limit(200)).data ?? [],
  });

  const selectedCustomer = customers?.find((c) => c.id === customerId) ?? null;
  const customerTier = computeTier(selectedCustomer?.points ?? 0, loyalty);

  const subtotal = useMemo(() => cart.reduce((s, l) => s + l.unit_price * l.qty, 0), [cart]);
  const manualDiscount = Math.min(subtotal, discount + Math.floor((subtotal * discountPct) / 100));
  const baseAfterManual = Math.max(0, subtotal - manualDiscount);
  const redeemValue = loyalty?.redeem_value_lak ?? 0;
  const maxRedeemablePoints = redeemValue > 0
    ? Math.min(selectedCustomer?.points ?? 0, Math.floor(baseAfterManual / redeemValue))
    : 0;
  const effectivePoints = Math.min(pointsToRedeem, maxRedeemablePoints);
  const pointsDiscount = effectivePoints * redeemValue;
  const totalDiscount = manualDiscount + pointsDiscount;
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

  async function lookupAndAdd(code: string, opts?: { auto?: boolean }) {
    const c = code.trim();
    if (!c) return;
    const results = await fallbackLookup(c);
    if (results.length === 1) {
      addToCart(results[0]);
      toast.success("ເພີ່ມ: " + results[0].name);
    } else if (results.length > 1) {
      if (opts?.auto) {
        // โหมดต่อเนื่อง: เลือกตัวที่ตรงกับ barcode ก่อน ถ้าไม่มีใช้ตัวแรก
        const exact = results.find((r) => (r as any).barcode === c) ?? results[0];
        addToCart(exact);
        toast.success("ເພີ່ມ: " + exact.name);
      } else {
        setScanCode(c);
        setScanResults(results);
      }
    } else {
      toast.error("ບໍ່ພົບສິນຄ້າລະຫັດ: " + c);
    }
  }

  async function handleScan(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const code = e.currentTarget.value.trim();
    if (!code) return;
    e.currentTarget.value = "";
    setSearch("");
    setScanCode("");
    await lookupAndAdd(code);
  }

  function resetSale() {
    setCart([]); setDiscount(0); setDiscountPct(0); setCustomerId(null); setPaymentMethod("cash");
    setCurrency("LAK"); setAmountPaid(0); setShowPay(false); setPointsToRedeem(0); scanRef.current?.focus();
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
        points_redeemed: effectivePoints, points_discount: pointsDiscount,
      } as any).select().single();
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
      qc.invalidateQueries({ queryKey: ["pos-customers"] });
      qc.invalidateQueries({ queryKey: ["customer"] });
      qc.invalidateQueries({ queryKey: ["customer-points"] });
      clearScanCache();
      const earned = redeemValue && loyalty?.earn_rate_lak ? Math.floor(total / loyalty.earn_rate_lak) : 0;
      const msg = "ບັນທຶກບິນສຳເລັດ: " + sale.sale_code
        + (effectivePoints > 0 ? ` (ໃຊ້ ${effectivePoints} ແຕ້ມ)` : "")
        + (earned > 0 && customerId ? ` (+${earned} ແຕ້ມ)` : "");
      toast.success(msg);
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
            {selectedCustomer && loyalty?.enabled && (
              <div className="flex items-center gap-1 bg-white/15 px-2 py-1 rounded text-xs">
                <Award className="h-3 w-3 text-amber-300" />
                <span className="font-semibold">{selectedCustomer.points}</span>
                <span className="opacity-80">ແຕ້ມ</span>
                {customerTier !== "none" && (
                  <Badge variant="outline" className={cn("ml-1 text-[10px] py-0", TIER_COLOR[customerTier])}>
                    {TIER_LABEL[customerTier]}
                  </Badge>
                )}
              </div>
            )}
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
            <div className="relative flex-1">
              <Input
                ref={scanRef}
                placeholder="ສະແກນບາໂຄ້ດ ຫຼື ຄົ້ນຫາຊື່/SKU..."
                className="pl-3 h-10 bg-white border-amber-400 focus:border-amber-500 focus:ring-amber-200 rounded-lg"
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleScan}
              />
            </div>
            <Select value={activeCat} onValueChange={(v) => setActiveCat(v as ItemCategory | "all")}>
              <SelectTrigger className="h-10 w-32 bg-white border-slate-300">
                <SelectValue placeholder="ຄັ້ງຫຼັກ ★" />
              </SelectTrigger>
              <SelectContent>
                {ALL_CATS.map((c) => (
                  <SelectItem key={c} value={c}>{CAT_LABEL_ALL[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-10 border-slate-300" onClick={() => { setScanContinuous(false); setScanOpen(true); }} title="ສະແກນດ້ວຍກ້ອງ">
              <ScanLine className="h-4 w-4 mr-1" />ສະແກນ
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-10 border-emerald-500 text-emerald-700 hover:bg-emerald-50"
              onClick={() => { setScanContinuous(true); setScanOpen(true); }}
              title="ສະແກນຫຼາຍລາຍການຕໍ່ກັນ"
            >
              <Repeat className="h-4 w-4 mr-1" />ຕໍ່ເນື່ອງ
            </Button>
          </div>

          {/* Category tabs */}
          <div className="flex flex-wrap gap-2 px-3 pt-3 pb-2 border-b">
            {ALL_CATS.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCat(c)}
                className={cn(
                  "px-4 py-1.5 text-sm rounded-full transition-colors border",
                  activeCat === c
                    ? "bg-slate-800 text-white border-slate-800 font-semibold"
                    : "bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:border-slate-300"
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
                onMouseEnter={() => {
                  if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
                  hoverTimerRef.current = setTimeout(() => setHoveredId(it.id), 250);
                }}
                onMouseLeave={() => {
                  if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
                  setHoveredId(null);
                }}
                className="group text-left bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-amber-400 hover:shadow-lg transition-all flex flex-col relative"
              >
                {/* Hover popup */}
                {hoveredId === it.id && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 w-64 bg-slate-900 text-white rounded-lg shadow-xl p-3 animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                    <div className="flex items-start gap-2">
                      {it.image_url ? (
                        <img src={it.image_url} alt={it.name} className="h-14 w-14 rounded object-cover shrink-0 bg-slate-700" />
                      ) : (
                        <div className="h-14 w-14 rounded bg-slate-700 flex items-center justify-center shrink-0">
                          <Package className="h-6 w-6 text-slate-400" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight truncate">{it.name}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{CATEGORY_LABEL[it.category as ItemCategory] ?? it.category}</p>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1 text-[11px] text-slate-300">
                      {it.sku && <p className="flex justify-between"><span className="text-slate-400">SKU</span> <span className="font-mono text-slate-200">{it.sku}</span></p>}
                      {it.barcode && <p className="flex justify-between"><span className="text-slate-400">Barcode</span> <span className="font-mono text-slate-200">{it.barcode}</span></p>}
                      <p className="flex justify-between"><span className="text-slate-400">ລາຄາຂາຍ</span> <span className="font-semibold text-amber-400">{formatLAK(Number(it.sell_price))}</span></p>
                      {it.cost_price ? <p className="flex justify-between"><span className="text-slate-400">ຕົ້ນທຶນ</span> <span className="font-mono text-slate-200">{formatLAK(Number(it.cost_price))}</span></p> : null}
                      <p className="flex justify-between">
                        <span className="text-slate-400">ສະຕັອກ</span>
                        <span className={it.stock_qty <= (it.low_stock_threshold ?? 5) ? "text-amber-400 font-semibold" : "text-slate-200"}>
                          {it.stock_qty} {it.stock_qty <= (it.low_stock_threshold ?? 5) ? "(ໃກ້ໝົດ)" : ""}
                        </span>
                      </p>
                    </div>
                    {it.description && <p className="mt-2 text-[11px] text-slate-400 line-clamp-2 border-t border-slate-700 pt-1.5">{it.description}</p>}
                    {/* Arrow */}
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 rotate-45" />
                  </div>
                )}
                <div className="relative bg-slate-100 flex items-center justify-center text-slate-300 h-32 shrink-0 overflow-hidden">
                  {it.image_url ? (
                    <SignedImg src={it.image_url} alt={it.name} className="h-full w-full object-cover" />
                  ) : (
                    <Package className="h-20 w-20 text-slate-300" />
                  )}
                </div>
                <div className="px-3 py-2.5 flex-1 flex flex-col gap-0.5 bg-white relative">
                  <p className="text-sm font-bold text-slate-900 leading-tight line-clamp-2 min-h-[2.25rem]">{it.name}</p>
                  <p className="text-[11px] text-slate-500">{CATEGORY_LABEL[it.category as ItemCategory] ?? it.category}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-sm font-bold text-amber-600">{formatLAK(Number(it.sell_price))}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 font-medium">
                      ສະຕ໋ອກ: {it.stock_qty}
                    </span>
                  </div>
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

          <div className="bg-white rounded-xl shadow-sm border flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center justify-between bg-slate-800 text-white px-4 py-3">
              <span className="font-semibold text-sm">ລາຍການສັ່ງຊື້</span>
              <span className="text-xs bg-white/15 px-2 py-1 rounded-full">{cart.length} ລາຍການ</span>
            </div>
            <div className="grid grid-cols-12 bg-slate-700 text-white text-xs font-semibold px-3 py-2">
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
              {selectedCustomer && loyalty?.enabled && (selectedCustomer.points ?? 0) > 0 && maxRedeemablePoints > 0 && (
                <div className="space-y-1 border rounded p-2 bg-amber-50/50">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-amber-800 font-medium">
                      <Award className="h-3 w-3" />ໃຊ້ແຕ້ມ (ມີ {selectedCustomer.points}, ສູງສຸດ {maxRedeemablePoints})
                    </span>
                    <Button size="sm" variant="ghost" className="h-5 text-[10px] px-2" onClick={() => setPointsToRedeem(maxRedeemablePoints)}>
                      ໃຊ້ສູງສຸດ
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input type="number" min={0} max={maxRedeemablePoints} className="h-7 w-24 text-right"
                      value={pointsToRedeem || ""}
                      onChange={(e) => setPointsToRedeem(Math.max(0, Math.min(maxRedeemablePoints, Number(e.target.value) || 0)))} />
                    <span className="text-xs text-slate-600">ແຕ້ມ = </span>
                    <span className="text-sm font-semibold text-emerald-700">-{formatLAK(pointsDiscount)}</span>
                  </div>
                </div>
              )}
              <div className="flex justify-between text-sm border-t pt-2">
                <span>ຍອດລວມ</span><span>{formatLAK(subtotal)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-xs text-emerald-700">
                  <span>ສ່ວນຫຼຸດທັງໝົດ</span><span>-{formatLAK(totalDiscount)}</span>
                </div>
              )}
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

      <BarcodeScanner
        open={scanOpen}
        onOpenChange={setScanOpen}
        title={scanContinuous ? "ສະແກນຕໍ່ເນື່ອງເພື່ອເພີ່ມຫຼາຍລາຍການ" : "ສະແກນບາໂຄດເພື່ອເພີ່ມສິນຄ້າ"}
        continuous={scanContinuous}
        onScan={(code) => lookupAndAdd(code, { auto: scanContinuous })}
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
                onClick={() => { addToCart(it); setScanResults(null); toast.success("ເພີ່ມ: " + it.name); }}
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
    </div>
  );
}
