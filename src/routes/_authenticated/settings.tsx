import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveSettings, usePosSettings, DEFAULT_SETTINGS, type PosSettings } from "@/lib/settings";
import { CURRENCY_LABEL } from "@/lib/currency";
import { Receipt } from "@/components/pos/Receipt";
import { toast } from "sonner";
import { Save, RotateCcw, Printer, Award, Undo2 } from "lucide-react";
import { Barcode } from "@/components/inventory/Barcode";
import { formatLAK } from "@/lib/format";
import { useLoyaltySettings, type LoyaltySettings } from "@/lib/loyalty";
import { useReturnPolicy, DEFAULT_RETURN_POLICY, type ReturnPolicy } from "@/lib/return-policy";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { History, Eye } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const BARCODE_FORMATS: { value: PosSettings["barcode_format"]; label: string; hint: string }[] = [
  { value: "CODE128", label: "CODE128", hint: "ໃຊ້ໄດ້ກັບທຸກຕົວອັກສອນ/ຕົວເລກ" },
  { value: "EAN13", label: "EAN-13", hint: "ຕ້ອງເປັນຕົວເລກ 13 ຫຼັກ (ສິນຄ້າຂາຍຍ່ອຍ)" },
  { value: "EAN8", label: "EAN-8", hint: "ຕົວເລກ 8 ຫຼັກ (ສິນຄ້າຂະໜາດນ້ອຍ)" },
  { value: "UPC", label: "UPC-A", hint: "ຕົວເລກ 12 ຫຼັກ (ມາດຕະຖານ US)" },
  { value: "CODE39", label: "CODE39", hint: "ຕົວເລກ + ຕົວອັກສອນໃຫຍ່" },
  { value: "ITF14", label: "ITF-14", hint: "ຕົວເລກ 14 ຫຼັກ (ກ່ອງ/ຫີບ)" },
];

const LABEL_PRESETS: { label: string; w: number; h: number }[] = [
  { label: "50×30 (ມາດຕະຖານ)", w: 50, h: 30 },
  { label: "40×20 (ນ້ອຍ)", w: 40, h: 20 },
  { label: "70×40 (ໃຫຍ່)", w: 70, h: 40 },
  { label: "100×50 (A6 ນ້ອຍ)", w: 100, h: 50 },
];

function sampleBarcodeValue(fmt: PosSettings["barcode_format"]): string {
  switch (fmt) {
    case "EAN13": return "5901234123457";
    case "EAN8":  return "96385074";
    case "UPC":   return "036000291452";
    case "CODE39":return "PHENG001";
    case "ITF14": return "12345678901231";
    default:      return "PM" + Date.now().toString().slice(-8);
  }
}

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

const SAMPLE = {
  sale_code: "SL260511XXXX",
  created_at: new Date().toISOString(),
  cashier_email: "cashier@pheng.la",
  customer_name: "ລູກຄ້າທົ່ວໄປ",
  items: [
    { name: "ຈໍ iPhone 13", qty: 1, unit_price: 1500000, line_total: 1500000 },
    { name: "ສາຍສາກ Type-C", qty: 2, unit_price: 50000, line_total: 100000 },
  ],
  subtotal: 1600000, discount: 0, total: 1600000,
  payment_method: "cash", currency_paid: "LAK" as const,
  exchange_rate: 1, amount_paid: 1700000, change_lak: 100000,
};

