import { QRCodeCanvas } from "qrcode.react";
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
 * ໃບຮັບເຄື່ອງສ້ອມ — thermal 80mm print, pure block flow.
 */
export function RepairReceipt({ ticket, customer, trackUrl }: Props) {
  const s = usePosSettings();
  const photo = ticket.photo_urls?.[0];

  const base: React.CSSProperties = {
    display: "block",
    width: "80mm",
    height: "auto",
    margin: 0,
    padding: 0,
    overflow: "visible",
    color: "#000",
    background: "#fff",
    fontFamily: "'Noto Sans Lao', system-ui, sans-serif",
    fontSize: 11,
    lineHeight: 1.35,
    boxSizing: "border-box",
  };

  return (
    <div style={base}>
      {/* Header */}
      <div style={{ display: "block", textAlign: "center", borderBottom: "1px dashed #000", paddingBottom: 2, marginBottom: 2 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{s.shop_name}</div>
        {s.shop_name_en && <div style={{ fontSize: 10 }}>{s.shop_name_en}</div>}
        {s.shop_phone && <div style={{ fontSize: 10 }}>ໂທ: {s.shop_phone}</div>}
        {s.shop_address && <div style={{ fontSize: 10 }}>{s.shop_address}</div>}
        <div style={{ fontWeight: 700, marginTop: 2 }}>ໃບຮັບເຄື່ອງສ້ອມ</div>
      </div>

      {/* Ticket meta */}
      <div style={{ display: "block", marginBottom: 2 }}>
        <Row label="ເລກທີ" value={ticket.ticket_code} bold />
        <Row label="ວັນທີ" value={formatDateTime(ticket.created_at)} />
      </div>

      {/* Customer + device */}
      <div style={{ display: "block", borderTop: "1px dashed #000", paddingTop: 2, marginTop: 2 }}>
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
        <div style={{ display: "block", textAlign: "center", marginTop: 2 }}>
          <SignedImg
            src={photo}
            alt="device"
            style={{ display: "block", width: "60mm", height: "auto", margin: "0 auto", border: "1px solid #000" }}
            crossOrigin="anonymous"
          />
        </div>
      )}

      {/* QR */}
      <div style={{ display: "block", textAlign: "center", marginTop: 2 }}>
        <QRCodeCanvas value={trackUrl} size={110} level="M" includeMargin={false} />
        <div style={{ fontSize: 9, marginTop: 1 }}>ສະແກນເພື່ອຕິດຕາມສະຖານະ</div>
      </div>

      {/* Signatures — stacked block, no flex/space-between */}
      <div style={{ display: "block", marginTop: 2, fontSize: 10 }}>
        <div style={{ display: "block", textAlign: "center", marginTop: 2 }}>
          {ticket.signature_url ? (
            <SignedImg src={ticket.signature_url} alt="sig" style={{ display: "block", height: 30, margin: "0 auto" }} />
          ) : (
            <div style={{ height: 18 }} />
          )}
          <div style={{ borderTop: "1px solid #000", paddingTop: 1 }}>ລາຍເຊັນລູກຄ້າ</div>
        </div>
        <div style={{ display: "block", textAlign: "center", marginTop: 2 }}>
          <div style={{ height: 18 }} />
          <div style={{ borderTop: "1px solid #000", paddingTop: 1 }}>ລາຍເຊັນພະນັກງານ</div>
        </div>
      </div>

      {s.receipt_footer && (
        <div style={{ display: "block", textAlign: "center", fontSize: 9, marginTop: 2 }}>{s.receipt_footer}</div>
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value?: string | number | null; bold?: boolean }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div style={{ display: "block", fontSize: 11, marginBottom: 1, fontWeight: bold ? 700 : 400 }}>
      <span style={{ color: "#444" }}>{label}: </span>
      <span style={{ wordBreak: "break-word" }}>{String(value)}</span>
    </div>
  );
}
