import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ShippingSettings {
  flat_rate: number;
  free_threshold: number;
  enabled: boolean;
}

export const DEFAULT_SHIPPING: ShippingSettings = {
  flat_rate: 20000,
  free_threshold: 500000,
  enabled: true,
};

export function useShippingSettings() {
  return useQuery({
    queryKey: ["shipping-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shipping_settings" as any).select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return (data as any) ?? DEFAULT_SHIPPING;
    },
    staleTime: 60_000,
  });
}

export function calcShipping(subtotal: number, method: "pickup" | "delivery", s: ShippingSettings): number {
  if (method !== "delivery" || !s.enabled) return 0;
  if (s.free_threshold > 0 && subtotal >= s.free_threshold) return 0;
  return Number(s.flat_rate) || 0;
}
