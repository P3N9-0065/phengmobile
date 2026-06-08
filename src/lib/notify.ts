// Shared helpers for customer notifications (client-safe).

export function normalizeLaoPhone(raw: string, defaultCc = "856"): string {
  if (!raw) return "";
  let p = raw.replace(/[^\d+]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  else if (p.startsWith("00")) p = p.slice(2);
  else if (p.startsWith("0")) p = defaultCc + p.slice(1);
  else if (!p.startsWith(defaultCc)) p = defaultCc + p;
  return p;
}

export function waLink(phone: string, text: string): string {
  const p = normalizeLaoPhone(phone);
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
}

export function readyMessage(opts: {
  customerName?: string | null;
  ticketCode: string;
  device: string;
  finalPrice?: number | null;
  trackUrl: string;
  shopName?: string | null;
  shopPhone?: string | null;
}): string {
  const lines: string[] = [];
  if (opts.shopName) lines.push(`[${opts.shopName}]`);
  lines.push(`ສະບາຍດີ${opts.customerName ? " " + opts.customerName : ""},`);
  lines.push(`ເຄື່ອງ ${opts.device} (ໃບສ້ອມ ${opts.ticketCode}) ສ້ອມສຳເລັດແລ້ວ ພ້ອມໃຫ້ມາຮັບ.`);
  if (opts.finalPrice && opts.finalPrice > 0) {
    lines.push(`ຍອດຊຳລະ: ${opts.finalPrice.toLocaleString("lo-LA")} ₭`);
  }
  lines.push(`ຕິດຕາມສະຖານະ: ${opts.trackUrl}`);
  if (opts.shopPhone) lines.push(`ຕິດຕໍ່ຮ້ານ: ${opts.shopPhone}`);
  lines.push(`ຂອບໃຈທີ່ໃຊ້ບໍລິການ.`);
  return lines.join("\n");
}
