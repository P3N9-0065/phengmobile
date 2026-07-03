import { QRCodeCanvas } from "qrcode.react";
import { usePosSettings } from "@/lib/settings";

type SignupRecord = {
  id: string;
  customer_name_snapshot: string;
  customer_phone_snapshot?: string | null;
  account_type: string;
  account_email: string;
  account_password?: string | null;
  recovery_email?: string | null;
  recovery_phone?: string | null;
  birthdate?: string | null;
  service_fee?: number | string | null;
  notes?: string | null;
  created_at: string;
};

const TYPE_LABEL: Record<string, string> = {
  email: "Email",
  apple_id: "Apple ID",
  google: "Google",
  other: "ອື່ນໆ",
};

export function SignupSlip({ signup }: { signup: SignupRecord }) {
  const settings = usePosSettings();
  const created = new Date(signup.created_at).toLocaleString("lo-LA");
  const trackUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/signup/${signup.id}`
      : `/signup/${signup.id}`;

  const base: React.CSSProperties = {
    display: "block",
    width: "80mm",
    height: "auto",
    margin: 0,
    padding: 0,
    overflow: "visible",
    color: "#000",
    background: "#fff",
    fontFamily: "'Noto Sans Lao', sans-serif",
    fontSize: 11,
    lineHeight: 1.35,
    boxSizing: "border-box",
  };

  return (
    <div className="print-only" style={base}>
      {/* Header */}
      <div style={{ display: "block", textAlign: "center", borderBottom: "1px dashed #000", paddingBottom: 2, marginBottom: 2 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{settings.shop_name}</div>
        {settings.shop_name_en && <div style={{ fontSize: 10 }}>{settings.shop_name_en}</div>}
        {settings.shop_phone && <div style={{ fontSize: 10 }}>ໂທ: {settings.shop_phone}</div>}
        {settings.shop_address && <div style={{ fontSize: 10 }}>{settings.shop_address}</div>}
        <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>ໃບຂໍ້ມູນບັນຊີສະໝັກ</div>
      </div>

      {/* Meta */}
      <div style={{ display: "block", marginBottom: 2 }}>
        <Row label="ວັນທີ" value={created} />
        <Row label="ລູກຄ້າ" value={signup.customer_name_snapshot} />
        {signup.customer_phone_snapshot && <Row label="ເບີໂທ" value={signup.customer_phone_snapshot} />}
        <Row label="ປະເພດ" value={TYPE_LABEL[signup.account_type] ?? signup.account_type} />
      </div>

      {/* Account info */}
      <div style={{ display: "block", border: "1px dashed #000", padding: 2, marginTop: 2, marginBottom: 2 }}>
        <div style={{ fontWeight: 700, marginBottom: 1 }}>ຂໍ້ມູນບັນຊີ</div>
        <Row label="ອີເມວ" value={signup.account_email} mono />
        {signup.account_password && <Row label="ລະຫັດຜ່ານ" value={signup.account_password} mono />}
        {signup.recovery_email && <Row label="ອີເມວກູ້ຄືນ" value={signup.recovery_email} mono />}
        {signup.recovery_phone && <Row label="ເບີກູ້ຄືນ" value={signup.recovery_phone} />}
        {signup.birthdate && <Row label="ວັນເກີດ" value={signup.birthdate} />}
      </div>

      {Number(signup.service_fee) > 0 && (
        <Row label="ຄ່າບໍລິການ" value={`${Number(signup.service_fee).toLocaleString()} LAK`} />
      )}

      {signup.notes && (
        <div style={{ display: "block", marginTop: 2 }}>
          <div style={{ fontSize: 10, fontWeight: 700 }}>ໝາຍເຫດ:</div>
          <div style={{ fontSize: 10 }}>{signup.notes}</div>
        </div>
      )}

      {/* QR */}
      <div style={{ display: "block", textAlign: "center", marginTop: 2 }}>
        <QRCodeCanvas value={trackUrl} size={90} level="M" includeMargin={false} />
        <div style={{ fontSize: 9, marginTop: 1 }}>ສະແກນເບິ່ງຂໍ້ມູນ</div>
      </div>

      {/* Warning */}
      <div style={{ display: "block", border: "1px solid #000", padding: 2, marginTop: 2, fontSize: 9, textAlign: "center" }}>
        <div style={{ fontWeight: 700 }}>⚠ ເກັບຮັກສາຂໍ້ມູນໃຫ້ປອດໄພ</div>
        <div>ຢ່າແບ່ງປັນລະຫັດຜ່ານໃຫ້ຜູ້ອື່ນ</div>
      </div>

      {/* Signatures — stacked block */}
      <div style={{ display: "block", marginTop: 2, fontSize: 10 }}>
        <div style={{ display: "block", textAlign: "center", marginTop: 2 }}>
          <div style={{ height: 16 }} />
          <div style={{ borderTop: "1px solid #000", paddingTop: 1 }}>ພະນັກງານ</div>
        </div>
        <div style={{ display: "block", textAlign: "center", marginTop: 2 }}>
          <div style={{ height: 16 }} />
          <div style={{ borderTop: "1px solid #000", paddingTop: 1 }}>ລູກຄ້າ</div>
        </div>
      </div>

      {settings.receipt_footer && (
        <div style={{ display: "block", textAlign: "center", fontSize: 10, marginTop: 2, fontStyle: "italic" }}>
          {settings.receipt_footer}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "block", fontSize: 11, marginBottom: 1 }}>
      <span style={{ color: "#444" }}>{label}: </span>
      <span style={{ fontFamily: mono ? "monospace" : undefined, wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}
