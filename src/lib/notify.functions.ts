import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { phone: string; message: string; ticketId: string }) => {
    if (!data?.phone || !data?.message || !data?.ticketId)
      throw new Error("phone, message and ticketId are required");
    if (data.message.length > 1000) throw new Error("message too long");
    return data;
  })
  .handler(async ({ data, context }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const TWILIO_API_KEY = process.env.TWILIO_API_KEY;
    const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER;
    const { supabase, userId } = context;

    const log = async (
      recipient: string,
      status: "sent" | "failed",
      extra: { error?: string; provider_sid?: string | null } = {},
    ) => {
      await supabase.from("notification_logs" as any).insert({
        ticket_id: data.ticketId,
        channel: "sms",
        recipient,
        message: data.message,
        status,
        error: extra.error ?? null,
        provider_sid: extra.provider_sid ?? null,
        created_by: userId,
      });
    };

    if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
      const err = "ຍັງບໍ່ໄດ້ເຊື່ອມຕໍ່ Twilio — ກະລຸນາເຊື່ອມຕໍ່ໃນໜ້າ Connectors ກ່ອນ";
      await log(data.phone, "failed", { error: err });
      throw new Error(err);
    }
    if (!TWILIO_FROM) {
      const err = "ຍັງບໍ່ໄດ້ຕັ້ງເບີສົ່ງ (TWILIO_FROM_NUMBER)";
      await log(data.phone, "failed", { error: err });
      throw new Error(err);
    }

    const to = toE164(data.phone);
    if (!to) {
      const err = "ເບີໂທບໍ່ຖືກຕ້ອງ";
      await log(data.phone, "failed", { error: err });
      throw new Error(err);
    }

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
      const err = `Twilio error [${res.status}]: ${body?.message || JSON.stringify(body)}`;
      await log(to, "failed", { error: err });
      throw new Error(err);
    }

    await log(to, "sent", { provider_sid: body.sid ?? null });
    return { sid: body.sid as string, to };
  });
