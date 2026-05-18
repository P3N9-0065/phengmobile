import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Logo } from "@/components/Logo";
import {
  ArrowLeft, Upload, X, Smartphone, User, Wrench, Camera,
  PenLine, FileText, Search, UserPlus, Check, Eraser, Save,
} from "lucide-react";
import { toast } from "sonner";
import { formatLAK } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/repairs/new")({
  component: NewRepairPage,
});

const COMMON_BRANDS = ["iPhone", "Samsung", "Xiaomi", "Oppo", "Vivo", "Huawei", "Realme", "Nokia"];
const COMMON_PROBLEMS = [
  "ຈໍແຕກ", "ແບັດເຕີຣີເສື່ອມ", "ຊາກບໍ່ເຂົ້າ", "ເປີດບໍ່ຕິດ",
  "ກ້ອງເສຍ", "ລຳໂພງເສຍ", "ໄມ່ເສຍ", "ຕົກນ້ຳ",
  "ປຸ່ມເສຍ", "ສັນຍານອ່ອນ", "Touch ບໍ່ເຮັດວຽກ", "Wi-Fi/Bluetooth ເສຍ",
];
const COMMON_ACCESSORIES = ["ສາຍສາກ", "ຫົວສາກ", "ເຄ​ສ", "ຟິມ", "ຫູຟັງ", "ຊິມ", "MicroSD"];

type FieldErrors = Partial<Record<"customer" | "brand" | "model" | "problem" | "estimatedPrice" | "warrantyDays", string>>;

