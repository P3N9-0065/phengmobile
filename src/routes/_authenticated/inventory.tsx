import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, AlertTriangle, Package as PackageIcon } from "lucide-react";
import { toast } from "sonner";
import { CATEGORY_LABEL, type ItemCategory } from "@/lib/lao";
import { formatLAK } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/inventory")({
  component: InventoryPage,
});

const CATEGORIES: ItemCategory[] = ["part", "accessory", "tool", "phone_new", "phone_used"];

function InventoryPage() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<any>(null);
  const qc = useQueryClient();

  const { data: items } = useQuery({
    queryKey: ["inventory", search],
    queryFn: async () => {
      let q = supabase.from("inventory_items").select("*").order("name").limit(500);
      if (search.trim()) q = q.ilike("name", `%${search}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async (form: any) => {
      const { error } = await supabase.from("inventory_items").insert(form);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("ເພີ່ມສິນຄ້າສຳເລັດ");
      setOpen(false);
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

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    create.mutate({
      name: fd.get("name"),
      sku: fd.get("sku") || null,
      category: fd.get("category"),
      cost_price: Number(fd.get("cost_price") || 0),
      sell_price: Number(fd.get("sell_price") || 0),
      stock_qty: Number(fd.get("stock_qty") || 0),
      low_stock_threshold: Number(fd.get("low_stock_threshold") || 5),
    });
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />ເພີ່ມສິນຄ້າ</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>ເພີ່ມສິນຄ້າໃໝ່</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3">
              <div><Label>ຊື່ສິນຄ້າ *</Label><Input name="name" required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>ລະຫັດ SKU</Label><Input name="sku" /></div>
                <div>
                  <Label>ໝວດ *</Label>
                  <Select name="category" defaultValue="part">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>ລາຄາທຶນ (₭)</Label><Input name="cost_price" type="number" defaultValue="0" /></div>
                <div><Label>ລາຄາຂາຍ (₭)</Label><Input name="sell_price" type="number" defaultValue="0" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>ຈຳນວນເລີ່ມຕົ້ນ</Label><Input name="stock_qty" type="number" defaultValue="0" /></div>
                <div><Label>ແຈ້ງເຕືອນເມື່ອເຫຼືອ</Label><Input name="low_stock_threshold" type="number" defaultValue="5" /></div>
              </div>
              <DialogFooter><Button type="submit">ບັນທຶກ</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="ຄົ້ນຫາສິນຄ້າ..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {items?.map((item) => {
          const low = item.stock_qty <= item.low_stock_threshold;
          return (
            <Card key={item.id} className={low ? "border-amber-300" : ""}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.name}</p>
                    <Badge variant="secondary" className="mt-1 text-xs">{CATEGORY_LABEL[item.category]}</Badge>
                    {item.sku && <p className="text-xs text-muted-foreground mt-1">{item.sku}</p>}
                  </div>
                  <PackageIcon className="h-5 w-5 text-muted-foreground" />
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
    </div>
  );
}
