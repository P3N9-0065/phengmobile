import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ReturnPolicy {
  max_days: number;
  block_redeemed: boolean;
  block_discounted: boolean;
  block_phone: boolean;
  require_reason: boolean;
}

export const DEFAULT_RETURN_POLICY: ReturnPolicy = {
  max_days: 7,
  block_redeemed: true,
  block_discounted: true,
  block_phone: true,
  require_reason: true,
};

export function useReturnPolicy() {
  return useQuery({
    queryKey: ["return-policy"],
    queryFn: async (): Promise<ReturnPolicy> => {
      const { data } = await supabase
        .from("return_policy_settings" as any)
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      const row = data as any;
      if (!row) return DEFAULT_RETURN_POLICY;
      return {
        max_days: row.max_days ?? 7,
        block_redeemed: !!row.block_redeemed,
        block_discounted: !!row.block_discounted,
        block_phone: !!row.block_phone,
        require_reason: !!row.require_reason,
      };
    },
    staleTime: 60_000,
  });
}