function NewRepairPage() {
  const navigate = useNavigate();
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showCreateCust, setShowCreateCust] = useState(false);

  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [imei, setImei] = useState("");
  const [color, setColor] = useState("");
  const [lockCode, setLockCode] = useState("");
  const [problem, setProblem] = useState("");
  const [problemTags, setProblemTags] = useState<string[]>([]);
  const [accessories, setAccessories] = useState<string[]>([]);
  const [estimatedPrice, setEstimatedPrice] = useState("");
  const [warrantyDays, setWarrantyDays] = useState("7");
  const [internalNotes, setInternalNotes] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  const { data: customerResults } = useQuery({
    queryKey: ["cust-search", customerSearch],
    queryFn: async () => {
      if (!customerSearch.trim()) return [];
      const { data } = await supabase
        .from("customers")
        .select("id, name, phone")
        .or(`name.ilike.%${customerSearch}%,phone.ilike.%${customerSearch}%`)
        .limit(8);
      return data ?? [];
    },
    enabled: customerSearch.trim().length > 0 && !selectedCustomer,
  });

  // Previous tickets of selected customer for quick-fill
  const { data: prevTickets } = useQuery({
    queryKey: ["cust-prev-tickets", selectedCustomer?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("repair_tickets")
        .select("device_brand, device_model, device_imei, device_color")
        .eq("customer_id", selectedCustomer.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
    enabled: !!selectedCustomer,
  });

  // Signature canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = "#0f172a";
    ctx.lineCap = "round";

    const getPos = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const point = "touches" in e ? e.touches[0] : (e as MouseEvent);
      return {
        x: (point.clientX - rect.left) * (canvas.width / rect.width),
        y: (point.clientY - rect.top) * (canvas.height / rect.height),
      };
    };
    const start = (e: any) => {
      e.preventDefault();
      drawingRef.current = true;
      const { x, y } = getPos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };
    const move = (e: any) => {
      if (!drawingRef.current) return;
      e.preventDefault();
      const { x, y } = getPos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
      setHasSignature(true);
    };
    const end = () => { drawingRef.current = false; };

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    canvas.addEventListener("mouseup", end);
    canvas.addEventListener("mouseleave", end);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end);

    return () => {
      canvas.removeEventListener("mousedown", start);
      canvas.removeEventListener("mousemove", move);
      canvas.removeEventListener("mouseup", end);
      canvas.removeEventListener("mouseleave", end);
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove", move);
      canvas.removeEventListener("touchend", end);
    };
  }, []);

  function clearSignature() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
        const { error } = await supabase.storage.from("repair-photos").upload(path, file);
        if (error) throw error;
        const { data } = supabase.storage.from("repair-photos").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      setPhotos((p) => [...p, ...urls]);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const createCustomer = useMutation({
    mutationFn: async ({ name, phone }: any) => {
      const { data, error } = await supabase.from("customers").insert({ name, phone }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (c) => { setSelectedCustomer(c); setShowCreateCust(false); toast.success("ສ້າງລູກຄ້າສຳເລັດ"); },
    onError: (e: any) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) throw new Error("ກະລຸນາເຂົ້າສູ່ລະບົບກ່ອນບັນທຶກ");

      let signatureUrl: string | null = null;
      const canvas = canvasRef.current;
      if (canvas && hasSignature) {
        try {
          const blob: Blob | null = await new Promise((res) =>
            canvas.toBlob((b) => res(b), "image/png"),
          );
          if (blob) {
            const path = `sig-${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
            const { error: upErr } = await supabase.storage.from("signatures").upload(path, blob);
            if (upErr) throw upErr;
            signatureUrl = supabase.storage.from("signatures").getPublicUrl(path).data.publicUrl;
          }
        } catch (e: any) {
          // Signature upload should not block the ticket
          toast.warning("ບັນທຶກລາຍເຊັນບໍ່ສຳເລັດ — ໃບສ້ອມຍັງຖືກບັນທຶກ");
          console.error("signature upload failed", e);
        }
      }

      const fullProblem = [problem.trim(), problemTags.length ? `[${problemTags.join(", ")}]` : ""]
        .filter(Boolean).join(" ").trim();
      const priceNum = estimatedPrice.trim() ? Number(estimatedPrice) : null;
      const warrantyNum = Number(warrantyDays || 7);

      const { data, error } = await supabase.from("repair_tickets").insert({
        customer_id: selectedCustomer.id,
        device_brand: brand.trim(),
        device_model: model.trim(),
        device_imei: imei.trim() || null,
        device_color: color.trim() || null,
        problem_description: fullProblem,
        lock_code: lockCode.trim() || null,
        accessories,
        estimated_price: priceNum,
        warranty_days: warrantyNum,
        internal_notes: internalNotes.trim() || null,
        photo_urls: photos,
        signature_url: signatureUrl,
        created_by: auth.user.id,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (t) => {
      toast.success(`ເປີດໃບສ້ອມ ${t.ticket_code} ສຳເລັດ`);
      navigate({ to: "/repairs/$id", params: { id: t.id } });
    },
    onError: (e: any) => toast.error(e?.message || "ບັນທຶກບໍ່ສຳເລັດ"),
  });

  function toggleTag(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  function validate(): FieldErrors {
    const errs: FieldErrors = {};
    if (!selectedCustomer) errs.customer = "ກະລຸນາເລືອກ ຫຼື ສ້າງລູກຄ້າ";
    if (!brand.trim()) errs.brand = "ກະລຸນາໃສ່ຍີ່ຫໍ້";
    else if (brand.trim().length > 60) errs.brand = "ຍີ່ຫໍ້ຍາວເກີນໄປ";
    if (!model.trim()) errs.model = "ກະລຸນາໃສ່ຮຸ່ນ";
    else if (model.trim().length > 80) errs.model = "ຮຸ່ນຍາວເກີນໄປ";
    if (!problem.trim() && problemTags.length === 0) errs.problem = "ກະລຸນາລະບຸອາການເສຍ";
    else if (problem.trim().length > 1000) errs.problem = "ລາຍລະອຽດຍາວເກີນ 1000 ຕົວອັກສອນ";
    if (estimatedPrice.trim()) {
      const n = Number(estimatedPrice);
      if (!Number.isFinite(n) || n < 0) errs.estimatedPrice = "ລາຄາບໍ່ຖືກຕ້ອງ";
      else if (n > 1_000_000_000) errs.estimatedPrice = "ລາຄາສູງເກີນໄປ";
    }
    const w = Number(warrantyDays);
    if (!Number.isFinite(w) || w < 0 || w > 365) errs.warrantyDays = "ປະກັນ 0–365 ມື້";
    return errs;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error(Object.values(errs)[0]!);
      return;
    }
    create.mutate();
  }

  const completion = useMemo(() => {
    let n = 0;
    if (selectedCustomer) n++;
    if (brand && model) n++;
    if (problem || problemTags.length) n++;
    if (photos.length) n++;
    if (hasSignature) n++;
    return Math.round((n / 5) * 100);
  }, [selectedCustomer, brand, model, problem, problemTags, photos, hasSignature]);

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white p-4 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/repairs">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/15 hover:text-white">
                <ArrowLeft className="h-4 w-4 mr-1" />ກັບຄືນ
              </Button>
            </Link>
            <div className="h-9 w-px bg-white/30" />
            <Logo className="h-9 w-9 rounded bg-white/95 p-1" />
            <div>
              <h1 className="text-lg font-bold leading-tight">ເປີດໃບສ້ອມໃໝ່</h1>
              <p className="text-xs text-emerald-50/90">ບັນທຶກຂໍ້ມູນເຄື່ອງລູກຄ້າເຂົ້າສ້ອມ</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <div className="text-right">
              <p className="text-[11px] uppercase text-emerald-100">ຄວາມຄືບໜ້າ</p>
              <p className="text-xl font-bold tabular-nums">{completion}%</p>
            </div>
            <div className="w-32 h-2 bg-white/25 rounded-full overflow-hidden">
              <div className="h-full bg-white transition-all" style={{ width: `${completion}%` }} />
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT — main form */}
        <div className="lg:col-span-2 space-y-4">
          {/* Customer */}
          <Card className="overflow-hidden">
            <SectionHeader icon={<User className="h-4 w-4" />} title="ຂໍ້ມູນລູກຄ້າ" step={1} done={!!selectedCustomer} />
            <CardContent className="space-y-3 pt-4">
              {selectedCustomer ? (
                <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-semibold">
                      {selectedCustomer.name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="font-medium text-emerald-900">{selectedCustomer.name}</p>
                      <p className="text-sm text-emerald-700">{selectedCustomer.phone}</p>
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedCustomer(null)}>
                    ປ່ຽນ
                  </Button>
                </div>
              ) : showCreateCust ? (
                <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                  <p className="text-sm font-medium">ສ້າງລູກຄ້າໃໝ່</p>
                  <Input id="new-cust-name" placeholder="ຊື່ລູກຄ້າ" maxLength={100} />
                  <Input id="new-cust-phone" placeholder="ເບີໂທ (ຕົວເລກເທົ່ານັ້ນ)" inputMode="tel" maxLength={20} />
                  <div className="flex gap-2">
                    <Button type="button" size="sm" disabled={createCustomer.isPending} onClick={() => {
                      const name = (document.getElementById("new-cust-name") as HTMLInputElement).value.trim();
                      const phone = (document.getElementById("new-cust-phone") as HTMLInputElement).value.trim();
                      if (!name) return toast.error("ກະລຸນາໃສ່ຊື່ລູກຄ້າ");
                      if (!phone) return toast.error("ກະລຸນາໃສ່ເບີໂທ");
                      if (!/^[+\d\s-]{6,20}$/.test(phone)) return toast.error("ເບີໂທບໍ່ຖືກຮູບແບບ");
                      createCustomer.mutate({ name, phone });
                    }}>{createCustomer.isPending ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ"}</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setShowCreateCust(false)}>ຍົກເລີກ</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="ຄົ້ນຫາລູກຄ້າດ້ວຍຊື່ ຫຼື ເບີໂທ..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {customerResults && customerResults.length > 0 && (
                    <div className="border rounded-lg divide-y bg-card overflow-hidden">
                      {customerResults.map((c) => (
                        <button key={c.id} type="button" className="w-full text-left p-3 hover:bg-accent text-sm transition-colors"
                          onClick={() => { setSelectedCustomer(c); setCustomerSearch(""); }}>
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.phone}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateCust(true)}>
                    <UserPlus className="h-4 w-4 mr-1" />ສ້າງລູກຄ້າໃໝ່
                  </Button>
                </>
              )}

              {selectedCustomer && prevTickets && prevTickets.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-2">ເຄື່ອງທີ່ເຄີຍສ້ອມ — ຄລິກເພື່ອເລືອກຂໍ້ມູນ</p>
                  <div className="flex flex-wrap gap-2">
                    {prevTickets.map((t, i) => (
                      <button key={i} type="button"
                        onClick={() => {
                          setBrand(t.device_brand);
                          setModel(t.device_model);
                          setImei(t.device_imei || "");
                          setColor(t.device_color || "");
                        }}
                        className="text-xs px-2.5 py-1 rounded border bg-muted hover:bg-accent transition-colors">
                        {t.device_brand} {t.device_model}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Device */}
          <Card>
            <SectionHeader icon={<Smartphone className="h-4 w-4" />} title="ຂໍ້ມູນເຄື່ອງ" step={2} done={!!(brand && model)} />
            <CardContent className="space-y-3 pt-4">
              <div>
                <Label className="text-xs text-muted-foreground">ເລືອກຍີ່ຫໍ້ດ່ວນ</Label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {COMMON_BRANDS.map((b) => (
                    <button key={b} type="button" onClick={() => setBrand(b)}
                      className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                        brand === b ? "bg-emerald-600 text-white border-emerald-600" : "bg-card hover:bg-accent"
                      }`}>{b}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>ຍີ່ຫໍ້ *</Label>
                  <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="iPhone, Samsung..." />
                </div>
                <div>
                  <Label>ຮຸ່ນ *</Label>
                  <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="13 Pro, A52..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>IMEI / Serial</Label><Input value={imei} onChange={(e) => setImei(e.target.value)} /></div>
                <div><Label>ສີ</Label><Input value={color} onChange={(e) => setColor(e.target.value)} /></div>
              </div>
              <div>
                <Label>ລະຫັດປົດລ໋ອກ / Pattern</Label>
                <Input value={lockCode} onChange={(e) => setLockCode(e.target.value)} placeholder="ຖ້າມີ ກະລຸນາລະບຸເພື່ອທົດສອບ" />
              </div>
            </CardContent>
          </Card>

          {/* Problem */}
          <Card>
            <SectionHeader icon={<Wrench className="h-4 w-4" />} title="ອາການເສຍ" step={3} done={!!(problem || problemTags.length)} />
            <CardContent className="space-y-3 pt-4">
              <div>
                <Label className="text-xs text-muted-foreground">ເລືອກອາການທີ່ພົບເຫັນ</Label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {COMMON_PROBLEMS.map((p) => {
                    const active = problemTags.includes(p);
                    return (
                      <button key={p} type="button" onClick={() => toggleTag(problemTags, setProblemTags, p)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1 ${
                          active ? "bg-violet-600 text-white border-violet-600" : "bg-card hover:bg-accent"
                        }`}>
                        {active && <Check className="h-3 w-3" />}{p}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label>ລາຍລະອຽດເພີ່ມເຕີມ</Label>
                <Textarea value={problem} onChange={(e) => setProblem(e.target.value)} rows={3}
                  placeholder="ອະທິບາຍອາການເສຍ, ສິ່ງທີ່ລູກຄ້າແຈ້ງ..." />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">ອຸປະກອນທີ່ຝາກໄວ້</Label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {COMMON_ACCESSORIES.map((a) => (
                    <label key={a} className={`text-xs px-2.5 py-1 rounded border cursor-pointer flex items-center gap-1.5 transition-colors ${
                      accessories.includes(a) ? "bg-amber-100 border-amber-400 text-amber-900" : "bg-card hover:bg-accent"
                    }`}>
                      <Checkbox checked={accessories.includes(a)}
                        onCheckedChange={() => toggleTag(accessories, setAccessories, a)}
                        className="h-3.5 w-3.5" />
                      {a}
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Photos */}
          <Card>
            <SectionHeader icon={<Camera className="h-4 w-4" />} title="ຮູບເຄື່ອງກ່ອນສ້ອມ" step={4} done={photos.length > 0} optional />
            <CardContent className="space-y-3 pt-4">
              <Label htmlFor="photos" className="cursor-pointer flex flex-col items-center justify-center gap-2 px-4 py-8 border-2 border-dashed rounded-lg hover:bg-accent/50 transition-colors">
                <Upload className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm font-medium">{uploading ? "ກຳລັງອັບໂຫຼດ..." : "ຄລິກເພື່ອເລືອກຮູບ ຫຼື ລາກວາງ"}</span>
                <span className="text-xs text-muted-foreground">ຮອງຮັບຫຼາຍຮູບ • JPG, PNG</span>
              </Label>
              <input id="photos" type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              {photos.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {photos.map((url, i) => (
                    <div key={i} className="relative group aspect-square">
                      <img src={url} alt="" className="w-full h-full object-cover rounded-lg border" />
                      <button type="button" onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                        className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Signature */}
          <Card>
            <SectionHeader icon={<PenLine className="h-4 w-4" />} title="ລາຍເຊັນລູກຄ້າ" step={5} done={hasSignature} optional />
            <CardContent className="space-y-2 pt-4">
              <div className="rounded-lg border-2 border-dashed bg-white">
                <canvas ref={canvasRef} width={800} height={200}
                  className="w-full h-[180px] touch-none cursor-crosshair rounded-lg" />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">ລູກຄ້າເຊັນຢືນຢັນເງື່ອນໄຂການຮັບສ້ອມ</p>
                <Button type="button" variant="outline" size="sm" onClick={clearSignature}>
                  <Eraser className="h-3.5 w-3.5 mr-1" />ລ້າງ
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT — sticky summary */}
        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <SectionHeader icon={<FileText className="h-4 w-4" />} title="ລາຄາ ແລະ ປະກັນ" />
            <CardContent className="space-y-3 pt-4">
              <div>
                <Label>ລາຄາປະເມີນ (₭)</Label>
                <Input value={estimatedPrice} onChange={(e) => setEstimatedPrice(e.target.value)}
                  type="number" placeholder="0" inputMode="numeric" />
                {estimatedPrice && (
                  <p className="text-xs text-muted-foreground mt-1">{formatLAK(Number(estimatedPrice))}</p>
                )}
              </div>
              <div>
                <Label>ປະກັນຫຼັງສ້ອມ (ມື້)</Label>
                <div className="flex gap-1.5 mt-1">
                  {["7", "15", "30", "60", "90"].map((d) => (
                    <button key={d} type="button" onClick={() => setWarrantyDays(d)}
                      className={`flex-1 text-xs px-2 py-1.5 rounded border transition-colors ${
                        warrantyDays === d ? "bg-emerald-600 text-white border-emerald-600" : "bg-card hover:bg-accent"
                      }`}>{d}</button>
                  ))}
                </div>
              </div>
              <div>
                <Label>ໝາຍເຫດພາຍໃນ (ສະເພາະຊ່າງ)</Label>
                <Textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)}
                  rows={2} placeholder="ຂໍ້ມູນສຳລັບທີມງານ" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardContent className="pt-4 space-y-2">
              <p className="text-xs font-semibold text-emerald-900 uppercase tracking-wide">ສະຫຼຸບກ່ອນບັນທຶກ</p>
              <SummaryRow label="ລູກຄ້າ" value={selectedCustomer?.name} />
              <SummaryRow label="ເຄື່ອງ" value={brand && model ? `${brand} ${model}` : null} />
              <SummaryRow label="ອາການ" value={problemTags.length ? problemTags.join(", ") : problem || null} />
              <SummaryRow label="ຮູບ" value={photos.length ? `${photos.length} ຮູບ` : null} />
              <SummaryRow label="ລາຍເຊັນ" value={hasSignature ? "ມີ" : null} />
              {estimatedPrice && (
                <div className="pt-2 mt-2 border-t border-emerald-200 flex justify-between text-sm">
                  <span className="font-medium">ປະເມີນ</span>
                  <span className="font-bold text-emerald-700">{formatLAK(Number(estimatedPrice))}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Button type="submit" size="lg" disabled={create.isPending}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white shadow-lg h-12 text-base">
            <Save className="h-5 w-5 mr-2" />
            {create.isPending ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ ແລະ ເປີດໃບສ້ອມ"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function SectionHeader({
  icon, title, step, done, optional,
}: { icon: React.ReactNode; title: string; step?: number; done?: boolean; optional?: boolean }) {
  return (
    <div className="flex items-center justify-between px-6 pt-5 pb-1">
      <div className="flex items-center gap-2">
        {step != null && (
          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
            done ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"
          }`}>
            {done ? <Check className="h-3.5 w-3.5" /> : step}
          </div>
        )}
        <div className="flex items-center gap-1.5 text-muted-foreground">{icon}</div>
        <h3 className="font-semibold">{title}</h3>
        {optional && <Badge variant="secondary" className="text-[10px] h-4">ບໍ່ບັງຄັບ</Badge>}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between text-xs gap-3">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`text-right truncate ${value ? "font-medium" : "text-muted-foreground/60 italic"}`}>
        {value || "ຍັງບໍ່ໄດ້ລະບຸ"}
      </span>
    </div>
  );
}
