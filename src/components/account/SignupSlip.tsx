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

  return (
    <div
      className="print-only signup-slip-80"
      style={{
        color: "#000",
        background: "#fff",
        width: "80mm",
        padding: "3mm",
        margin: "0 auto",
        fontFamily: "'Noto Sans Lao', sans-serif",
        fontSize: 11,
        lineHeight: 1.35,
      }}
    >
      <div style={{ textAlign: "center", borderBottom: "1px dashed #000", paddingBottom: 4, marginBottom: 6 }}>
        <h1 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>{settings.shop_name}</h1>
        {settings.shop_name_en && <p style={{ fontSize: 10, margin: "1px 0" }}>{settings.shop_name_en}</p>}
        {settings.shop_phone && <p style={{ fontSize: 10, margin: "1px 0" }}>ໂທ: {settings.shop_phone}</p>}
        {settings.shop_address && <p style={{ fontSize: 10, margin: "1px 0" }}>{settings.shop_address}</p>}
        <h2 style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>ໃບຂໍ້ມູນບັນຊີສະໝັກ</h2>
      </div>

      <div style={{ fontSize: 11, lineHeight: 1.5 }}>
        <Row label="ວັນທີ" value={created} />
        <Row label="ລູກຄ້າ" value={signup.customer_name_snapshot} />
        {signup.customer_phone_snapshot && <Row label="ເບີໂທ" value={signup.customer_phone_snapshot} />}
        <Row label="ປະເພດ" value={TYPE_LABEL[signup.account_type] ?? signup.account_type} />
      </div>

      <div style={{ border: "1px dashed #000", padding: 5, margin: "6px 0", borderRadius: 2 }}>
        <p style={{ fontWeight: 700, margin: "0 0 3px", fontSize: 11 }}>ຂໍ້ມູນບັນຊີ</p>
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
        <div style={{ marginTop: 4 }}>
          <p style={{ fontSize: 10, fontWeight: 700, margin: 0 }}>ໝາຍເຫດ:</p>
          <p style={{ fontSize: 10, margin: "1px 0" }}>{signup.notes}</p>
        </div>
      )}

      <div style={{ textAlign: "center", margin: "8px 0" }}>
        <QRCodeCanvas value={trackUrl} size={80} level="M" includeMargin={false} />
        <p style={{ fontSize: 9, margin: "2px 0 0" }}>ສະແກນເບິ່ງຂໍ້ມູນ</p>
      </div>

      <div style={{ padding: 4, border: "1px solid #000", borderRadius: 2, fontSize: 9, textAlign: "center" }}>
        <p style={{ margin: 0, fontWeight: 700 }}>⚠ ເກັບຮັກສາຂໍ້ມູນໃຫ້ປອດໄພ</p>
        <p style={{ margin: "1px 0 0" }}>ຢ່າແບ່ງປັນລະຫັດຜ່ານໃຫ້ຜູ້ອື່ນ</p>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, fontSize: 10, gap: 6 }}>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ borderTop: "1px solid #000", marginBottom: 2 }} />
          <span>ພະນັກງານ</span>
        </div>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ borderTop: "1px solid #000", marginBottom: 2 }} />
          <span>ລູກຄ້າ</span>
        </div>
      </div>

      {settings.receipt_footer && (
        <p style={{ textAlign: "center", fontSize: 10, marginTop: 8, fontStyle: "italic" }}>{settings.receipt_footer}</p>
      )}

      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 0; }
          .signup-slip-80 { width: 80mm !important; padding: 3mm !important; margin: 0 !important; }
        }
      `}</style>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
      <span style={{ color: "#444" }}>{label}:</span>
      <span style={{ fontFamily: mono ? "monospace" : undefined, textAlign: "right", wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}