function SettingsPage() {
  const initial = usePosSettings();
  const [s, setS] = useState<PosSettings>(initial);
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const qc = useQueryClient();
  const { data: loyalty } = useLoyaltySettings();
  const [ly, setLy] = useState<LoyaltySettings | null>(null);
  useEffect(() => { if (loyalty) setLy(loyalty); }, [loyalty]);

  const saveLoyalty = useMutation({
    mutationFn: async (next: LoyaltySettings) => {
      const { error } = await supabase.from("loyalty_settings" as any).update({
        earn_rate_lak: next.earn_rate_lak,
        redeem_value_lak: next.redeem_value_lak,
        bronze_threshold: next.bronze_threshold,
        silver_threshold: next.silver_threshold,
        gold_threshold: next.gold_threshold,
        enabled: next.enabled,
        updated_at: new Date().toISOString(),
      }).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loyalty-settings"] });
      toast.success("ບັນທຶກລະບົບສະສົມແຕ້ມສຳເລັດ");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: retPol } = useReturnPolicy();
  const [rp, setRp] = useState<ReturnPolicy>(DEFAULT_RETURN_POLICY);
  useEffect(() => { if (retPol) setRp(retPol); }, [retPol]);
  const saveReturnPolicy = useMutation({
    mutationFn: async (next: ReturnPolicy) => {
      const { error } = await supabase.from("return_policy_settings" as any).update({
        max_days: next.max_days,
        block_redeemed: next.block_redeemed,
        block_discounted: next.block_discounted,
        block_phone: next.block_phone,
        require_reason: next.require_reason,
        updated_at: new Date().toISOString(),
      }).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["return-policy"] });
      toast.success("ບັນທຶກນະໂຍບາຍການຄືນສຳເລັດ");
    },
    onError: (e: any) => toast.error(e.message),
  });
  function updateRp<K extends keyof ReturnPolicy>(k: K, v: ReturnPolicy[K]) {
    setRp((p) => ({ ...p, [k]: v }));
  }
  function update<K extends keyof PosSettings>(k: K, v: PosSettings[K]) {
    setS((prev) => ({ ...prev, [k]: v }));
  }

  function updateLy<K extends keyof LoyaltySettings>(k: K, v: LoyaltySettings[K]) {
    setLy((p) => (p ? { ...p, [k]: v } : p));
  }
  function setRate(c: keyof PosSettings["rates"], v: number) {
    setS((prev) => ({ ...prev, rates: { ...prev.rates, [c]: v } }));
  }

  function handleSave() {
    saveSettings(s);
    toast.success("ບັນທຶກການຕັ້ງຄ່າສຳເລັດ");
  }
  function handleReset() {
    setS(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
    toast.success("ກັບຄືນຄ່າເລີ່ມຕົ້ນແລ້ວ");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ຕັ້ງຄ່າ POS</h1>
          <p className="text-muted-foreground text-sm">ຂໍ້ມູນຮ້ານ, ອັດຕາແລກປ່ຽນ ແລະ ເຄື່ອງພິມໃບເສັດ</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}><RotateCcw className="h-4 w-4 mr-2" />ຄ່າເລີ່ມຕົ້ນ</Button>
          <Button onClick={handleSave}><Save className="h-4 w-4 mr-2" />ບັນທຶກ</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>ຂໍ້ມູນຮ້ານ</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>ຊື່ຮ້ານ (ລາວ)</Label><Input value={s.shop_name} onChange={(e) => update("shop_name", e.target.value)} /></div>
                <div><Label>ຊື່ຮ້ານ (English)</Label><Input value={s.shop_name_en} onChange={(e) => update("shop_name_en", e.target.value)} /></div>
              </div>
              <div><Label>ທີ່ຢູ່</Label><Input value={s.shop_address} onChange={(e) => update("shop_address", e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>ເບີໂທ</Label><Input value={s.shop_phone} onChange={(e) => update("shop_phone", e.target.value)} /></div>
                <div><Label>ເລກປະຈຳຕົວຜູ້ເສຍພາສີ</Label><Input value={s.shop_tax_id} onChange={(e) => update("shop_tax_id", e.target.value)} /></div>
              </div>
              <div><Label>ຫົວໃບເສັດ (ຂໍ້ຄວາມເພີ່ມ)</Label><Textarea rows={2} value={s.receipt_header} onChange={(e) => update("receipt_header", e.target.value)} /></div>
              <div><Label>ທ້າຍໃບເສັດ</Label><Textarea rows={2} value={s.receipt_footer} onChange={(e) => update("receipt_footer", e.target.value)} /></div>
              <div className="flex items-center justify-between border rounded p-3">
                <div><p className="font-medium text-sm">ສະແດງໂລໂກ້ໃນໃບເສັດ</p><p className="text-xs text-muted-foreground">ພິມໂລໂກ້ຮ້ານຢູ່ຫົວໃບເສັດ</p></div>
                <Switch checked={s.show_logo} onCheckedChange={(v) => update("show_logo", v)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>ອັດຕາແລກປ່ຽນ (1 ໜ່ວຍ = ₭)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(Object.keys(s.rates) as (keyof PosSettings["rates"])[]).filter((c) => c !== "LAK").map((c) => (
                <div key={c} className="grid grid-cols-3 items-center gap-3">
                  <Label className="col-span-1">{CURRENCY_LABEL[c]}</Label>
                  <Input className="col-span-2" type="number" value={s.rates[c]} onChange={(e) => setRate(c, Number(e.target.value) || 0)} />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">ໃຊ້ໃນໜ້າ POS ເພື່ອຮັບເງິນຫຼາຍສະກຸນ ແລະ ຄິດເງິນທອນເປັນກີບ.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>ເຄື່ອງພິມໃບເສັດ</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>ຄວາມກວ້າງເຈ້ຍ</Label>
                <Select value={String(s.paper_width_mm)} onValueChange={(v) => update("paper_width_mm", Number(v) as 58 | 80)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="58">58 mm</SelectItem>
                    <SelectItem value="80">80 mm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>ຂະໜາດຕົວອັກສອນ ({s.font_size_px}px)</Label>
                <Input type="range" min={10} max={16} value={s.font_size_px} onChange={(e) => update("font_size_px", Number(e.target.value))} />
              </div>
              <p className="text-xs text-muted-foreground">ກົດ "ພິມຕົວຢ່າງ" ຢູ່ດ້ານຂວາ ເພື່ອທົດສອບກັບເຄື່ອງພິມຄວາມຮ້ອນ.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>ປ້າຍບາໂຄດສິນຄ້າ</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>ຮູບແບບບາໂຄດ</Label>
                <Select value={s.barcode_format} onValueChange={(v) => update("barcode_format", v as PosSettings["barcode_format"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BARCODE_FORMATS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label} — {f.hint}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>ຂະໜາດປ້າຍ (preset)</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {LABEL_PRESETS.map((p) => (
                    <Button
                      key={p.label} type="button" size="sm"
                      variant={s.label_width_mm === p.w && s.label_height_mm === p.h ? "default" : "outline"}
                      onClick={() => { update("label_width_mm", p.w); update("label_height_mm", p.h); }}
                    >{p.label}</Button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>ກວ້າງ (mm)</Label><Input type="number" min={20} max={210} value={s.label_width_mm} onChange={(e) => update("label_width_mm", Number(e.target.value) || 50)} /></div>
                <div><Label>ສູງ (mm)</Label><Input type="number" min={15} max={150} value={s.label_height_mm} onChange={(e) => update("label_height_mm", Number(e.target.value) || 30)} /></div>
                <div><Label>ສູງແທ່ງ (px)</Label><Input type="number" min={20} max={120} value={s.barcode_bar_height} onChange={(e) => update("barcode_bar_height", Number(e.target.value) || 40)} /></div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between border rounded p-2">
                  <span className="text-sm">ສະແດງຊື່ສິນຄ້າ</span>
                  <Switch checked={s.barcode_show_name} onCheckedChange={(v) => update("barcode_show_name", v)} />
                </div>
                <div className="flex items-center justify-between border rounded p-2">
                  <span className="text-sm">ສະແດງລາຄາ</span>
                  <Switch checked={s.barcode_show_price} onCheckedChange={(v) => update("barcode_show_price", v)} />
                </div>
                <div className="flex items-center justify-between border rounded p-2">
                  <span className="text-sm">ສະແດງຊື່ຮ້ານ</span>
                  <Switch checked={s.barcode_show_shop} onCheckedChange={(v) => update("barcode_show_shop", v)} />
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">ຕົວຢ່າງປ້າຍ</p>
                <div className="flex justify-center bg-muted/40 p-3 rounded">
                  <div
                    className="bg-white text-black border rounded-sm shadow-sm flex flex-col items-center justify-center px-2 py-1"
                    style={{ width: `${s.label_width_mm * 3.78}px`, height: `${s.label_height_mm * 3.78}px` }}
                  >
                    {s.barcode_show_shop && <div className="text-[9px] font-semibold truncate w-full text-center">{s.shop_name}</div>}
                    {s.barcode_show_name && <div className="text-[10px] font-medium truncate w-full text-center">ສິນຄ້າຕົວຢ່າງ</div>}
                    <Barcode value={sampleBarcodeValue(s.barcode_format)} format={s.barcode_format} height={s.barcode_bar_height} fontSize={10} />
                    {s.barcode_show_price && <div className="text-[10px] font-bold">{formatLAK(50000)}</div>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-600" />
                ລະບົບສະສົມແຕ້ມສະມາຊິກ
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!ly ? (
                <p className="text-sm text-muted-foreground">ກຳລັງໂຫຼດ...</p>
              ) : (
                <>
                  <div className="flex items-center justify-between border rounded p-3">
                    <div>
                      <p className="font-medium text-sm">ເປີດໃຊ້ລະບົບສະສົມແຕ້ມ</p>
                      <p className="text-xs text-muted-foreground">ປິດເພື່ອຢຸດການສະສົມ/ໃຊ້ແຕ້ມຊົ່ວຄາວ</p>
                    </div>
                    <Switch checked={ly.enabled} disabled={!isAdmin} onCheckedChange={(v) => updateLy("enabled", v)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>ສະສົມ 1 ແຕ້ມ ຕໍ່ (ກີບ)</Label>
                      <Input type="number" min={1} disabled={!isAdmin}
                        value={ly.earn_rate_lak}
                        onChange={(e) => updateLy("earn_rate_lak", Number(e.target.value) || 0)} />
                      <p className="text-[11px] text-muted-foreground mt-1">ຕົວຢ່າງ: 10,000 = ຊື້ 10,000 ກີບ ໄດ້ 1 ແຕ້ມ</p>
                    </div>
                    <div>
                      <Label>1 ແຕ້ມ = ສ່ວນຫຼຸດ (ກີບ)</Label>
                      <Input type="number" min={1} disabled={!isAdmin}
                        value={ly.redeem_value_lak}
                        onChange={(e) => updateLy("redeem_value_lak", Number(e.target.value) || 0)} />
                      <p className="text-[11px] text-muted-foreground mt-1">ຕົວຢ່າງ: 100 = 100 ແຕ້ມ ແລກ 10,000 ກີບ</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">ເກນລະດັບສະມາຊິກ (ແຕ້ມສະສົມ)</Label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div>
                        <Label className="text-xs text-amber-700">Bronze</Label>
                        <Input type="number" min={0} disabled={!isAdmin}
                          value={ly.bronze_threshold}
                          onChange={(e) => updateLy("bronze_threshold", Number(e.target.value) || 0)} />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-700">Silver</Label>
                        <Input type="number" min={0} disabled={!isAdmin}
                          value={ly.silver_threshold}
                          onChange={(e) => updateLy("silver_threshold", Number(e.target.value) || 0)} />
                      </div>
                      <div>
                        <Label className="text-xs text-yellow-700">Gold</Label>
                        <Input type="number" min={0} disabled={!isAdmin}
                          value={ly.gold_threshold}
                          onChange={(e) => updateLy("gold_threshold", Number(e.target.value) || 0)} />
                      </div>
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    disabled={!isAdmin || saveLoyalty.isPending}
                    onClick={() => ly && saveLoyalty.mutate(ly)}
                  >
                    <Save className="h-4 w-4 mr-2" />ບັນທຶກລະບົບສະມາຊິກ
                  </Button>
                  {!isAdmin && <p className="text-xs text-muted-foreground text-center">ສະເພາະ admin ປັບແກ້ໄດ້</p>}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Undo2 className="h-5 w-5 text-destructive" />
                ນະໂຍບາຍການຄືນສິນຄ້າ
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>ຈຳນວນວັນທີ່ອະນຸຍາດໃຫ້ຄືນ (ນັບຈາກວັນຂາຍ)</Label>
                <Input type="number" min={0} max={365} disabled={!isAdmin}
                  value={rp.max_days}
                  onChange={(e) => updateRp("max_days", Math.max(0, Number(e.target.value) || 0))} />
                <p className="text-[11px] text-muted-foreground mt-1">ໃສ່ 0 = ບໍ່ຈຳກັດເວລາ</p>
              </div>
              <div className="flex items-center justify-between border rounded p-3">
                <div>
                  <p className="font-medium text-sm">ບລັອກບິນທີ່ໃຊ້ແຕ້ມສະສົມ</p>
                  <p className="text-xs text-muted-foreground">ບໍ່ໃຫ້ຄືນ/ຍົກເລີກບິນທີ່ມີ points_redeemed &gt; 0</p>
                </div>
                <Switch checked={rp.block_redeemed} disabled={!isAdmin}
                  onCheckedChange={(v) => updateRp("block_redeemed", v)} />
              </div>
              <div className="flex items-center justify-between border rounded p-3">
                <div>
                  <p className="font-medium text-sm">ບລັອກບິນທີ່ມີສ່ວນຫຼຸດ</p>
                  <p className="text-xs text-muted-foreground">ບໍ່ໃຫ້ຄືນບິນທີ່ໃສ່ສ່ວນຫຼຸດ</p>
                </div>
                <Switch checked={rp.block_discounted} disabled={!isAdmin}
                  onCheckedChange={(v) => updateRp("block_discounted", v)} />
              </div>
              <div className="flex items-center justify-between border rounded p-3">
                <div>
                  <p className="font-medium text-sm">ບລັອກສິນຄ້າມືຖື</p>
                  <p className="text-xs text-muted-foreground">phone_new / phone_used ບໍ່ສາມາດຄືນໄດ້</p>
                </div>
                <Switch checked={rp.block_phone} disabled={!isAdmin}
                  onCheckedChange={(v) => updateRp("block_phone", v)} />
              </div>
              <div className="flex items-center justify-between border rounded p-3">
                <div>
                  <p className="font-medium text-sm">ບັງຄັບໃສ່ເຫດຜົນ</p>
                  <p className="text-xs text-muted-foreground">ຕ້ອງລະບຸເຫດຜົນທຸກຄັ້ງທີ່ຄືນ/ຍົກເລີກ</p>
                </div>
                <Switch checked={rp.require_reason} disabled={!isAdmin}
                  onCheckedChange={(v) => updateRp("require_reason", v)} />
              </div>
              <Button className="w-full"
                disabled={!isAdmin || saveReturnPolicy.isPending}
                onClick={() => saveReturnPolicy.mutate(rp)}>
                <Save className="h-4 w-4 mr-2" />ບັນທຶກນະໂຍບາຍການຄືນ
              </Button>
              {!isAdmin && <p className="text-xs text-muted-foreground text-center">ສະເພາະ admin ປັບແກ້ໄດ້</p>}
            </CardContent>
          </Card>

          {isAdmin && <ReturnPolicyAuditCard />}



          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>ຕົວຢ່າງໃບເສັດ</CardTitle>
              <Button variant="outline" size="sm" onClick={() => import("@/components/pos/Receipt").then((m) => m.printReceipt())}>
                <Printer className="h-4 w-4 mr-2" />ພິມຕົວຢ່າງ
              </Button>
            </CardHeader>
            <CardContent>
              <div className="border bg-muted/30 p-3 overflow-auto">
                <Receipt data={SAMPLE} settings={s} />
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}

const POLICY_FIELDS: { key: keyof ReturnPolicy; label: string }[] = [
  { key: "max_days", label: "ຈຳນວນວັນ" },
  { key: "block_redeemed", label: "ບລັອກບິນໃຊ້ແຕ້ມ" },
  { key: "block_discounted", label: "ບລັອກບິນສ່ວນຫຼຸດ" },
  { key: "block_phone", label: "ບລັອກມືຖື" },
  { key: "require_reason", label: "ບັງຄັບເຫດຜົນ" },
];

function fmtVal(v: any): string {
  if (typeof v === "boolean") return v ? "ເປີດ" : "ປິດ";
  if (v === null || v === undefined) return "—";
  return String(v);
}

function diffPolicy(oldV: any, newV: any): string[] {
  const out: string[] = [];
  for (const f of POLICY_FIELDS) {
    const a = oldV?.[f.key];
    const b = newV?.[f.key];
    if (a !== b) out.push(`${f.label}: ${fmtVal(a)} → ${fmtVal(b)}`);
  }
  return out;
}

function ReturnPolicyAuditCard() {
  const [detail, setDetail] = useState<any | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["return-policy-audit"],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("return_policy_audit" as any)
        .select("*")
        .order("changed_at", { ascending: false })
        .limit(50);
      const list = (rows ?? []) as any[];
      const ids = Array.from(new Set(list.map((r) => r.changed_by).filter(Boolean)));
      let names: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", ids);
        names = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name]));
      }
      return list.map((r) => ({ ...r, changer_name: r.changed_by ? names[r.changed_by] ?? "—" : "ລະບົບ" }));
    },
    staleTime: 30_000,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          ປະຫວັດການແກ້ໄຂນະໂຍບາຍການຄືນ
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">ກຳລັງໂຫຼດ...</p>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">ຍັງບໍ່ມີປະຫວັດການແກ້ໄຂ</p>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ເວລາ</TableHead>
                  <TableHead>ຜູ້ແກ້ໄຂ</TableHead>
                  <TableHead>ການປ່ຽນແປງ</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((r: any) => {
                  const changes = r.old_values ? diffPolicy(r.old_values, r.new_values) : ["ສ້າງນະໂຍບາຍເລີ່ມຕົ້ນ"];
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs whitespace-nowrap align-top">
                        {new Date(r.changed_at).toLocaleString("lo-LA")}
                      </TableCell>
                      <TableCell className="text-xs align-top">{r.changer_name}</TableCell>
                      <TableCell className="text-xs">
                        {changes.length === 0 ? (
                          <span className="text-muted-foreground">ບໍ່ມີການປ່ຽນແປງ</span>
                        ) : (
                          <ul className="space-y-0.5">
                            {changes.map((c, i) => <li key={i}>• {c}</li>)}
                          </ul>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDetail(r)}
                          className="h-7 px-2 text-xs"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          ລາຍລະອຽດ
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>ລາຍລະອຽດການແກ້ໄຂນະໂຍບາຍ</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">ເວລາ</div>
                  <div>{new Date(detail.changed_at).toLocaleString("lo-LA")}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">ຜູ້ແກ້ໄຂ</div>
                  <div>{detail.changer_name}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-muted-foreground text-xs">ປະເພດ</div>
                  <div>
                    {detail.old_values ? (
                      <Badge variant="secondary">ແກ້ໄຂ</Badge>
                    ) : (
                      <Badge>ສ້າງເລີ່ມຕົ້ນ</Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ຊ່ອງ</TableHead>
                      <TableHead>ຄ່າເກົ່າ</TableHead>
                      <TableHead>ຄ່າໃໝ່</TableHead>
                      <TableHead className="w-16">ປ່ຽນ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {POLICY_FIELDS.map((f) => {
                      const a = detail.old_values?.[f.key];
                      const b = detail.new_values?.[f.key];
                      const changed = detail.old_values && a !== b;
                      return (
                        <TableRow key={f.key} className={changed ? "bg-amber-50 dark:bg-amber-950/20" : ""}>
                          <TableCell className="text-xs font-medium">{f.label}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {detail.old_values ? fmtVal(a) : "—"}
                          </TableCell>
                          <TableCell className="text-xs font-medium">{fmtVal(b)}</TableCell>
                          <TableCell>
                            {changed ? <Badge variant="destructive" className="text-[10px]">✓</Badge> : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
