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
 * ໃບຮັບເຄື່ອງສ້ອມ — print-only, A5 compact.
 * Shows only essential info + device photo + QR for status tracking.
 */
export function RepairReceipt({ ticket, customer, trackUrl }: Props) {
  const s = usePosSettings();
  const photo = ticket.photo_urls?.[0];

  return (
    <div
      className="repair-receipt bg-white text-black"
      style={{
        width: "100%",
        padding: "4mm 6mm",
        fontFamily: "system-ui, sans-serif",
        fontSize: "11px",
        lineHeight: 1.35,
        color: "#000",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between" style={{ borderBottom: "1px solid #000", paddingBottom: "4px" }}>
        <div className="flex items-center gap-2">
          {s.show_logo && <Logo className="h-10 w-10" />}
          <div>
            <div style={{ fontWeight: 700, fontSize: "13px" }}>{s.shop_name}</div>
            {s.shop_phone && <div style={{ fontSize: "10px" }}>ໂທ: {s.shop_phone}</div>}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.05em" }}>ໃບຮັບເຄື່ອງສ້ອມ</div>
          <div style={{ fontWeight: 700, fontSize: "14px" }}>{ticket.ticket_code}</div>
          <div style={{ fontSize: "10px" }}>{formatDateTime(ticket.created_at)}</div>
        </div>
      </div>

      {/* Body: info + photo + QR */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "8px", marginTop: "6px" }}>
        {/* Left: info */}
        <div>
          <Row label="ລູກຄ້າ" value={customer?.name} />
          <Row label="ເບີໂທ" value={customer?.phone} />
          <Row label="ເຄື່ອງ" value={`${ticket.device_brand ?? ""} ${ticket.device_model ?? ""}`.trim()} />
          {ticket.device_color && <Row label="ສີ" value={ticket.device_color} />}
          {ticket.device_imei && <Row label="IMEI" value={ticket.device_imei} />}
          <Row label="ອາການ" value={ticket.problem_description} />
          {ticket.estimated_price != null && (
            <Row label="ປະເມີນ" value={`${Number(ticket.estimated_price).toLocaleString()} ₭`} />
          )}
          <Row label="ປະກັນ" value={`${ticket.warranty_days ?? 7} ມື້`} />
          <Row label="ສະຖານະ" value={STATUS_LABEL[ticket.status as RepairStatus]} />
        </div>

        {/* Right: device photo + QR */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", width: "130px" }}>
          {photo && (
            <img
              src={photo}
              alt="device"
              style={{
                width: "130px",
                height: "100px",
                objectFit: "cover",
                border: "1px solid #000",
              }}
              crossOrigin="anonymous"
            />
          )}
          <div style={{ border: "1px solid #000", padding: "2px", background: "#fff" }}>
            <QRCodeCanvas value={trackUrl} size={110} level="M" includeMargin={false} />
          </div>
          <div style={{ fontSize: "9px", textAlign: "center", lineHeight: 1.2 }}>
            ສະແກນເພື່ອຕິດຕາມສະຖານະ
          </div>
        </div>
      </div>

      {/* Signatures */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "10px", fontSize: "10px" }}>
        <div style={{ textAlign: "center" }}>
          {ticket.signature_url ? (
            <img src={ticket.signature_url} alt="sig" style={{ height: "36px", margin: "0 auto", objectFit: "contain" }} />
          ) : (
            <div style={{ height: "36px" }} />
          )}
          <div style={{ borderTop: "1px solid #000", paddingTop: "2px" }}>ລາຍເຊັນລູກຄ້າ</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ height: "36px" }} />
          <div style={{ borderTop: "1px solid #000", paddingTop: "2px" }}>ລາຍເຊັນພະນັກງານ</div>
        </div>
      </div>

      {s.receipt_footer && (
        <div style={{ textAlign: "center", fontSize: "9px", marginTop: "6px" }}>{s.receipt_footer}</div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div style={{ display: "flex", gap: "6px", marginBottom: "2px" }}>
      <span style={{ width: "56px", flexShrink: 0, color: "#444" }}>{label}:</span>
      <span style={{ flex: 1, fontWeight: 500, wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}
