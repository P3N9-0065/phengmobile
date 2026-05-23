import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";
import { BrowserMultiFormatReader } from "@zxing/browser";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onScan: (code: string) => void;
  title?: string;
};

export function BarcodeScanner({ open, onOpenChange, onScan, title = "ສະແກນບາໂຄດ" }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    const reader = new BrowserMultiFormatReader();

    (async () => {
      try {
        const list = await BrowserMultiFormatReader.listVideoInputDevices();
        if (cancelled) return;
        setDevices(list);
        const preferred =
          deviceId ??
          list.find((d) => /back|rear|environment/i.test(d.label))?.deviceId ??
          list[0]?.deviceId;
        if (!preferred) {
          setError("ບໍ່ພົບກ້ອງ");
          return;
        }
        setDeviceId(preferred);
        const controls = await reader.decodeFromVideoDevice(preferred, videoRef.current!, (result) => {
          if (result) {
            const text = result.getText();
            onScan(text);
            onOpenChange(false);
          }
        });
        controlsRef.current = controls;
      } catch (e: any) {
        setError(e?.message ?? "ບໍ່ສາມາດເປີດກ້ອງໄດ້ (ກວດເບິ່ງສິດອະນຸຍາດ)");
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
          </DialogTitle>
        </DialogHeader>
        <div className="relative bg-black rounded-md overflow-hidden aspect-[4/3]">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 h-0.5 bg-red-500/80 shadow-[0_0_8px_rgba(255,0,0,0.6)]" />
          <div className="absolute inset-4 border-2 border-white/40 rounded-md pointer-events-none" />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
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
        <p className="text-xs text-muted-foreground text-center">
          ຫັນກ້ອງໄປໃສ່ບາໂຄດ ລະບົບຈະອ່ານອັດຕະໂນມັດ
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
