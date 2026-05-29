import { useSignedUrl } from "@/lib/signed-url";
import type { ImgHTMLAttributes } from "react";

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src: string | null | undefined;
  fallback?: string;
}

/**
 * Renders an <img> whose src is replaced by a short-lived signed URL.
 * Accepts either a raw "<bucket>/<path>" string or a legacy public URL.
 */
export function SignedImg({ src, fallback, ...rest }: Props) {
  const signed = useSignedUrl(src);
  return <img {...rest} src={signed ?? fallback ?? ""} />;
}
