import { formatLAK, formatDateTime } from "@/lib/format";
import { CURRENCY_SYMBOL, formatCurrency, PAYMENT_METHOD_LABEL, type Currency } from "@/lib/currency";
import { loadSettings, type PosSettings } from "@/lib/settings";
import { logoSrc } from "@/components/Logo";

export interface ReceiptData {
  sale_code: string;
  created_at: string;
  cashier_email?: string | null;
  customer_name?: string | null;
  items: { name: string; qty: number; unit_price: number; line_total: number }[];
  subtotal: number;
  discount: number;
  total: number;
  payment_method: string;
  currency_paid: Currency;
  exchange_rate: number;
  amount_paid: number;
  change_lak: number;
}

export function Receipt({ data, settings }: { data: ReceiptData; settings?: PosSettings }) {
  const s = settings ?? loadSettings();
  const widthClass = s.paper_width_mm === 58 ? "w-[58mm]" : "w-[80mm]";
  return (
    <div
      id="pos-receipt"
      className={`font-mono text-black bg-white p-3 mx-auto ${widthClass}`}
      style={{ fontSize: `${s.font_size_px}px`, lineHeight: 1.35 }}
    >
      <div className="text-center border-b border-dashed border-black pb-2 mb-2">
        {s.show_logo && (
          <img src={logoSrc} alt="logo" className="mx-auto mb-1" style={{ width: 56, height: 56, objectFit: "contain" }} />
        )}
        <h2 className="font-bold" style={{ fontSize: s.font_size_px + 2 }}>{s.shop_name}</h2>
        {s.shop_name_en && <p style={{ fontSize: s.font_size_px - 2 }}>{s.shop_name_en}</p>}
        {s.shop_address && <p style={{ fontSize: s.font_size_px - 2 }}>{s.shop_address}</p>}
        {s.shop_phone && <p style={{ fontSize: s.font_size_px - 2 }}>ໂທ: {s.shop_phone}</p>}
        {s.shop_tax_id && <p style={{ fontSize: s.font_size_px - 2 }}>ເລກພາສີ: {s.shop_tax_id}</p>}
        {s.receipt_header && <p className="mt-1" style={{ fontSize: s.font_size_px - 2 }}>{s.receipt_header}</p>}
        <p className="mt-1">ໃບເສັດຮັບເງິນ</p>
      </div>

      <div className="mb-2" style={{ fontSize: s.font_size_px - 1 }}>
        <div className="flex justify-between"><span>ບິນ:</span><span>{data.sale_code}</span></div>
        <div className="flex justify-between"><span>ວັນທີ:</span><span>{formatDateTime(data.created_at)}</span></div>
        {data.cashier_email && <div className="flex justify-between"><span>ພະນັກງານ:</span><span className="truncate ml-2">{data.cashier_email}</span></div>}
        {data.customer_name && <div className="flex justify-between"><span>ລູກຄ້າ:</span><span>{data.customer_name}</span></div>}
      </div>

      <div className="border-t border-dashed border-black pt-2">
        {data.items.map((it, i) => (
          <div key={i} className="mb-1">
            <div className="truncate">{it.name}</div>
            <div className="flex justify-between" style={{ fontSize: s.font_size_px - 1 }}>
              <span>{it.qty} × {formatLAK(it.unit_price)}</span>
              <span>{formatLAK(it.line_total)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-dashed border-black pt-2 mt-2 space-y-1">
        <div className="flex justify-between"><span>ຍອດລວມ:</span><span>{formatLAK(data.subtotal)}</span></div>
        {data.discount > 0 && <div className="flex justify-between"><span>ສ່ວນຫຼຸດ:</span><span>-{formatLAK(data.discount)}</span></div>}
        <div className="flex justify-between font-bold border-t border-black pt-1" style={{ fontSize: s.font_size_px + 1 }}>
          <span>ລວມຈ່າຍ:</span><span>{formatLAK(data.total)}</span>
        </div>
        <div className="flex justify-between"><span>ວິທີຊຳລະ:</span><span>{PAYMENT_METHOD_LABEL[data.payment_method]}</span></div>
        {data.currency_paid !== "LAK" && (
          <>
            <div className="flex justify-between"><span>ຮັບ ({data.currency_paid}):</span><span>{CURRENCY_SYMBOL[data.currency_paid]}{data.amount_paid.toLocaleString()}</span></div>
            <div className="flex justify-between" style={{ fontSize: s.font_size_px - 2 }}><span>ອັດຕາ:</span><span>1 {data.currency_paid} = {formatLAK(data.exchange_rate)}</span></div>
          </>
        )}
        {data.currency_paid === "LAK" && (
          <div className="flex justify-between"><span>ຮັບເງິນ:</span><span>{formatCurrency(data.amount_paid, "LAK")}</span></div>
        )}
        {data.change_lak > 0 && (
          <div className="flex justify-between font-bold"><span>ເງິນທອນ:</span><span>{formatLAK(data.change_lak)}</span></div>
        )}
      </div>

      <div className="text-center mt-3 pt-2 border-t border-dashed border-black" style={{ fontSize: s.font_size_px - 2 }}>
        {s.receipt_footer && <p>{s.receipt_footer}</p>}
        <p className="mt-1">{s.shop_name} {s.shop_name_en}</p>
      </div>
    </div>
  );
}

export function printReceipt() {
  const node = document.getElementById("pos-receipt");
  if (!node) return;
  const s = loadSettings();
  const w = window.open("", "_blank", "width=380,height=600");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>Receipt</title>
<style>
  @page { size: ${s.paper_width_mm}mm auto; margin: 0; }
  body { margin: 0; font-family: 'Noto Sans Lao', monospace; font-size: ${s.font_size_px}px; }
  #pos-receipt { width: ${s.paper_width_mm}mm; padding: 8px; }
  img { max-width: 100%; }
  .border-t { border-top: 1px dashed #000; }
  .border-b { border-bottom: 1px dashed #000; }
  .border-black { border-color: #000; }
  .border-dashed { border-style: dashed; }
  .flex { display: flex; }
  .justify-between { justify-content: space-between; }
  .text-center { text-align: center; }
  .font-bold { font-weight: bold; }
  .truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mt-1 { margin-top: 4px; } .mt-2 { margin-top: 8px; } .mt-3 { margin-top: 12px; }
  .mb-1 { margin-bottom: 4px; } .mb-2 { margin-bottom: 8px; }
  .pt-1 { padding-top: 4px; } .pt-2 { padding-top: 8px; } .pb-2 { padding-bottom: 8px; }
  .ml-2 { margin-left: 8px; }
  .mx-auto { margin-left: auto; margin-right: auto; }
  .space-y-1 > * + * { margin-top: 4px; }
</style>
</head><body>${node.outerHTML}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); w.close(); }, 300);
}
