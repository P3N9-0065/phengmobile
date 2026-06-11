import { useState } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { SignedImg } from "@/components/SignedImg";
import { getSignedUrl } from "@/lib/signed-url";
import { toast } from "sonner";

interface Props {
  bucket: string;
  urls: string[];
  onChange: (urls: string[]) => void;
  label?: string;
  className?: string;
}

export function PhotoUploader({ bucket, urls, onChange, label, className }: Props) {
  const [uploading, setUploading] = useState(false);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const next: string[] = [];
      for (const file of Array.from(files)) {
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
        const { error } = await supabase.storage.from(bucket).upload(path, file);
        if (error) throw error;
        next.push(`${bucket}/${path}`);
      }
      onChange([...urls, ...next]);
      toast.success("ອັບໂຫຼດສຳເລັດ");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function remove(idx: number) {
    onChange(urls.filter((_, i) => i !== idx));
  }

  return (
    <div className={className}>
      {label && <p className="text-sm font-medium mb-2">{label}</p>}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {urls.map((url, i) => (
          <div key={i} className="relative group">
            <button
              type="button"
              onClick={async () => {
                const signed = await getSignedUrl(url);
                if (signed) window.open(signed, "_blank", "noopener,noreferrer");
              }}
              className="block w-full"
            >
              <SignedImg src={url} alt="" className="w-full h-24 object-cover rounded border" />
            </button>
            <button
              type="button"
              onClick={() => remove(i)}
              className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 flex items-center justify-center transition"
              title="ລົບຮູບ"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <label className="h-24 border-2 border-dashed rounded flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 text-xs text-muted-foreground gap-1">
          <Upload className="h-4 w-4" />
          <span>{uploading ? "ກຳລັງອັບ..." : "ເພີ່ມຮູບ"}</span>
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} disabled={uploading} />
        </label>
      </div>
    </div>
  );
}
