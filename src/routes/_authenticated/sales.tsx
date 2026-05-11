import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Printer, ReceiptText } from "lucide-react";
import { formatLAK, formatDateTime } from "@/lib/format";
import { PAYMENT_METHOD_LABEL, type Currency } from "@/lib/currency";
import { Receipt, printReceipt, type ReceiptData } from "@/components/pos/Receipt";

export const Route = createFileRoute("/_authenticated/sales")({
  component: SalesPage,
});

function SalesPage() {
  const [viewing, setViewing] = useState<ReceiptData | null>(null);

  const { data: sales } = useQuery({
    queryKey: ["sales-list"],
    queryFn: async () => {
      const { data } = await supabase.from("sales").select("*, customers(name), sale_items(*)")
        .order("created_at", { ascending: false }).limit(100);
      return data ?? [];
    },
  });

  function openReceipt(s: any) {
    setViewing({
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ບິນຂາຍ</h1>
        <p className="text-muted-foreground text-sm">ປະຫວັດການຂາຍຫຼ້າສຸດ</p>
      </div>

      <div className="space-y-2">
        {sales?.map((s: any) => (
          <Card key={s.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openReceipt(s)}>
            <CardContent className="pt-4 pb-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{s.sale_code}</p>
                  <Badge variant="outline">{PAYMENT_METHOD_LABEL[s.payment_method]}</Badge>
                  {s.currency_paid !== "LAK" && <Badge variant="secondary">{s.currency_paid}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {s.customers?.name ?? "ລູກຄ້າທົ່ວໄປ"} — {(s.sale_items ?? []).length} ລາຍການ
                </p>
                <p className="text-xs text-muted-foreground">{formatDateTime(s.created_at)}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-primary">{formatLAK(Number(s.total))}</p>
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

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>ໃບເສັດ</DialogTitle></DialogHeader>
          {viewing && <Receipt data={viewing} />}
          <DialogFooter>
            <Button onClick={printReceipt}><Printer className="h-4 w-4 mr-2" />ພິມ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
