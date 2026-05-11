// Multi-currency support — base currency is LAK
export type Currency = "LAK" | "THB" | "USD";

// Default exchange rates: 1 unit of currency = X LAK
// Editable from POS settings later. Conservative defaults (May 2026).
export const DEFAULT_RATES: Record<Currency, number> = {
  LAK: 1,
  THB: 620,
  USD: 21500,
};

export const CURRENCY_LABEL: Record<Currency, string> = {
  LAK: "ກີບ (₭)",
  THB: "ບາດ (฿)",
  USD: "ໂດລາ ($)",
};

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  LAK: "₭",
  THB: "฿",
  USD: "$",
};

export function formatCurrency(n: number, c: Currency): string {
  if (c === "LAK") {
    return new Intl.NumberFormat("lo-LA", { maximumFractionDigits: 0 }).format(Math.round(n)) + " ₭";
  }
  if (c === "THB") {
    return "฿" + new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(n);
  }
  return "$" + new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
}

// Convert from given currency amount → LAK
export const toLAK = (amount: number, c: Currency, rate: number) =>
  c === "LAK" ? amount : amount * rate;

// Convert LAK → given currency
export const fromLAK = (lak: number, c: Currency, rate: number) =>
  c === "LAK" ? lak : lak / rate;

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: "ເງິນສົດ",
  qr: "ສະແກນ QR",
  transfer: "ໂອນ",
  card: "ບັດ",
};
