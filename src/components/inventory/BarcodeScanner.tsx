import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Camera, X, CheckCircle, AlertTriangle, Repeat } from "lucide-react";
import { BrowserMultiFormatReader } from "@zxing/browser";

const SCAN_COOLDOWN_MS = 1500;
const CONTINUOUS_COOLDOWN_MS = 900;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onScan: (code: string) => void;
  title?: string;
  /** เริ่มเปิดในโหมดสแกนต่อเนื่อง (ผู้ใช้สลับโหมดในกล่องได้) */
  continuous?: boolean;
};

export function BarcodeScanner({ open, onOpenChange, onScan, title = "ສະແກນບາໂຄດ", continuous: continuousInit = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [continuous, setContinuous] = useState(continuousInit);
  const [history, setHistory] = useState<string[]>([]);
  const cooldownRef = useRef(false);
  const continuousRef = useRef(continuous);

  useEffect(() => { continuousRef.current = continuous; }, [continuous]);

  useEffect(() => {
    if (open) {
      setContinuous(continuousInit);
      setHistory([]);
    }
  }, [open, continuousInit]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setLastScan(null);
    setStarting(true);
    const reader = new BrowserMultiFormatReader();

    (async () => {
      try {
        if (typeof window !== "undefined" && !window.isSecureContext) {
          throw new Error("ຕ້ອງເປີດຜ່ານ HTTPS ຈຶ່ງຈະໃຊ້ກ້ອງໄດ້");
        }
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("ບຣາວເຊີນີ້ບໍ່ຮອງຮັບກ້ອງ (mediaDevices ບໍ່ມີ)");
        }

        const probeStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        probeStream.getTracks().forEach((t) => t.stop());
        if (cancelled) return;

        const list = await BrowserMultiFormatReader.listVideoInputDevices();
        if (cancelled) return;
        setDevices(list);

        const preferred =
          deviceId ??
          list.find((d) => /back|rear|environment/i.test(d.label))?.deviceId ??
          list[0]?.deviceId;
        if (!preferred) {
          throw new Error("ບໍ່ພົບກ້ອງ");
        }
        if (!deviceId) setDeviceId(preferred);

        if (!videoRef.current) {
          throw new Error("video element ບໍ່ພ້ອມ");
        }

        const controls = await reader.decodeFromVideoDevice(preferred, videoRef.current, (result) => {
          if (!result || cooldownRef.current) return;
          const text = result.getText().trim();
          if (!text) return;

          const isContinuous = continuousRef.current;
          cooldownRef.current = true;
          setLastScan(text);
          onScan(text);

          if (isContinuous) {
            setHistory((h) => [text, ...h.filter((x) => x !== text)].slice(0, 6));
            try {
              if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(30);
            } catch { /* ignore */ }
          }

          setTimeout(() => {
            cooldownRef.current = false;
            // ในโหมดต่อเนื่อง — เคลียร์ overlay ไวๆ พร้อมสแกนตัวถัดไป
            if (continuousRef.current) setLastScan(null);
          }, isContinuous ? CONTINUOUS_COOLDOWN_MS : SCAN_COOLDOWN_MS);
        });
        if (cancelled) {
          try { controls.stop(); } catch { /* ignore */ }
          return;
        }
        controlsRef.current = controls;
      } catch (e: any) {
        if (cancelled) return;
        const name = e?.name;
        let msg = e?.message ?? "ບໍ່ສາມາດເປີດກ້ອງໄດ້";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          msg = "ບໍ່ໄດ້ຮັບອະນຸຍາດໃຫ້ໃຊ້ກ້ອງ — ກະລຸນາອະນຸຍາດໃນຕັ້ງຄ່າບຣາວເຊີ";
        } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
          msg = "ບໍ່ພົບກ້ອງໃນອຸປະກອນນີ້";
        } else if (name === "NotReadableError" || name === "TrackStartError") {
          msg = "ກ້ອງຖືກໃຊ້ໂດຍແອັບອື່ນຢູ່";
        } else if (name === "OverconstrainedError") {
          msg = "ກ້ອງບໍ່ຮອງຮັບການຕັ້ງຄ່າທີ່ຮ້ອງຂໍ";
        }
        setError(msg);
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
      try {
        controlsRef.current?.stop();
      } catch {
        /* ignore */
      }
      controlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deviceId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            {title}
            {continuous && (
              <Badge className="ml-1 bg-emerald-600 hover:bg-emerald-600 text-white gap-1">
                <Repeat className="h-3 w-3" />ຕໍ່ເນື່ອງ
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-md border bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-2">
            <Repeat className="h-4 w-4 text-emerald-600" />
            <Label htmlFor="continuous-scan" className="text-sm cursor-pointer">
              ໂໝດສະແກນຕໍ່ເນື່ອງ
            </Label>
          </div>
          <Switch id="continuous-scan" checked={continuous} onCheckedChange={setContinuous} />
        </div>

        <div className="relative bg-black rounded-md overflow-hidden aspect-[4/3]">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay />
          <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 h-0.5 bg-red-500/80 shadow-[0_0_8px_rgba(255,0,0,0.6)]" />
          <div className="absolute inset-4 border-2 border-white/40 rounded-md pointer-events-none" />
          {starting && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm">
              ກຳລັງເປີດກ້ອງ...
            </div>
          )}
          {continuous && (
            <div className="absolute top-2 left-2 bg-emerald-600 text-white text-xs font-semibold px-2 py-1 rounded-md shadow">
              ສະແກນແລ້ວ {history.length}
            </div>
          )}
          {lastScan && (
            <div className={
              continuous
                ? "absolute bottom-2 right-2 bg-emerald-600/90 text-white px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-semibold animate-in fade-in duration-150"
                : "absolute inset-2 bg-emerald-600/60 rounded-md flex items-center justify-center animate-in fade-in duration-200"
            }>
              {continuous ? (
                <><CheckCircle className="h-4 w-4" />{lastScan}</>
              ) : (
                <div className="text-white flex items-center gap-2 text-lg font-bold">
                  <CheckCircle className="h-6 w-6" />
                  {lastScan}
                </div>
              )}
            </div>
          )}
        </div>
        {error && (
          <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded-md">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {devices.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {devices.map((d) => (
              <Button
                key={d.deviceId}
                size="sm"
                variant={d.deviceId === deviceId ? "default" : "outline"}
                onClick={() => setDeviceId(d.deviceId)}
              >
                {d.label || `Camera ${d.deviceId.slice(0, 6)}`}
              </Button>
            ))}
          </div>
        )}

        {continuous && history.length > 0 && (
          <div className="rounded-md border bg-slate-50 p-2">
            <p className="text-[11px] text-slate-500 mb-1">ລາຍການຫຼ້າສຸດ</p>
            <div className="flex flex-wrap gap-1">
              {history.map((h, i) => (
                <Badge key={i} variant="outline" className="font-mono text-[11px]">{h}</Badge>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          {continuous
            ? "ຫັນກ້ອງໄປໃສ່ບາໂຄດ — ລະບົບຈະເພີ່ມສິນຄ້າເຂົ້າບິນທັນທີ ບໍ່ຕ້ອງປິດກ້ອງ"
            : "ຫັນກ້ອງໄປໃສ່ບາໂຄດ ລະບົບຈະອ່ານອັດຕະໂນມັດ"}
          {!continuous && lastScan && <span className="block mt-1 text-emerald-500">ສະແກນໄດ້: {lastScan}</span>}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-1" />ປິດ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
