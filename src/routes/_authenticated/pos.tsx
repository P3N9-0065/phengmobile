import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScanLine, Plus, Minus, Trash2, X, Printer, Receipt as ReceiptIcon } from "lucide-react";
import { toast } from "sonner";
import { formatLAK } from "@/lib/format";
import {
  CURRENCY_LABEL, formatCurrency, fromLAK, PAYMENT_METHOD_LABEL, toLAK,
  type Currency,
} from "@/lib/currency";
import { usePosSettings } from "@/lib/settings";
import { Receipt, printReceipt, type ReceiptData } from "@/components/pos/Receipt";
import { useAuth } from "@/lib/auth";

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

function POSPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const settings = usePosSettings();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [currency, setCurrency] = useState<Currency>("LAK");
  const [rate, setRate] = useState<number>(settings.rates.LAK);
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setRate(settings.rates[currency]); setAmountPaid(0); }, [currency, settings.rates]);
  useEffect(() => { scanRef.current?.focus(); }, []);

  const { data: items } = useQuery({
    queryKey: ["pos-items", search],
    queryFn: async () => {
      let q = supabase.from("inventory_items").select("id,name,sku,sell_price,stock_qty,category").gt("stock_qty", 0).order("name").limit(60);
      if (search.trim()) q = q.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["pos-customers"],
    queryFn: async () => (await supabase.from("customers").select("id,name,phone").order("name").limit(200)).data ?? [],
  });

  const subtotal = useMemo(() => cart.reduce((s, l) => s + l.unit_price * l.qty, 0), [cart]);
  const total = Math.max(0, subtotal - discount);
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

  async function handleScan(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const code = e.currentTarget.value.trim();
    if (!code) return;
    const { data } = await supabase.from("inventory_items").select("id,name,sell_price,stock_qty").or(`sku.eq.${code},id.eq.${code}`).limit(1).maybeSingle();
    if (data) {
      addToCart(data as any);
      e.currentTarget.value = "";
      setSearch("");
    } else {
      toast.error("ບໍ່ພົບສິນຄ້າລະຫັດ: " + code);
    }
  }

  function resetSale() {
    setCart([]); setDiscount(0); setCustomerId(null); setPaymentMethod("cash");
    setCurrency("LAK"); setAmountPaid(0); scanRef.current?.focus();
  }

  const checkout = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("ບໍ່ມີຜູ້ໃຊ້");
      const { data: sale, error } = await supabase.from("sales").insert({
        customer_id: customerId, cashier_id: user.id, subtotal, discount, total,
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
        subtotal, discount, total, payment_method: paymentMethod,
        currency_paid: currency, exchange_rate: rate, amount_paid: amountPaid, change_lak: change,
      });
      qc.invalidateQueries({ queryKey: ["pos-items"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("ບັນທຶກບິນສຳເລັດ: " + sale.sale_code);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ຂາຍໜ້າຮ້ານ (POS)</h1>
          <p className="text-muted-foreground text-sm">ສະແກນບາໂຄດ ຫຼື ເລືອກສິນຄ້າເພື່ອເປີດບິນ</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Products */}
        <div className="lg:col-span-3 space-y-3">
          <div className="relative">
            <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={scanRef}
              placeholder="ສະແກນບາໂຄດ ຫຼື ຄົ້ນຫາສິນຄ້າ... (Enter ເພື່ອເພີ່ມ)"
              className="pl-9"
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleScan}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[65vh] overflow-auto pr-1">
            {items?.map((it) => (
              <Card key={it.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => addToCart(it as any)}>
                <CardContent className="p-3">
                  <p className="font-medium text-sm line-clamp-2 min-h-[2.5rem]">{it.name}</p>
                  {it.sku && <p className="text-[10px] text-muted-foreground">{it.sku}</p>}
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-sm font-bold text-primary">{formatLAK(Number(it.sell_price))}</p>
                    <Badge variant="outline" className="text-[10px]">{it.stock_qty}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
            {items?.length === 0 && <p className="col-span-full text-center text-sm text-muted-foreground py-8">ບໍ່ພົບສິນຄ້າ</p>}
          </div>
        </div>

        {/* Cart */}
        <div className="lg:col-span-2 space-y-3">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2"><ReceiptIcon className="h-4 w-4" />ລາຍການ ({cart.length})</h3>
                {cart.length > 0 && <Button variant="ghost" size="sm" onClick={resetSale}><X className="h-4 w-4 mr-1" />ລ້າງ</Button>}
              </div>

              <div className="space-y-2 max-h-[30vh] overflow-auto">
                {cart.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">ຍັງບໍ່ມີສິນຄ້າ</p>}
                {cart.map((l) => (
                  <div key={l.item_id} className="flex items-center gap-2 border rounded-md p-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{l.name}</p>
                      <p className="text-xs text-muted-foreground">{formatLAK(l.unit_price)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(l.item_id, l.qty - 1)}><Minus className="h-3 w-3" /></Button>
                      <Input className="w-12 h-7 text-center text-sm" value={l.qty} onChange={(e) => setQty(l.item_id, Number(e.target.value) || 1)} />
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(l.item_id, l.qty + 1)}><Plus className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeLine(l.item_id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2 pt-2 border-t">
                <div>
                  <Label className="text-xs">ລູກຄ້າ (ບໍ່ບັງຄັບ)</Label>
                  <Select value={customerId ?? "none"} onValueChange={(v) => setCustomerId(v === "none" ? null : v)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— ລູກຄ້າທົ່ວໄປ —</SelectItem>
                      {customers?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.phone})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-between text-sm"><span>ຍອດລວມ</span><span>{formatLAK(subtotal)}</span></div>
                <div className="flex justify-between items-center text-sm">
                  <span>ສ່ວນຫຼຸດ (₭)</span>
                  <Input type="number" className="h-7 w-28 text-right" value={discount} onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))} />
                </div>
                <div className="flex justify-between font-bold text-lg pt-1 border-t">
                  <span>ລວມຈ່າຍ</span><span className="text-primary">{formatLAK(total)}</span>
                </div>

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
                  <Input type="number" className="h-10 text-lg font-bold" value={amountPaid || ""} onChange={(e) => setAmountPaid(Number(e.target.value) || 0)} />
                </div>

                <div className="flex justify-between text-sm">
                  <span>ຮັບຕີເປັນກີບ</span><span>{formatLAK(paidLAK)}</span>
                </div>
                <div className={`flex justify-between font-bold ${change > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                  <span>ເງິນທອນ</span><span>{formatLAK(change)}</span>
                </div>

                <Button className="w-full h-11 text-base" disabled={!canCheckout || checkout.isPending} onClick={() => checkout.mutate()}>
                  ຢືນຢັນຊຳລະ
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

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
