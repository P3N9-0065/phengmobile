import { QRCodeCanvas } from "qrcode.react";
import { Logo } from "@/components/Logo";
import { usePosSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/format";
import { STATUS_LABEL, type RepairStatus } from "@/lib/lao";

interface Props {
  ticket: any;
  customer: { name?: string; phone?: string } | null;
  trackUrl: string;
}

/**
 * ໃບຮັບເຄື່ອງສ້ອມ — print-only.
 * Compact A5-ish layout that also fits 80mm thermal printers when scaled.
 */
export function RepairReceipt({ ticket, customer, trackUrl }: Props) {
  const s = usePosSettings();
  return (
    <div className="repair-receipt bg-white text-black mx-auto" style={{ width: "190mm", padding: "8mm", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div className="flex items-start justify-between border-b border-black pb-2 mb-3">
        <div className="flex gap-3 items-center">
          {s.show_logo && <Logo className="h-12 w-12" />}
          <div>
            <p className="text-lg font-bold leading-tight">{s.shop_name}</p>
            {s.shop_name_en && <p className="text-xs">{s.shop_name_en}</p>}
            {s.shop_address && <p className="text-[11px]">{s.shop_address}</p>}
            {s.shop_phone && <p className="text-[11px]">ໂທ: {s.shop_phone}</p>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide">ໃບຮັບເຄື່ອງສ້ອມ</p>
          <p className="text-base font-bold">{ticket.ticket_code}</p>
          <p className="text-[11px]">{formatDateTime(ticket.created_at)}</p>
        </div>
      </div>

      {/* Body grid: info + QR */}
      <div className="grid grid-cols-[1fr_auto] gap-4">
        <div className="space-y-2 text-[12px]">
          <Row label="ລູກຄ້າ" value={customer?.name} />
          <Row label="ເບີໂທ" value={customer?.phone} />
          <Row label="ເຄື່ອງ" value={`${ticket.device_brand ?? ""} ${ticket.device_model ?? ""}`.trim()} />
          {ticket.device_imei && <Row label="IMEI" value={ticket.device_imei} />}
          {ticket.device_color && <Row label="ສີ" value={ticket.device_color} />}
          {ticket.lock_code && <Row label="ລະຫັດປົດລ໋ອກ" value={ticket.lock_code} />}
          <Row label="ອາການ" value={ticket.problem_description} />
          {ticket.accessories?.length > 0 && (
            <Row label="ອຸປະກອນຝາກ" value={ticket.accessories.join(", ")} />
          )}
          {ticket.estimated_price != null && (
            <Row label="ປະເມີນລາຄາ" value={`${Number(ticket.estimated_price).toLocaleString()} ₭`} />
          )}
          <Row label="ປະກັນ" value={`${ticket.warranty_days ?? 7} ມື້`} />
          <Row label="ສະຖານະ" value={STATUS_LABEL[ticket.status as RepairStatus]} />
        </div>
        <div className="flex flex-col items-center text-center">
          <div className="border border-black p-1 bg-white">
            <QRCodeCanvas value={trackUrl} size={120} level="M" includeMargin={false} />
          </div>
          <p className="text-[10px] mt-1 leading-tight">ສະແກນເພື່ອ<br/>ຕິດຕາມສະຖານະ</p>
          <p className="text-[9px] mt-0.5 break-all max-w-[130px]">{trackUrl}</p>
        </div>
      </div>

      {/* Terms */}
      <div className="mt-4 pt-2 border-t border-dashed border-black text-[10px] leading-snug">
        <p className="font-semibold mb-1">ເງື່ອນໄຂການຮັບເຄື່ອງສ້ອມ:</p>
        <ol className="list-decimal pl-4 space-y-0.5">
          <li>ກະລຸນາເກັບໃບຮັບສ້ອມໄວ້ສະແດງເມື່ອມາຮັບເຄື່ອງ.</li>
          <li>ກໍລະນີເຄື່ອງບໍ່ມາຮັບພາຍໃນ 30 ມື້ ຮ້ານຈະບໍ່ຮັບຜິດຊອບຕໍ່ການເສຍຫາຍ ຫຼື ສູນເສຍ.</li>
          <li>ປະກັນຄອບຄຸມສະເພາະອາການທີ່ສ້ອມ ບໍ່ລວມການຕົກ/ນ້ຳເຂົ້າ ຫຼື ການແກະຮື້ພາຍຫຼັງ.</li>
        </ol>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-6 mt-6 text-[11px]">
        <div className="text-center">
          {ticket.signature_url ? (
            <img src={ticket.signature_url} alt="signature" className="h-14 mx-auto object-contain" />
          ) : (
            <div className="h-14" />
          )}
          <div className="border-t border-black pt-1">ລາຍເຊັນລູກຄ້າ</div>
        </div>
        <div className="text-center">
          <div className="h-14" />
          <div className="border-t border-black pt-1">ລາຍເຊັນພະນັກງານ</div>
        </div>
      </div>

      {s.receipt_footer && (
        <p className="text-center text-[10px] mt-3">{s.receipt_footer}</p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex gap-2">
      <span className="w-24 shrink-0 text-gray-700">{label}:</span>
      <span className="flex-1 font-medium break-words">{value}</span>
    </div>
  );
}
