import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package as PackageIcon, Search, MessageCircle, Phone, Store } from "lucide-react";
import { formatLAK } from "@/lib/format";
import { CATEGORY_LABEL, type ItemCategory } from "@/lib/lao";
import { DEFAULT_SETTINGS, loadSettings } from "@/lib/settings";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "ສິນຄ້າຮ້ານເພັງ ໂມບາຍ" },
      { name: "description", content: "ມືຖື ອຸປະກອນເສີມ ແລະ ອາໄຫຼ່ ລາຄາພິເສດ" },
      { property: "og:title", content: "ສິນຄ້າຮ້ານເພັງ ໂມບາຍ" },
      { property: "og:description", content: "ມືຖື ອຸປະກອນເສີມ ແລະ ອາໄຫຼ່ ລາຄາພິເສດ" },
    ],
  }),
  component: ShopPage,
});

const CATS: (ItemCategory | "all")[] = ["all", "phone_new", "phone_used", "accessory", "part", "tool"];

function ShopPage() {
  const settings = typeof window !== "undefined" ? loadSettings() : DEFAULT_SETTINGS;
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<ItemCategory | "all">("all");

  const { data: items, isLoading } = useQuery({
    queryKey: ["shop-featured"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id,name,category,sell_price,stock_qty,image_url,description")
        .eq("is_featured", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
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
  const waLink = phone
    ? `https://wa.me/${phone.replace(/^\+/, "")}?text=${encodeURIComponent("ສະບາຍດີ, ສົນໃຈສິນຄ້າຂອງຮ້ານ")}`
    : null;

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
            <Button size="sm" variant="outline" asChild>
              <a href={`tel:${phone}`}><Phone className="h-4 w-4 mr-1" />{settings.shop_phone}</a>
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ຄົ້ນຫາສິນຄ້າ..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATS.map((c) => (
            <Button
              key={c}
              size="sm"
              variant={cat === c ? "default" : "outline"}
              onClick={() => setCat(c)}
              className="shrink-0"
            >
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
            const waItem = phone
              ? `https://wa.me/${phone.replace(/^\+/, "")}?text=${encodeURIComponent(`ສະບາຍດີ, ສົນໃຈ "${item.name}" ລາຄາ ${formatLAK(Number(item.sell_price))}`)}`
              : null;
            return (
              <Card key={item.id} className="overflow-hidden flex flex-col">
                <div className="aspect-square bg-muted relative">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <PackageIcon className="h-10 w-10 text-muted-foreground" />
                    </div>
                  )}
                  {soldOut && (
                    <Badge variant="destructive" className="absolute top-2 right-2">ໝົດ</Badge>
                  )}
                </div>
                <CardContent className="p-3 flex-1 flex flex-col gap-2">
                  <div className="flex-1">
                    <p className="font-medium text-sm line-clamp-2">{item.name}</p>
                    <Badge variant="secondary" className="mt-1 text-[10px]">{CATEGORY_LABEL[item.category]}</Badge>
                  </div>
                  <p className="text-primary font-bold">{formatLAK(Number(item.sell_price))}</p>
                  {waItem && (
                    <Button size="sm" className="w-full bg-green-600 hover:bg-green-700" asChild disabled={soldOut}>
                      <a href={waItem} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="h-3.5 w-3.5 mr-1" />ສອບຖາມ
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>

      <footer className="max-w-5xl mx-auto px-4 py-6 text-center text-xs text-muted-foreground">
        {waLink && (
          <Button asChild className="bg-green-600 hover:bg-green-700 mb-3">
            <a href={waLink} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4 mr-2" />ຕິດຕໍ່ຜ່ານ WhatsApp
            </a>
          </Button>
        )}
        <p>{settings.receipt_footer}</p>
      </footer>
    </div>
  );
}
