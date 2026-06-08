import { createServerFn } from "@tanstack/react-start";

// Normalize phone to E.164 (default LA = +856)
function toE164(raw: string, defaultCc = "856"): string | null {
  if (!raw) return null;
  let p = raw.replace(/[^\d+]/g, "");
  if (p.startsWith("+")) return p;
  if (p.startsWith("00")) return "+" + p.slice(2);
  if (p.startsWith("0")) return "+" + defaultCc + p.slice(1);
  if (p.startsWith(defaultCc)) return "+" + p;
  return "+" + defaultCc + p;
}

export const sendRepairSms = createServerFn({ method: "POST" })
  .inputValidator((data: { phone: string; message: string }) => {
    if (!data?.phone || !data?.message) throw new Error("phone and message are required");
    if (data.message.length > 1000) throw new Error("message too long");
    return data;
  })
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const TWILIO_API_KEY = process.env.TWILIO_API_KEY;
    const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER;

    if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
      throw new Error("ຍັງບໍ່ໄດ້ເຊື່ອມຕໍ່ Twilio — ກະລຸນາເຊື່ອມຕໍ່ໃນໜ້າ Connectors ກ່ອນ");
    }
    if (!TWILIO_FROM) {
      throw new Error("ຍັງບໍ່ໄດ້ຕັ້ງເບີສົ່ງ (TWILIO_FROM_NUMBER)");
    }

    const to = toE164(data.phone);
    if (!to) throw new Error("ເບີໂທບໍ່ຖືກຕ້ອງ");

    const res = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: data.message }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Twilio error [${res.status}]: ${body?.message || JSON.stringify(body)}`);
    }
    return { sid: body.sid as string, to };
  });
