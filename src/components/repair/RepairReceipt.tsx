import { QRCodeCanvas } from "qrcode.react";
import { Logo } from "@/components/Logo";
import { SignedImg } from "@/components/SignedImg";
import { usePosSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/format";
import { STATUS_LABEL, type RepairStatus } from "@/lib/lao";

interface Props {
  ticket: any;
  customer: { name?: string; phone?: string } | null;
  trackUrl: string;
}

/**
 * ໃບຮັບເຄື່ອງສ້ອມ — thermal 80mm compact layout.
 */
export function RepairReceipt({ ticket, customer, trackUrl }: Props) {
  const s = usePosSettings();
  const photo = ticket.photo_urls?.[0];

  return (
    <div
      className="repair-receipt bg-white text-black"
      style={{
        width: "100%",
        maxWidth: "80mm",
        margin: 0,
        padding: 0,
        fontFamily: "'Noto Sans Lao', system-ui, sans-serif",
        fontSize: "11px",
        lineHeight: 1.25,
        color: "#000",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", borderBottom: "1px dashed #000", paddingBottom: "2px" }}>
        {s.show_logo && <Logo className="h-8 w-8" />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "12px", lineHeight: 1.15 }}>{s.shop_name}</div>
          {s.shop_phone && <div style={{ fontSize: "10px", lineHeight: 1.15 }}>ໂທ: {s.shop_phone}</div>}
        </div>
      </div>

      {/* Ticket meta */}
      <div style={{ textAlign: "center", marginTop: "2px", paddingBottom: "2px", borderBottom: "1px dashed #000" }}>
        <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.05em" }}>ໃບຮັບເຄື່ອງສ້ອມ</div>
        <div style={{ fontWeight: 700, fontSize: "13px", lineHeight: 1.15 }}>{ticket.ticket_code}</div>
        <div style={{ fontSize: "9px" }}>{formatDateTime(ticket.created_at)}</div>
      </div>

      {/* Info rows — full width */}
      <div style={{ marginTop: "2px" }}>
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

      {/* Device photo */}
      {photo && (
        <div style={{ marginTop: "3px", textAlign: "center" }}>
          <SignedImg
            src={photo}
            alt="device"
            style={{
              width: "100%",
              maxHeight: "40mm",
              objectFit: "contain",
              border: "1px solid #000",
            }}
            crossOrigin="anonymous"
          />
        </div>
      )}

      {/* QR */}
      <div style={{ marginTop: "3px", display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", borderTop: "1px dashed #000", paddingTop: "3px" }}>
        <QRCodeCanvas value={trackUrl} size={110} level="M" includeMargin={false} />
        <div style={{ fontSize: "9px", lineHeight: 1.15 }}>ສະແກນເພື່ອຕິດຕາມສະຖານະ</div>
      </div>

      {/* Signatures */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginTop: "4px", fontSize: "9px" }}>
        <div style={{ textAlign: "center" }}>
          {ticket.signature_url ? (
            <SignedImg src={ticket.signature_url} alt="sig" style={{ height: "24px", margin: "0 auto", objectFit: "contain" }} />
          ) : (
            <div style={{ height: "24px" }} />
          )}
          <div style={{ borderTop: "1px solid #000", paddingTop: "1px" }}>ລູກຄ້າ</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ height: "24px" }} />
          <div style={{ borderTop: "1px solid #000", paddingTop: "1px" }}>ພະນັກງານ</div>
        </div>
      </div>

      {s.receipt_footer && (
        <div style={{ textAlign: "center", fontSize: "9px", marginTop: "3px", borderTop: "1px dashed #000", paddingTop: "2px" }}>
          {s.receipt_footer}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div style={{ display: "flex", gap: "4px", marginBottom: "1px" }}>
      <span style={{ width: "44px", flexShrink: 0, color: "#000", fontSize: "10px" }}>{label}:</span>
      <span style={{ flex: 1, fontWeight: 500, wordBreak: "break-word", fontSize: "10px" }}>{value}</span>
    </div>
  );
}
