import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Upload, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/repairs/new")({
  component: NewRepairPage,
});

function NewRepairPage() {
  const navigate = useNavigate();
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [showCreateCust, setShowCreateCust] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

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

  // Signature canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#000";
    ctx.lineCap = "round";

    const getPos = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const point = "touches" in e ? e.touches[0] : (e as MouseEvent);
      return { x: point.clientX - rect.left, y: point.clientY - rect.top };
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
    };
    const end = () => { drawingRef.current = false; };

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    canvas.addEventListener("mouseup", end);
    canvas.addEventListener("mouseleave", end);
    canvas.addEventListener("touchstart", start);
    canvas.addEventListener("touchmove", move);
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
    setSignature(null);
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
    mutationFn: async (form: any) => {
      let signatureUrl: string | null = null;
      const canvas = canvasRef.current;
      if (canvas) {
        const blank = document.createElement("canvas");
        blank.width = canvas.width; blank.height = canvas.height;
        if (canvas.toDataURL() !== blank.toDataURL()) {
          const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/png")!);
          const path = `sig-${Date.now()}.png`;
          const { error } = await supabase.storage.from("signatures").upload(path, blob);
          if (error) throw error;
          signatureUrl = supabase.storage.from("signatures").getPublicUrl(path).data.publicUrl;
        }
      }
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("repair_tickets").insert({
        ...form,
        photo_urls: photos,
        signature_url: signatureUrl,
        created_by: user?.id,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (t) => {
      toast.success(`ເປີດໃບສ້ອມ ${t.ticket_code} ສຳເລັດ`);
      navigate({ to: "/repairs/$id", params: { id: t.id } });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedCustomer) { toast.error("ກະລຸນາເລືອກລູກຄ້າ"); return; }
    const fd = new FormData(e.currentTarget);
    const accessoriesText = (fd.get("accessories") as string) || "";
    create.mutate({
      customer_id: selectedCustomer.id,
      device_brand: fd.get("device_brand"),
      device_model: fd.get("device_model"),
      device_imei: fd.get("device_imei") || null,
      device_color: fd.get("device_color") || null,
      problem_description: fd.get("problem_description"),
      lock_code: fd.get("lock_code") || null,
      accessories: accessoriesText.split(",").map((s) => s.trim()).filter(Boolean),
      estimated_price: fd.get("estimated_price") ? Number(fd.get("estimated_price")) : null,
      warranty_days: Number(fd.get("warranty_days") || 7),
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Link to="/repairs"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />ກັບຄືນ</Button></Link>
      <h1 className="text-2xl font-bold">ເປີດໃບສ້ອມໃໝ່</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader><CardTitle>ຂໍ້ມູນລູກຄ້າ</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {selectedCustomer ? (
              <div className="flex items-center justify-between p-3 border rounded">
                <div>
                  <p className="font-medium">{selectedCustomer.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedCustomer.phone}</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedCustomer(null)}>ປ່ຽນ</Button>
              </div>
            ) : showCreateCust ? (
              <div className="space-y-3 p-3 border rounded">
                <p className="text-sm font-medium">ສ້າງລູກຄ້າໃໝ່</p>
                <Input id="new-cust-name" placeholder="ຊື່ລູກຄ້າ" />
                <Input id="new-cust-phone" placeholder="ເບີໂທ" />
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={() => {
                    const name = (document.getElementById("new-cust-name") as HTMLInputElement).value;
                    const phone = (document.getElementById("new-cust-phone") as HTMLInputElement).value;
                    if (!name || !phone) return toast.error("ກະລຸນາໃສ່ຊື່ ແລະ ເບີໂທ");
                    createCustomer.mutate({ name, phone });
                  }}>ບັນທຶກ</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setShowCreateCust(false)}>ຍົກເລີກ</Button>
                </div>
              </div>
            ) : (
              <>
                <Input placeholder="ຄົ້ນຫາລູກຄ້າດ້ວຍຊື່ ຫຼື ເບີ..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
                {customerResults && customerResults.length > 0 && (
                  <div className="border rounded divide-y">
                    {customerResults.map((c) => (
                      <button key={c.id} type="button" className="w-full text-left p-2 hover:bg-accent text-sm"
                        onClick={() => { setSelectedCustomer(c); setCustomerSearch(""); }}>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.phone}</p>
                      </button>
                    ))}
                  </div>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateCust(true)}>+ ສ້າງລູກຄ້າໃໝ່</Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>ຂໍ້ມູນເຄື່ອງ</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>ຍີ່ຫໍ້ *</Label><Input name="device_brand" placeholder="iPhone, Samsung..." required /></div>
              <div><Label>ຮຸ່ນ *</Label><Input name="device_model" placeholder="13 Pro, A52..." required /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>IMEI / Serial</Label><Input name="device_imei" /></div>
              <div><Label>ສີ</Label><Input name="device_color" /></div>
            </div>
            <div><Label>ລະຫັດປົດລ໋ອກ</Label><Input name="lock_code" /></div>
            <div><Label>ອາການເສຍ *</Label><Textarea name="problem_description" rows={3} required /></div>
            <div><Label>ອຸປະກອນທີ່ຝາກ (ແຍກດ້ວຍຈຸດ ,)</Label><Input name="accessories" placeholder="ສາຍສາກ, ເຄ​ສ, ຫູຟັງ" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>ລາຄາປະເມີນ (₭)</Label><Input name="estimated_price" type="number" /></div>
              <div><Label>ປະກັນ (ມື້)</Label><Input name="warranty_days" type="number" defaultValue="7" /></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>ຮູບເຄື່ອງກ່ອນສ້ອມ</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="photos" className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border rounded hover:bg-accent">
              <Upload className="h-4 w-4" />{uploading ? "ກຳລັງອັບໂຫຼດ..." : "ເລືອກຮູບ"}
            </Label>
            <input id="photos" type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            {photos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {photos.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} alt="" className="w-full h-24 object-cover rounded" />
                    <button type="button" onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>ລາຍເຊັນລູກຄ້າ</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <canvas ref={canvasRef} width={500} height={150} className="border rounded bg-white touch-none w-full" />
            <Button type="button" variant="outline" size="sm" onClick={clearSignature}>ລ້າງລາຍເຊັນ</Button>
          </CardContent>
        </Card>

        <Button type="submit" size="lg" disabled={create.isPending} className="w-full">
          {create.isPending ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ ແລະ ເປີດໃບສ້ອມ"}
        </Button>
      </form>
    </div>
  );
}
