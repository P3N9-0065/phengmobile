import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Parse a stored value (either a raw object path or a legacy public URL)
 * into { bucket, path }. Returns null if it can't be parsed.
 */
function parseStored(value: string): { bucket: string; path: string } | null {
  if (!value) return null;
  // Legacy public URL: .../storage/v1/object/public/<bucket>/<path>
  const m = value.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?|$)/);
  if (m) return { bucket: m[1], path: decodeURIComponent(m[2]) };
  // Raw path "<bucket>/<path>"
  if (!value.includes("://")) {
    const idx = value.indexOf("/");
    if (idx > 0) return { bucket: value.slice(0, idx), path: value.slice(idx + 1) };
  }
  return null;
}

const EXPIRES_IN = 60 * 60; // 1 hour

export async function getSignedUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  const parsed = parseStored(value);
  if (!parsed) return value; // unknown format — return as-is
  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, EXPIRES_IN);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export function useSignedUrl(value: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!value) { setUrl(null); return; }
    getSignedUrl(value).then((u) => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [value]);
  return url;
}

export function useSignedUrls(values: (string | null | undefined)[] | null | undefined): (string | null)[] {
  const [urls, setUrls] = useState<(string | null)[]>([]);
  const key = (values ?? []).join("|");
  useEffect(() => {
    let cancelled = false;
    if (!values || values.length === 0) { setUrls([]); return; }
    Promise.all(values.map((v) => getSignedUrl(v))).then((res) => {
      if (!cancelled) setUrls(res);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return urls;
}
