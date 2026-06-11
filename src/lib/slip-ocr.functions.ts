import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Public server fn: verifies a payment slip for a given order using AI vision OCR.
// Anyone can call it (customer right after upload, or admin "re-verify" button),
// but we only act on the slip_url stored on the order — never trust client-provided URLs.
export const verifySlip = createServerFn({ method: "POST" })
  .inputValidator((data: { orderId: string; force?: boolean }) =>
    z.object({ orderId: z.string().uuid(), force: z.boolean().optional() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("shop_orders")
      .select("id, order_code, total, subtotal, slip_url, slip_verify_status")
      .eq("id", data.orderId)
      .maybeSingle();
    if (orderErr) throw new Error(orderErr.message);
    if (!order) throw new Error("Order not found");
    if (!order.slip_url) {
      await supabaseAdmin
        .from("shop_orders")
        .update({ slip_verify_status: "no_slip", slip_verify_note: "ບໍ່ມີສະລິບ" } as any)
        .eq("id", order.id);
      return { status: "no_slip" as const };
    }
    if (!data.force && order.slip_verify_status && order.slip_verify_status !== "pending") {
      return { status: order.slip_verify_status, cached: true };
    }

    // Download slip
    const { data: blob, error: dlErr } = await supabaseAdmin.storage
      .from("payment-slips")
      .download(order.slip_url);
    if (dlErr || !blob) throw new Error(dlErr?.message || "Cannot download slip");

    const ab = await blob.arrayBuffer();
    const bytes = new Uint8Array(ab);
    // SHA-256 hash for duplicate detection
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hash = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Duplicate check (other order using same slip)
    const { data: dupes } = await supabaseAdmin
      .from("shop_orders")
      .select("id, order_code")
      .eq("slip_hash", hash)
      .neq("id", order.id)
      .limit(1);

    // Base64-encode for Gateway
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const b64 = btoa(bin);
    const mime = blob.type || "image/jpeg";
    const dataUrl = `data:${mime};base64,${b64}`;

    // Fetch shop bank for matching context
    const { data: bankRow } = await supabaseAdmin
      .from("shop_bank_settings" as any)
      .select("bank_name, account_name, account_number")
      .eq("id", 1)
      .maybeSingle();
    const bank = bankRow as { bank_name?: string | null; account_name?: string | null; account_number?: string | null } | null;

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const prompt = `ນີ້ແມ່ນສະລິບໂອນເງິນຂອງທະນາຄານ (ສ່ວນຫຼາຍແມ່ນ BCEL/LDB/JDB ໃນລາວ). ສະກັດຂໍ້ມູນຕໍ່ໄປນີ້ເປັນ JSON ເທົ່ານັ້ນ:
{
  "amount": number | null,           // ຈຳນວນເງິນເປັນ LAK (ຕົວເລກລ້ວນ, ບໍ່ມີຈຸດ ຫຼື ສະກຸນເງິນ)
  "currency": "LAK" | "USD" | "THB" | null,
  "reference": string | null,        // ເລກອ້າງອີງ/Transaction ID
  "bank": string | null,             // ຊື່ທະນາຄານ
  "sender_name": string | null,
  "receiver_name": string | null,
  "receiver_account": string | null, // ເລກບັນຊີຜູ້ຮັບ (ຖ້າມີ)
  "date": string | null,             // ISO 8601 ຖ້າຮູ້ເວລາ, ບໍ່ດັ່ງນັ້ນ YYYY-MM-DD
  "is_payment_slip": boolean,        // false ຖ້າຮູບບໍ່ແມ່ນສະລິບໂອນເງິນ
  "readable": boolean,               // false ຖ້າຮູບເບລີຫຼາຍ/ອ່ານບໍ່ໄດ້
  "confidence": number               // 0..1
}
ຄຳສັ່ງ: ຕອບເປັນ JSON object ດຽວເທົ່ານັ້ນ, ບໍ່ມີຄຳອະທິບາຍຫຼື markdown.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      const note = aiRes.status === 429 ? "AI ຖືກຈຳກັດອັດຕາ" : aiRes.status === 402 ? "AI credits ໝົດ" : `AI error ${aiRes.status}`;
      await supabaseAdmin
        .from("shop_orders")
        .update({ slip_hash: hash, slip_verify_status: "error", slip_verify_note: note } as any)
        .eq("id", order.id);
      return { status: "error" as const, http: aiRes.status, body: txt.slice(0, 300) };
    }

    const aiJson: any = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let ocr: any = {};
    try {
      ocr = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      ocr = { _raw: String(raw).slice(0, 500) };
    }

    // Classify
    let status: "matched" | "mismatch" | "duplicate" | "unreadable" | "not_slip" | "pending" = "pending";
    const notes: string[] = [];

    if (dupes && dupes.length > 0) {
      status = "duplicate";
      notes.push(`ສະລິບຊ້ຳກັບໃບສັ່ງ ${dupes[0].order_code}`);
    } else if (ocr.is_payment_slip === false) {
      status = "not_slip";
      notes.push("ຮູບບໍ່ແມ່ນສະລິບໂອນເງິນ");
    } else if (ocr.readable === false) {
      status = "unreadable";
      notes.push("ອ່ານສະລິບບໍ່ໄດ້");
    } else {
      const expected = Number(order.total || order.subtotal || 0);
      const got = Number(ocr.amount);
      if (Number.isFinite(got) && expected > 0) {
        const diff = Math.abs(got - expected);
        const tol = Math.max(500, expected * 0.01); // 1% or 500 LAK
        if (diff <= tol) {
          status = "matched";
          notes.push(`ຈຳນວນເງິນຕົງ (${got.toLocaleString()} LAK)`);
        } else {
          status = "mismatch";
          notes.push(`ຍອດບໍ່ຕົງ: ສະລິບ ${got.toLocaleString()} / ຄາດໝາຍ ${expected.toLocaleString()}`);
        }
      } else {
        status = "unreadable";
        notes.push("ບໍ່ສາມາດອ່ານຈຳນວນເງິນ");
      }

      // Receiver account check (soft warning)
      if (status === "matched" && bank?.account_number && ocr.receiver_account) {
        const a = String(bank.account_number).replace(/\D/g, "");
        const b = String(ocr.receiver_account).replace(/\D/g, "");
        if (a && b && !b.endsWith(a.slice(-6))) {
          notes.push(`⚠️ ບັນຊີຜູ້ຮັບອາດບໍ່ຕົງ (${ocr.receiver_account})`);
        }
      }
    }

    const update: any = {
      slip_hash: hash,
      slip_ocr: ocr,
      slip_amount: Number.isFinite(Number(ocr.amount)) ? Number(ocr.amount) : null,
      slip_ref: ocr.reference ?? null,
      slip_bank: ocr.bank ?? null,
      slip_date: ocr.date ? new Date(ocr.date).toISOString() : null,
      slip_verify_status: status,
      slip_verify_note: notes.join(" • "),
      slip_verified_at: new Date().toISOString(),
    };
    const { error: updErr } = await supabaseAdmin.from("shop_orders").update(update).eq("id", order.id);
    if (updErr) throw new Error(updErr.message);

    return { status, note: update.slip_verify_note, ocr };
  });
