import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";

export function Logo({ className, alt = "Pheng Mobile" }: { className?: string; alt?: string }) {
  return <img src={logo} alt={alt} className={cn("object-contain", className)} />;
}

export { logo as logoSrc };
