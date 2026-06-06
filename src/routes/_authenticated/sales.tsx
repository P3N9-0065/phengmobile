import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Printer, ReceiptText, Undo2, Ban } from "lucide-react";
import { toast } from "sonner";
import { formatLAK, formatDateTime } from "@/lib/format";
import { PAYMENT_METHOD_LABEL, type Currency } from "@/lib/currency";
import { Receipt, printReceipt, type ReceiptData } from "@/components/pos/Receipt";
import { useReturnPolicy, DEFAULT_RETURN_POLICY } from "@/lib/return-policy";

export const Route = createFileRoute("/_authenticated/sales")({
  component: SalesPage,
});

function SalesPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const { data: policy } = useReturnPolicy();
  const pol = policy ?? DEFAULT_RETURN_POLICY;
  const [viewing, setViewing] = useState<any | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);

  const { data: sales } = useQuery({
    queryKey: ["sales-list"],
    queryFn: async () => {
      const { data } = await supabase.from("sales").select("*, customers(name), sale_items(*)")
        .order("created_at", { ascending: false }).limit(100);
      return data ?? [];
    },
  });

  const { data: returns } = useQuery({
    queryKey: ["sale-returns", viewing?.id],
    enabled: !!viewing?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("sale_returns")
        .select("*, sale_return_items(*)")
        .eq("sale_id", viewing.id)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  function openSale(s: any) {
    setViewing(s);
    setReceipt({
      sale_code: s.sale_code, created_at: s.created_at,
      cashier_email: null, customer_name: s.customers?.name ?? null,
      items: (s.sale_items ?? []).map((it: any) => ({
        name: it.name_snapshot, qty: it.qty, unit_price: Number(it.unit_price), line_total: Number(it.line_total),
      })),
      subtotal: Number(s.subtotal), discount: Number(s.discount), total: Number(s.total),
      payment_method: s.payment_method, currency_paid: s.currency_paid as Currency,
      exchange_rate: Number(s.exchange_rate), amount_paid: Number(s.amount_paid), change_lak: Number(s.change_lak),
    });
  }

  function closeAll() {
    setViewing(null);
    setReceipt(null);
  }

  async function refreshAll() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["sales-list"] }),
      qc.invalidateQueries({ queryKey: ["sale-returns"] }),
      qc.invalidateQueries({ queryKey: ["inventory-items"] }),
    ]);
  }

  async function voidSale(reason: string, restock: boolean) {
    if (!viewing) return;
    const { error } = await supabase.rpc("void_sale", {
      _sale_id: viewing.id, _reason: reason || undefined, _restock: restock,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("ຍົກເລີກບິນແລ້ວ");
    await refreshAll();
    closeAll();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ບິນຂາຍ</h1>
        <p className="text-muted-foreground text-sm">ປະຫວັດການຂາຍຫຼ້າສຸດ</p>
      </div>

      <div className="space-y-2">
        {sales?.map((s: any) => (
          <Card key={s.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openSale(s)}>
            <CardContent className="pt-4 pb-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{s.sale_code}</p>
                  <Badge variant="outline">{PAYMENT_METHOD_LABEL[s.payment_method]}</Badge>
                  {s.currency_paid !== "LAK" && <Badge variant="secondary">{s.currency_paid}</Badge>}
                  {s.status === "voided" && <Badge variant="destructive">ຍົກເລີກ</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {s.customers?.name ?? "ລູກຄ້າທົ່ວໄປ"} — {(s.sale_items ?? []).length} ລາຍການ
                </p>
                <p className="text-xs text-muted-foreground">{formatDateTime(s.created_at)}</p>
              </div>
              <div className="text-right">
                <p className={`font-bold ${s.status === "voided" ? "text-muted-foreground line-through" : "text-primary"}`}>{formatLAK(Number(s.total))}</p>
                {Number(s.change_lak) > 0 && <p className="text-xs text-muted-foreground">ທອນ {formatLAK(Number(s.change_lak))}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
        {sales?.length === 0 && (
          <p className="text-center text-muted-foreground py-8 flex items-center justify-center gap-2">
            <ReceiptText className="h-4 w-4" /> ຍັງບໍ່ມີບິນຂາຍ
          </p>
        )}
      </div>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && closeAll()}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>ໃບເສັດ {viewing?.status === "voided" && <span className="text-destructive text-sm">(ຍົກເລີກແລ້ວ)</span>}</DialogTitle></DialogHeader>
          {receipt && <Receipt data={receipt} />}

          {(returns?.length ?? 0) > 0 && (
            <div className="border-t pt-3 space-y-2">
              <p className="text-sm font-semibold">ປະຫວັດການຄືນ</p>
              {returns!.map((r: any) => (
                <div key={r.id} className="rounded border p-2 text-xs space-y-1 bg-muted/40">
                  <div className="flex justify-between font-medium">
                    <span>{r.return_code} {r.kind === "void" && <Badge variant="destructive" className="ml-1">void</Badge>}</span>
                    <span>{formatLAK(Number(r.refund_amount))}</span>
                  </div>
                  <p className="text-muted-foreground">{formatDateTime(r.created_at)}</p>
                  {r.reason && <p>📝 {r.reason}</p>}
                  <ul className="pl-3 list-disc">
                    {(r.sale_return_items ?? []).map((it: any) => {
                      const si = (viewing?.sale_items ?? []).find((s: any) => s.id === it.sale_item_id);
                      return <li key={it.id}>{si?.name_snapshot ?? "—"} × {it.qty}</li>;
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {viewing && isAdmin && viewing.status !== "voided" && (() => {
            const ageDays = (Date.now() - new Date(viewing.created_at).getTime()) / 86400000;
            const expired = pol.max_days > 0 && ageDays > pol.max_days;
            const hasRedeem = pol.block_redeemed && Number(viewing.points_redeemed ?? 0) > 0;
            const hasDiscount = pol.block_discounted && Number(viewing.discount ?? 0) > 0;
            const blocked = expired || hasRedeem || hasDiscount;
            const reasons: string[] = [];
            if (expired) reasons.push(`ເກີນ ${pol.max_days} ວັນ`);
            if (hasRedeem) reasons.push("ໃຊ້ແຕ້ມສະສົມ");
            if (hasDiscount) reasons.push("ມີສ່ວນຫຼຸດ");
            return blocked ? (
              <p className="text-xs text-destructive border border-destructive/30 rounded p-2 bg-destructive/5">
                ບໍ່ສາມາດຄືນ/ຍົກເລີກບິນນີ້: {reasons.join(", ")}
              </p>
            ) : null;
          })()}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {viewing && isAdmin && viewing.status !== "voided" && (() => {
              const ageDays = (Date.now() - new Date(viewing.created_at).getTime()) / 86400000;
              const blocked =
                (pol.max_days > 0 && ageDays > pol.max_days) ||
                (pol.block_redeemed && Number(viewing.points_redeemed ?? 0) > 0) ||
                (pol.block_discounted && Number(viewing.discount ?? 0) > 0);
              if (blocked) return null;
              return (
                <>
                  <Button variant="outline" onClick={() => setReturnOpen(true)}>
                    <Undo2 className="h-4 w-4 mr-2" />ຄືນສິນຄ້າ
                  </Button>
                  <VoidSaleButton onConfirm={voidSale} requireReason={pol.require_reason} />
                </>
              );
            })()}
            <Button onClick={printReceipt}><Printer className="h-4 w-4 mr-2" />ພິມ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {viewing && (
        <ReturnItemsDialog
          open={returnOpen}
          onOpenChange={setReturnOpen}
          sale={viewing}
          existingReturns={returns ?? []}
          onDone={async () => { setReturnOpen(false); await refreshAll(); }}
        />
      )}
    </div>
  );
}

function VoidSaleButton({ onConfirm, requireReason = true }: { onConfirm: (reason: string, restock: boolean) => void | Promise<void>; requireReason?: boolean }) {
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(true);
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive"><Ban className="h-4 w-4 mr-2" />ຍົກເລີກບິນ</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>ຢືນຢັນຍົກເລີກບິນທັງໝົດ?</AlertDialogTitle>
          <AlertDialogDescription>
            ສິນຄ້າທີ່ຍັງບໍ່ໄດ້ຄືນຈະຖືກຄືນກັບ ແລະ ແຕ້ມສະສົມ/ໃຊ້ຈະຖືກປັບກັບສະພາບເດີມຕາມສ່ວນ.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3">
          <div>
            <Label>ເຫດຜົນ {requireReason && <span className="text-destructive">*</span>}</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ລະບຸເຫດຜົນຍົກເລີກ..." />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={restock} onCheckedChange={(v) => setRestock(!!v)} />
            ຄືນສິນຄ້າເຂົ້າສະຕ໋ອກ
          </label>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>ຍ້ອນກັບ</AlertDialogCancel>
          <AlertDialogAction
            disabled={requireReason && !reason.trim()}
            onClick={(e) => {
              if (requireReason && !reason.trim()) { e.preventDefault(); toast.error("ກະລຸນາລະບຸເຫດຜົນ"); return; }
              onConfirm(reason.trim(), restock);
            }}
          >ຍົກເລີກບິນ</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ReturnItemsDialog({
  open, onOpenChange, sale, existingReturns, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  sale: any;
  existingReturns: any[];
  onDone: () => void;
}) {
  const returnedMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of existingReturns) for (const it of (r.sale_return_items ?? [])) {
      m[it.sale_item_id] = (m[it.sale_item_id] ?? 0) + it.qty;
    }
    return m;
  }, [existingReturns]);

  const itemIds = useMemo(
    () => Array.from(new Set((sale.sale_items ?? []).map((si: any) => si.item_id).filter(Boolean))) as string[],
    [sale]
  );
  const { data: catRows } = useQuery({
    queryKey: ["sale-item-cats", sale.id],
    enabled: itemIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("inventory_items").select("id,category").in("id", itemIds);
      return data ?? [];
    },
  });
  const catMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of catRows ?? []) m[r.id] = r.category;
    return m;
  }, [catRows]);
  const isPhone = (si: any) => si.item_id && (catMap[si.item_id] === "phone_new" || catMap[si.item_id] === "phone_used");

  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const total = useMemo(() => {
    let t = 0;
    for (const si of (sale.sale_items ?? [])) {
      const q = qtys[si.id] ?? 0;
      t += q * Number(si.unit_price);
    }
    return t;
  }, [qtys, sale]);

  async function submit() {
    if (!reason.trim()) return toast.error("ກະລຸນາລະບຸເຫດຜົນ");
    const items = Object.entries(qtys)
      .filter(([, q]) => q > 0)
      .map(([sale_item_id, qty]) => ({ sale_item_id, qty }));
    if (items.length === 0) return toast.error("ກະລຸນາໃສ່ຈຳນວນທີ່ຈະຄືນ");
    setSubmitting(true);
    const { error } = await supabase.rpc("return_sale_items", {
      _sale_id: sale.id, _items: items, _reason: reason.trim(), _restock: restock,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("ບັນທຶກການຄືນແລ້ວ");
    setQtys({});
    setReason("");
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ຄືນສິນຄ້າບາງລາຍການ</DialogTitle>
          <DialogDescription>ບິນ {sale.sale_code}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {(sale.sale_items ?? []).map((si: any) => {
            const returned = returnedMap[si.id] ?? 0;
            const remaining = si.qty - returned;
            const q = qtys[si.id] ?? 0;
            const phone = isPhone(si);
            const disabled = remaining <= 0 || phone;
            return (
              <div key={si.id} className={`flex items-center gap-2 border rounded p-2 ${phone ? "opacity-60" : ""}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{si.name_snapshot}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatLAK(Number(si.unit_price))} × ຄ້າງ {remaining}/{si.qty}
                    {phone && <span className="text-destructive ml-2">ຄືນບໍ່ໄດ້ (ມືຖື)</span>}
                  </p>
                </div>
                <Input
                  type="number" min={0} max={remaining}
                  className="w-20" value={q || ""}
                  disabled={disabled}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(remaining, Number(e.target.value) || 0));
                    setQtys((p) => ({ ...p, [si.id]: v }));
                  }}
                />
              </div>
            );
          })}
        </div>

        <div className="space-y-2 pt-2 border-t">
          <Label>ເຫດຜົນ <span className="text-destructive">*</span></Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ລະບຸເຫດຜົນການຄືນ..." rows={2} />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={restock} onCheckedChange={(v) => setRestock(!!v)} />
            ຄືນສິນຄ້າເຂົ້າສະຕ໋ອກ
          </label>
          <div className="flex justify-between font-semibold pt-2">
            <span>ຍອດຄືນ:</span>
            <span className="text-primary">{formatLAK(total)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ຍົກເລີກ</Button>
          <Button onClick={submit} disabled={submitting || total <= 0 || !reason.trim()}>
            <Undo2 className="h-4 w-4 mr-2" />ບັນທຶກການຄືນ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
