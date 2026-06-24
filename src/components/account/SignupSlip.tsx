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
    <div className="print-only thermal-receipt" style={{ color: "#000", background: "#fff", width: "80mm", maxWidth: "80mm", padding: "4mm 5mm", margin: 0, fontFamily: "sans-serif", fontSize: "11px", lineHeight: 1.4, verticalAlign: "top", wordWrap: "break-word", overflowWrap: "break-word", boxSizing: "border-box" }}>
      <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: 8, marginBottom: 10 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{settings.shop_name}</h1>
        {settings.shop_name_en && <p style={{ fontSize: 12, margin: "2px 0" }}>{settings.shop_name_en}</p>}
        {settings.shop_phone && <p style={{ fontSize: 11, margin: "2px 0" }}>ໂທ: {settings.shop_phone}</p>}
        {settings.shop_address && <p style={{ fontSize: 11, margin: "2px 0" }}>{settings.shop_address}</p>}
        <h2 style={{ fontSize: 14, fontWeight: 700, marginTop: 8 }}>ໃບຂໍ້ມູນບັນຊີສະໝັກ</h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, fontSize: 12, lineHeight: 1.6 }}>
        <div>
          <Row label="ວັນທີ" value={created} />
          <Row label="ລູກຄ້າ" value={signup.customer_name_snapshot} />
          {signup.customer_phone_snapshot && <Row label="ເບີໂທ" value={signup.customer_phone_snapshot} />}
          <Row label="ປະເພດບັນຊີ" value={TYPE_LABEL[signup.account_type] ?? signup.account_type} />
        </div>
        <div style={{ textAlign: "center" }}>
          <QRCodeCanvas value={trackUrl} size={90} level="M" includeMargin={false} />
          <p style={{ fontSize: 9, margin: "4px 0 0" }}>ສະແກນເບິ່ງຂໍ້ມູນ</p>
        </div>
      </div>

      <div style={{ fontSize: 12, lineHeight: 1.6 }}>
        <div style={{ border: "1px dashed #000", padding: 8, margin: "10px 0", borderRadius: 4 }}>
          <p style={{ fontWeight: 700, marginBottom: 4, fontSize: 12 }}>ຂໍ້ມູນບັນຊີ</p>
          <Row label="ອີເມວ" value={signup.account_email} mono />
          {signup.account_password && <Row label="ລະຫັດຜ່ານ" value={signup.account_password} mono />}
          {signup.recovery_email && <Row label="ອີເມວກູ້ຄືນ" value={signup.recovery_email} mono />}
          {signup.recovery_phone && <Row label="ເບີກູ້ຄືນ" value={signup.recovery_phone} />}
          {signup.birthdate && <Row label="ວັນເດືອນປີເກີດ" value={signup.birthdate} />}
        </div>

        {Number(signup.service_fee) > 0 && (
          <Row label="ຄ່າບໍລິການ" value={`${Number(signup.service_fee).toLocaleString()} LAK`} />
        )}

        {signup.notes && (
          <div style={{ marginTop: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, margin: 0 }}>ໝາຍເຫດ:</p>
            <p style={{ fontSize: 11, margin: "2px 0" }}>{signup.notes}</p>
          </div>
        )}

        <div style={{ marginTop: 14, padding: 8, border: "1px solid #000", borderRadius: 4, fontSize: 10 }}>
          <p style={{ margin: 0, fontWeight: 700 }}>⚠ ກະລຸນາເກັບຮັກສາຂໍ້ມູນນີ້ໄວ້ໃຫ້ປອດໄພ</p>
          <p style={{ margin: "2px 0 0" }}>ບໍ່ຄວນແບ່ງປັນລະຫັດຜ່ານໃຫ້ກັບຜູ້ອື່ນ. ຮ້ານບໍ່ຮັບຜິດຊອບກໍລະນີຂໍ້ມູນຮົ່ວໄຫຼ ຫຼັງຈາກສົ່ງມອບໃຫ້ລູກຄ້າ.</p>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 30, fontSize: 11 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ borderTop: "1px solid #000", width: 140, marginBottom: 4 }} />
            <span>ພະນັກງານ</span>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ borderTop: "1px solid #000", width: 140, marginBottom: 4 }} />
            <span>ລູກຄ້າ</span>
          </div>
        </div>

        {settings.receipt_footer && (
          <p style={{ textAlign: "center", fontSize: 11, marginTop: 14, fontStyle: "italic" }}>{settings.receipt_footer}</p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ color: "#444" }}>{label}:</span>
      <span style={{ fontFamily: mono ? "monospace" : undefined, textAlign: "right", wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}
