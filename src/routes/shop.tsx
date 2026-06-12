import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Package as PackageIcon, Search, MessageCircle, Phone, Store, ShoppingCart, Plus, Minus, Trash2, Upload, CheckCircle2, Truck } from "lucide-react";
import { formatLAK } from "@/lib/format";
import { CATEGORY_LABEL, type ItemCategory } from "@/lib/lao";
import { DEFAULT_SETTINGS, loadSettings } from "@/lib/settings";
import { useCart, addToCart, updateQty, removeFromCart, clearCart } from "@/lib/cart";
import { useShippingSettings, calcShipping, DEFAULT_SHIPPING } from "@/lib/shipping";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "ສິນຄ້າຮ້ານເພັງ ໂມບາຍ" },
      { name: "description", content: "ມືຖື ອຸປະກອນເສີມ ແລະ ອາໄຫຼ່ ລາຄາພິເສດ - ສັ່ງຊື້ອອນລາຍ" },
      { property: "og:title", content: "ສິນຄ້າຮ້ານເພັງ ໂມບາຍ" },
      { property: "og:description", content: "ມືຖື ອຸປະກອນເສີມ ແລະ ອາໄຫຼ່ - ສັ່ງຊື້ອອນລາຍ" },
    ],
  }),
  component: ShopPage,
});

const CATS: (ItemCategory | "all")[] = ["all", "phone_new", "phone_used", "accessory", "part", "tool"];

