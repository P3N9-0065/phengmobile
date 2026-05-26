import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LoyaltySettings {
  id: number;
  earn_rate_lak: number;
  redeem_value_lak: number;
  bronze_threshold: number;
  silver_threshold: number;
  gold_threshold: number;
  enabled: boolean;
  updated_at: string;
}

export type Tier = "none" | "bronze" | "silver" | "gold";

export const TIER_LABEL: Record<Tier, string> = {
  none: "-",
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
};

export const TIER_COLOR: Record<Tier, string> = {
  none: "bg-slate-100 text-slate-600 border-slate-300",
  bronze: "bg-amber-100 text-amber-800 border-amber-400",
  silver: "bg-slate-200 text-slate-700 border-slate-400",
  gold: "bg-yellow-100 text-yellow-800 border-yellow-500",
};

export function computeTier(points: number, s: LoyaltySettings | null | undefined): Tier {
  if (!s) return "none";
  if (points >= s.gold_threshold) return "gold";
  if (points >= s.silver_threshold) return "silver";
  if (points >= s.bronze_threshold) return "bronze";
  return "none";
}

export function useLoyaltySettings() {
  return useQuery({
    queryKey: ["loyalty-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("loyalty_settings" as any).select("*").eq("id", 1).single();
      return (data as unknown) as LoyaltySettings | null;
    },
    staleTime: 60_000,
  });
}
