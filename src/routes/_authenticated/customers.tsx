import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Phone, User, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/customers")({
  component: CustomersPage,
});

function CustomersPage() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<any>(null);
  const qc = useQueryClient();

  const { data: customers } = useQuery({
    queryKey: ["customers", search],
    queryFn: async () => {
      let q = supabase.from("customers").select("*").order("created_at", { ascending: false }).limit(200);
      if (search.trim()) q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async (form: any) => {
      const { error } = await supabase.from("customers").insert(form);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success("ບັນທຶກລູກຄ້າສຳເລັດ");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("customers").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success("ອັບເດດຂໍ້ມູນລູກຄ້າສຳເລັດ");
      setEditCustomer(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    create.mutate({
      name: fd.get("name"),
      phone: fd.get("phone"),
      email: fd.get("email") || null,
      address: fd.get("address") || null,
    });
  }

  function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editCustomer) return;
    const fd = new FormData(e.currentTarget);
    update.mutate({
      id: editCustomer.id,
      patch: {
        name: String(fd.get("name") || "").trim(),
        phone: String(fd.get("phone") || "").trim(),
        email: (fd.get("email") as string)?.trim() || null,
        address: (fd.get("address") as string)?.trim() || null,
      },
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ລູກຄ້າ</h1>
          <p className="text-muted-foreground text-sm">ຈັດການຂໍ້ມູນລູກຄ້າ</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />ເພີ່ມລູກຄ້າ</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>ເພີ່ມລູກຄ້າໃໝ່</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div><Label>ຊື່ລູກຄ້າ *</Label><Input name="name" required /></div>
              <div><Label>ເບີໂທ *</Label><Input name="phone" required /></div>
              <div><Label>ອີເມວ</Label><Input name="email" type="email" /></div>
              <div><Label>ທີ່ຢູ່</Label><Textarea name="address" rows={2} /></div>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending}>ບັນທຶກ</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="ຄົ້ນຫາດ້ວຍຊື່ ຫຼື ເບີໂທ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {customers?.map((c) => (
          <Card key={c.id} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <Link to="/customers/$id" params={{ id: c.id }} className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Phone className="h-3 w-3" />{c.phone}
                    </p>
                    {c.points > 0 && (
                      <p className="text-xs text-amber-600 mt-1">{c.points} ແຕ້ມ</p>
                    )}
                  </div>
                </Link>
                <Button
                  size="icon"
                  variant="ghost"
                  className="shrink-0"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setEditCustomer(c);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {customers?.length === 0 && (
          <p className="text-center text-muted-foreground col-span-full py-8">ບໍ່ພົບລູກຄ້າ</p>
        )}
      </div>

      <Dialog open={!!editCustomer} onOpenChange={(v) => !v && setEditCustomer(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>ແກ້ໄຂຂໍ້ມູນລູກຄ້າ</DialogTitle></DialogHeader>
          {editCustomer && (
            <form onSubmit={handleEditSubmit} className="space-y-3">
              <div><Label>ຊື່ລູກຄ້າ *</Label><Input name="name" defaultValue={editCustomer.name ?? ""} required /></div>
              <div><Label>ເບີໂທ *</Label><Input name="phone" defaultValue={editCustomer.phone ?? ""} required /></div>
              <div><Label>ອີເມວ</Label><Input name="email" type="email" defaultValue={editCustomer.email ?? ""} /></div>
              <div><Label>ທີ່ຢູ່</Label><Textarea name="address" rows={2} defaultValue={editCustomer.address ?? ""} /></div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditCustomer(null)}>ຍົກເລີກ</Button>
                <Button type="submit" disabled={update.isPending}>ບັນທຶກ</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
