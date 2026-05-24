import { supabase } from "@/integrations/supabase/client";

export type LookupItem = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  sell_price: number;
  stock_qty: number;
  category: string;
  cost_price?: number;
};

export async function fallbackLookup(code: string): Promise<LookupItem[]> {
  const c = code.trim();
  if (!c) return [];

  // 1. exact barcode
  let { data } = await supabase
    .from("inventory_items")
    .select("id,name,sku,barcode,sell_price,stock_qty,category,cost_price")
    .eq("barcode", c)
    .limit(5);
  if (data && data.length > 0) return data as LookupItem[];

  // 2. exact sku
  ({ data } = await supabase
    .from("inventory_items")
    .select("id,name,sku,barcode,sell_price,stock_qty,category,cost_price")
    .eq("sku", c)
    .limit(5));
  if (data && data.length > 0) return data as LookupItem[];

  // 3. ilike name / sku / barcode (partial match)
  ({ data } = await supabase
    .from("inventory_items")
    .select("id,name,sku,barcode,sell_price,stock_qty,category,cost_price")
    .or(`name.ilike.%${c}%,sku.ilike.%${c}%,barcode.ilike.%${c}%`)
    .limit(10));
  return (data ?? []) as LookupItem[];
}
