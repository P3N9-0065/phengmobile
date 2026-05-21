import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Mail, Apple, Eye, EyeOff, Copy, Pencil, Trash2, Printer } from "lucide-react";
import { toast } from "sonner";
import { SignupSlip } from "@/components/account/SignupSlip";

export const Route = createFileRoute("/_authenticated/account-signups")({
  component: AccountSignupsPage,
});

type SignupType = "email" | "apple_id" | "google" | "other";

const TYPE_LABEL: Record<SignupType, string> = {
  email: "Email",
  apple_id: "Apple ID",
  google: "Google",
  other: "ອື່ນໆ",
};

type FormState = {
  customer_id: string;
  customer_name_snapshot: string;
  customer_phone_snapshot: string;
  account_type: SignupType;
  account_email: string;
  account_password: string;
  recovery_email: string;
  recovery_phone: string;
  birthdate: string;
  service_fee: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  customer_id: "", customer_name_snapshot: "", customer_phone_snapshot: "",
  account_type: "email", account_email: "", account_password: "",
  recovery_email: "", recovery_phone: "", birthdate: "",
  service_fee: "0", notes: "",
};

function AccountSignupsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPw, setShowPw] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [printing, setPrinting] = useState<any | null>(null);

  function printSignup(s: any) {
    setPrinting(s);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrinting(null), 500);
    }, 100);
  }

  const { data: customers } = useQuery({
    queryKey: ["customers-list-min"],
    queryFn: async () => {
      const { data } = await supabase
        .from("customers")
        .select("id,name,phone")
        .order("name")
        .limit(500);
      return data ?? [];
    },
  });

  const { data: signups, isLoading } = useQuery({
    queryKey: ["account-signups", search],
    queryFn: async () => {
      let q = supabase
        .from("account_signups")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (search.trim()) {
        q = q.or(
          `customer_name_snapshot.ilike.%${search}%,account_email.ilike.%${search}%,customer_phone_snapshot.ilike.%${search}%`,
        );
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  function buildPayload() {
    return {
      customer_id: form.customer_id || null,
      customer_name_snapshot: form.customer_name_snapshot.trim(),
      customer_phone_snapshot: form.customer_phone_snapshot.trim() || null,
      account_type: form.account_type,
      account_email: form.account_email.trim(),
      account_password: form.account_password || null,
      recovery_email: form.recovery_email.trim() || null,
      recovery_phone: form.recovery_phone.trim() || null,
      birthdate: form.birthdate || null,
      service_fee: Number(form.service_fee) || 0,
      notes: form.notes.trim() || null,
    };
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("ກະລຸນາເຂົ້າສູ່ລະບົບ");
      if (!form.customer_name_snapshot.trim()) throw new Error("ກະລຸນາໃສ່ຊື່ລູກຄ້າ");
      if (!form.account_email.trim()) throw new Error("ກະລຸນາໃສ່ອີເມວບັນຊີ");

      const payload = buildPayload();
      if (editingId) {
        const { error } = await supabase
          .from("account_signups")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("account_signups")
          .insert({ ...payload, created_by: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account-signups"] });
      toast.success(editingId ? "ແກ້ໄຂສຳເລັດ" : "ບັນທຶກສຳເລັດ");
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message ?? "ບັນທຶກບໍ່ສຳເລັດ"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("account_signups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account-signups"] });
      toast.success("ລົບສຳເລັດ");
    },
    onError: (e: any) => toast.error(e.message ?? "ລົບບໍ່ສຳເລັດ"),
  });

  function pickCustomer(id: string) {
    const c = customers?.find((x) => x.id === id);
    if (c) {
      setForm((f) => ({
        ...f,
        customer_id: c.id,
        customer_name_snapshot: c.name,
        customer_phone_snapshot: c.phone ?? "",
      }));
    }
  }

  function copy(text?: string | null) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success("ສຳເນົາແລ້ວ");
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(s: any) {
    setEditingId(s.id);
    setForm({
      customer_id: s.customer_id ?? "",
      customer_name_snapshot: s.customer_name_snapshot ?? "",
      customer_phone_snapshot: s.customer_phone_snapshot ?? "",
      account_type: s.account_type ?? "email",
      account_email: s.account_email ?? "",
      account_password: s.account_password ?? "",
      recovery_email: s.recovery_email ?? "",
      recovery_phone: s.recovery_phone ?? "",
      birthdate: s.birthdate ?? "",
      service_fee: String(s.service_fee ?? "0"),
      notes: s.notes ?? "",
    });
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ບັນຊີສະໝັກໃຫ້ລູກຄ້າ</h1>
          <p className="text-muted-foreground text-sm">ບັນທຶກ Email / Apple ID ທີ່ສະໝັກໃຫ້ລູກຄ້າ</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : closeDialog())}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />ເພີ່ມການສະໝັກ</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "ແກ້ໄຂບັນຊີສະໝັກ" : "ບັນທຶກບັນຊີສະໝັກໃໝ່"}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => { e.preventDefault(); if (!save.isPending) save.mutate(); }}
              className="space-y-3"
            >
              <div>
                <Label>ລູກຄ້າ (ເລືອກຈາກລາຍຊື່)</Label>
                <Select value={form.customer_id} onValueChange={pickCustomer}>
                  <SelectTrigger><SelectValue placeholder="ເລືອກລູກຄ້າ ຫຼື ໃສ່ຊື່ດ້ານລຸ່ມ" /></SelectTrigger>
                  <SelectContent>
                    {customers?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} — {c.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>ຊື່ລູກຄ້າ *</Label>
                  <Input
                    value={form.customer_name_snapshot}
                    onChange={(e) => setForm({ ...form, customer_name_snapshot: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>ເບີໂທ</Label>
                  <Input
                    value={form.customer_phone_snapshot}
                    onChange={(e) => setForm({ ...form, customer_phone_snapshot: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>ປະເພດບັນຊີ *</Label>
                  <Select
                    value={form.account_type}
                    onValueChange={(v) => setForm({ ...form, account_type: v as SignupType })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="apple_id">Apple ID</SelectItem>
                      <SelectItem value="google">Google</SelectItem>
                      <SelectItem value="other">ອື່ນໆ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>ຄ່າບໍລິການ (LAK)</Label>
                  <Input
                    type="number" min={0}
                    value={form.service_fee}
                    onChange={(e) => setForm({ ...form, service_fee: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>ອີເມວບັນຊີ *</Label>
                <Input
                  type="email"
                  value={form.account_email}
                  onChange={(e) => setForm({ ...form, account_email: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>ລະຫັດຜ່ານ</Label>
                <Input
                  value={form.account_password}
                  onChange={(e) => setForm({ ...form, account_password: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>ອີເມວກູ້ຄືນ</Label>
                  <Input
                    type="email"
                    value={form.recovery_email}
                    onChange={(e) => setForm({ ...form, recovery_email: e.target.value })}
                  />
                </div>
                <div>
                  <Label>ເບີກູ້ຄືນ</Label>
                  <Input
                    value={form.recovery_phone}
                    onChange={(e) => setForm({ ...form, recovery_phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>ວັນເດືອນປີເກີດ</Label>
                <Input
                  type="date"
                  value={form.birthdate}
                  onChange={(e) => setForm({ ...form, birthdate: e.target.value })}
                />
              </div>

              <div>
                <Label>ໝາຍເຫດ</Label>
                <Textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>ຍົກເລີກ</Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? "ກຳລັງບັນທຶກ..." : editingId ? "ບັນທຶກການແກ້ໄຂ" : "ບັນທຶກ"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="ຄົ້ນຫາຊື່ລູກຄ້າ, ອີເມວ, ເບີໂທ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {isLoading && <p className="text-muted-foreground col-span-full">ກຳລັງໂຫຼດ...</p>}
        {signups?.map((s: any) => {
          const Icon = s.account_type === "apple_id" ? Apple : Mail;
          return (
            <Card key={s.id}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{s.customer_name_snapshot}</p>
                      <p className="text-xs text-muted-foreground truncate">{s.customer_phone_snapshot ?? "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant="secondary">{TYPE_LABEL[s.account_type as SignupType]}</Badge>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => printSignup(s)} title="ພິມໃບໃຫ້ລູກຄ້າ">
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(s)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>ຢືນຢັນການລົບ</AlertDialogTitle>
                          <AlertDialogDescription>
                            ຕ້ອງການລົບບັນຊີຂອງ {s.customer_name_snapshot} ບໍ່? ການກະທຳນີ້ບໍ່ສາມາດກູ້ຄືນໄດ້.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>ຍົກເລີກ</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove.mutate(s.id)}>ລົບ</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                <div className="text-sm space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">ອີເມວ:</span>
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="truncate">{s.account_email}</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copy(s.account_email)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {s.account_password && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">ລະຫັດ:</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono">
                          {showPw[s.id] ? s.account_password : "••••••••"}
                        </span>
                        <Button size="icon" variant="ghost" className="h-6 w-6"
                          onClick={() => setShowPw((p) => ({ ...p, [s.id]: !p[s.id] }))}>
                          {showPw[s.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copy(s.account_password)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                  {s.recovery_email && (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">ກູ້ຄືນ:</span>
                      <span className="truncate">{s.recovery_email}</span>
                    </div>
                  )}
                  {s.recovery_phone && (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">ເບີກູ້ຄືນ:</span>
                      <span>{s.recovery_phone}</span>
                    </div>
                  )}
                  {s.birthdate && (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">ວັນເກີດ:</span>
                      <span>{s.birthdate}</span>
                    </div>
                  )}
                  {Number(s.service_fee) > 0 && (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">ຄ່າບໍລິການ:</span>
                      <span>{Number(s.service_fee).toLocaleString()} LAK</span>
                    </div>
                  )}
                  {s.notes && (
                    <p className="text-xs text-muted-foreground pt-1 border-t">{s.notes}</p>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(s.created_at).toLocaleString("lo-LA")}
                </p>
              </CardContent>
            </Card>
          );
        })}
        {!isLoading && signups?.length === 0 && (
          <p className="text-center text-muted-foreground col-span-full py-8">ຍັງບໍ່ມີຂໍ້ມູນ</p>
        )}
      </div>
      {printing && <SignupSlip signup={printing} />}
    </div>
  );
}