function ShopPage() {
  const settings = typeof window !== "undefined" ? loadSettings() : DEFAULT_SETTINGS;
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<ItemCategory | "all">("all");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [successCode, setSuccessCode] = useState<string | null>(null);
  const cart = useCart();

  type ShopItem = {
    id: string;
    name: string;
    category: ItemCategory;
    sell_price: number;
    image_url: string | null;
    description: string | null;
    stock_qty: number;
  };
  const { data: items, isLoading } = useQuery<ShopItem[]>({
    queryKey: ["shop-featured"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("public_shop_items")
        .select("id,name,category,sell_price,image_url,description,in_stock")
        .order("name");
      if (error) throw error;
      return (data ?? []).map((i: any) => ({
        id: i.id,
        name: i.name,
        category: i.category as ItemCategory,
        sell_price: Number(i.sell_price),
        image_url: i.image_url,
        description: i.description,
        stock_qty: i.in_stock ? 1 : 0,
      }));
    },
  });

  const filtered = useMemo(() => {
    let arr = items ?? [];
    if (cat !== "all") arr = arr.filter((i) => i.category === cat);
    const s = q.trim().toLowerCase();
    if (s) arr = arr.filter((i) => i.name.toLowerCase().includes(s));
    return arr;
  }, [items, cat, q]);

  const phone = settings.shop_phone?.replace(/[^\d+]/g, "");

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Store className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold truncate">{settings.shop_name}</h1>
            <p className="text-xs text-muted-foreground truncate">{settings.receipt_header}</p>
          </div>
          {phone && (
            <Button size="sm" variant="outline" asChild className="hidden sm:inline-flex">
              <a href={`tel:${phone}`}><Phone className="h-4 w-4 mr-1" />{settings.shop_phone}</a>
            </Button>
          )}
          <Sheet open={cartOpen} onOpenChange={setCartOpen}>
            <SheetTrigger asChild>
              <Button size="sm" className="relative">
                <ShoppingCart className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">ກະຕ່າ</span>
                {cart.count > 0 && (
                  <Badge className="ml-1 h-5 min-w-5 px-1 rounded-full" variant="secondary">{cart.count}</Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md flex flex-col">
              <SheetHeader>
                <SheetTitle>ກະຕ່າສິນຄ້າ</SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-auto py-3 space-y-2">
                {cart.items.length === 0 && (
                  <div className="text-center text-muted-foreground py-12">
                    <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>ກະຕ່າຫວ່າງເປົ່າ</p>
                  </div>
                )}
                {cart.items.map((it) => (
                  <div key={it.id} className="flex gap-3 border rounded-lg p-2">
                    <div className="h-16 w-16 bg-muted rounded shrink-0 overflow-hidden">
                      {it.image_url ? (
                        <img src={it.image_url} alt={it.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center"><PackageIcon className="h-6 w-6 text-muted-foreground" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-2">{it.name}</p>
                      <p className="text-primary font-bold text-sm">{formatLAK(it.price)}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(it.id, it.qty - 1)}><Minus className="h-3 w-3" /></Button>
                        <span className="w-8 text-center text-sm">{it.qty}</span>
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(it.id, it.qty + 1)} disabled={it.qty >= it.stock_qty}><Plus className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 ml-auto text-destructive" onClick={() => removeFromCart(it.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {cart.items.length > 0 && (
                <SheetFooter className="flex-col gap-2 sm:flex-col">
                  <div className="flex justify-between w-full font-bold">
                    <span>ລວມ:</span>
                    <span className="text-primary">{formatLAK(cart.subtotal)}</span>
                  </div>
                  <Button className="w-full" onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}>
                    ສັ່ງຊື້
                  </Button>
                </SheetFooter>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="ຄົ້ນຫາສິນຄ້າ..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATS.map((c) => (
            <Button key={c} size="sm" variant={cat === c ? "default" : "outline"} onClick={() => setCat(c)} className="shrink-0">
              {c === "all" ? "ທັງໝົດ" : CATEGORY_LABEL[c]}
            </Button>
          ))}
        </div>

        {isLoading && <p className="text-center text-muted-foreground py-12">ກຳລັງໂຫລດ...</p>}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <PackageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>ຍັງບໍ່ມີສິນຄ້າສະແດງ</p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((item) => {
            const soldOut = item.stock_qty <= 0;
            return (
              <Card key={item.id} className="overflow-hidden flex flex-col">
                <div className="aspect-square bg-muted relative">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center"><PackageIcon className="h-10 w-10 text-muted-foreground" /></div>
                  )}
                  {soldOut && <Badge variant="destructive" className="absolute top-2 right-2">ໝົດ</Badge>}
                </div>
                <CardContent className="p-3 flex-1 flex flex-col gap-2">
                  <div className="flex-1">
                    <p className="font-medium text-sm line-clamp-2">{item.name}</p>
                    <Badge variant="secondary" className="mt-1 text-[10px]">{CATEGORY_LABEL[item.category]}</Badge>
                  </div>
                  <p className="text-primary font-bold">{formatLAK(Number(item.sell_price))}</p>
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={soldOut}
                    onClick={() => {
                      addToCart({
                        id: item.id,
                        name: item.name,
                        price: Number(item.sell_price),
                        image_url: item.image_url,
                        stock_qty: item.stock_qty,
                      });
                      toast.success("ເພີ່ມເຂົ້າກະຕ່າແລ້ວ");
                    }}
                  >
                    <ShoppingCart className="h-3.5 w-3.5 mr-1" />ເພີ່ມເຂົ້າກະຕ່າ
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>

      <CheckoutDialog open={checkoutOpen} onOpenChange={setCheckoutOpen} onSuccess={(code) => { setSuccessCode(code); setCheckoutOpen(false); }} />
      <SuccessDialog code={successCode} onClose={() => setSuccessCode(null)} />

      <footer className="max-w-5xl mx-auto px-4 py-6 text-center text-xs text-muted-foreground">
        <p>{settings.receipt_footer}</p>
      </footer>
    </div>
  );
}

function CheckoutDialog({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (v: boolean) => void; onSuccess: (code: string) => void }) {
  const cart = useCart();
  const settings = typeof window !== "undefined" ? loadSettings() : DEFAULT_SETTINGS;
  const { data: shipCfg } = useShippingSettings();
  const ship = (shipCfg as any) || DEFAULT_SHIPPING;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<"pickup" | "delivery">("pickup");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const shippingFee = calcShipping(cart.subtotal, method, ship);
  const total = cart.subtotal + shippingFee;

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim()) {
      toast.error("ກະລຸນາໃສ່ຊື່ ແລະ ເບີໂທ");
      return;
    }
    if (method === "delivery" && !address.trim()) {
      toast.error("ກະລຸນາໃສ່ທີ່ຢູ່ສຳລັບສົ່ງ");
      return;
    }
    if (cart.items.length === 0) return;
    setSubmitting(true);
    try {
      // 1. Create order first so we have an order_code prefix for the slip upload path.
      const { data: order, error: orderErr } = await supabase
        .from("shop_orders")
        .insert({
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          delivery_method: method,
          address: method === "delivery" ? address.trim() : null,
          note: note.trim() || null,
          subtotal: cart.subtotal,
          shipping_fee: shippingFee,
          total,
          slip_url: null,
        } as any)
        .select("id,order_code")
        .single();
      if (orderErr) throw orderErr;

      const itemsPayload = cart.items.map((i) => ({
        order_id: order.id,
        item_id: i.id,
        name_snapshot: i.name,
        unit_price: i.price,
        qty: i.qty,
        line_total: i.price * i.qty,
      }));
      const { error: itemsErr } = await supabase.from("shop_order_items").insert(itemsPayload);
      if (itemsErr) throw itemsErr;

      // 2. Upload slip under <order_code>/ so storage policy can validate it.
      let slipUrl: string | null = null;
      if (slipFile) {
        const ext = slipFile.name.split(".").pop() || "jpg";
        const path = `${order.order_code}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("payment-slips").upload(path, slipFile);
        if (upErr) throw upErr;
        slipUrl = path;
        await supabase.from("shop_orders").update({ slip_url: slipUrl } as any).eq("id", order.id);
      }

      if (slipUrl) {
        import("@/lib/slip-ocr.functions")
          .then(({ verifySlip }) => verifySlip({ data: { orderId: order.id } }))
          .catch(() => {});
      }

      clearCart();
      setName(""); setPhone(""); setAddress(""); setNote(""); setSlipFile(null); setMethod("pickup");
      onSuccess(order.order_code);
    } catch (e: any) {
      toast.error(e.message || "ບໍ່ສຳເລັດ, ກະລຸນາລອງໃໝ່");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>ສັ່ງຊື້ສິນຄ້າ</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-muted/50 rounded p-2 text-sm space-y-1">
            {cart.items.map((i) => (
              <div key={i.id} className="flex justify-between">
                <span className="truncate">{i.name} × {i.qty}</span>
                <span>{formatLAK(i.price * i.qty)}</span>
              </div>
            ))}
            <div className="flex justify-between text-muted-foreground border-t pt-1 mt-1">
              <span>ລວມສິນຄ້າ</span><span>{formatLAK(cart.subtotal)}</span>
            </div>
            {method === "delivery" && (
              <div className="flex justify-between text-muted-foreground">
                <span className="flex items-center gap-1"><Truck className="h-3 w-3" />ຄ່າສົ່ງ{shippingFee === 0 && ship.enabled ? " (ຟຣີ)" : ""}</span>
                <span>{formatLAK(shippingFee)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t pt-1">
              <span>ລວມຈ່າຍ</span><span className="text-primary">{formatLAK(total)}</span>
            </div>
            {method === "delivery" && shippingFee > 0 && ship.free_threshold > cart.subtotal && (
              <p className="text-[11px] text-muted-foreground">ຊື້ເພີ່ມ {formatLAK(ship.free_threshold - cart.subtotal)} ເພື່ອຮັບສ່ວນສົ່ງຟຣີ</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>ຊື່ *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ຊື່ ນາມສະກຸນ" />
          </div>
          <div className="space-y-1">
            <Label>ເບີໂທ *</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="020 XXXXXXXX" />
          </div>

          <div className="space-y-2">
            <Label>ການຮັບສິນຄ້າ</Label>
            <RadioGroup value={method} onValueChange={(v) => setMethod(v as any)}>
              <div className="flex items-center gap-2 border rounded p-2">
                <RadioGroupItem value="pickup" id="m-pickup" />
                <Label htmlFor="m-pickup" className="flex-1 cursor-pointer">ມາຮັບທີ່ຮ້ານ</Label>
              </div>
              <div className="flex items-center gap-2 border rounded p-2">
                <RadioGroupItem value="delivery" id="m-delivery" />
                <Label htmlFor="m-delivery" className="flex-1 cursor-pointer">ສົ່ງເດລີເວີຣີ່</Label>
              </div>
            </RadioGroup>
          </div>

          {method === "delivery" && (
            <div className="space-y-1">
              <Label>ທີ່ຢູ່ສຳລັບສົ່ງ *</Label>
              <Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="ບ້ານ, ເມືອງ, ແຂວງ" rows={2} />
            </div>
          )}

          <div className="space-y-1">
            <Label>ໝາຍເຫດ</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="ລາຍລະອຽດເພີ່ມ..." />
          </div>

          <div className="space-y-1 border-t pt-3">
            <Label>ສະລິບໂອນເງິນ (ບໍ່ບັງຄັບ)</Label>
            <p className="text-xs text-muted-foreground">
              ໂອນເງິນທີ່ເບີ {settings.shop_phone || "(ສອບຖາມຮ້ານ)"} ແລ້ວ ອັບໂຫລດສະລິບ
            </p>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded p-3 cursor-pointer hover:bg-muted/50">
              <Upload className="h-4 w-4" />
              <span className="text-sm">{slipFile ? slipFile.name : "ເລືອກຮູບສະລິບ"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setSlipFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>ຍົກເລີກ</Button>
          <Button onClick={handleSubmit} disabled={submitting}>{submitting ? "ກຳລັງສົ່ງ..." : "ຢືນຢັນສັ່ງຊື້"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SuccessDialog({ code, onClose }: { code: string | null; onClose: () => void }) {
  const settings = typeof window !== "undefined" ? loadSettings() : DEFAULT_SETTINGS;
  const phone = settings.shop_phone?.replace(/[^\d+]/g, "");
  const waLink = phone && code
    ? `https://wa.me/${phone.replace(/^\+/, "")}?text=${encodeURIComponent(`ສະບາຍດີ, ສັ່ງຊື້ເລກທີ ${code}`)}`
    : null;
  return (
    <Dialog open={!!code} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-5 w-5" />ສັ່ງຊື້ສຳເລັດ!
          </DialogTitle>
        </DialogHeader>
        <div className="text-center py-2 space-y-2">
          <p className="text-sm text-muted-foreground">ເລກທີໃບສັ່ງຊື້</p>
          <p className="text-2xl font-bold text-primary">{code}</p>
          <p className="text-sm">ຮ້ານຈະຕິດຕໍ່ກັບໄປຫາທ່ານໄວໆນີ້</p>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {code && (
            <Button asChild variant="secondary" className="w-full">
              <Link to="/track-order/$code" params={{ code }}>ຕິດຕາມສະຖານະໃບສັ່ງຊື້</Link>
            </Button>
          )}
          {waLink && (
            <Button asChild className="w-full bg-green-600 hover:bg-green-700">
              <a href={waLink} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4 mr-2" />ຕິດຕໍ່ຮ້ານຜ່ານ WhatsApp
              </a>
            </Button>
          )}
          <Button variant="outline" className="w-full" onClick={onClose}>ປິດ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
