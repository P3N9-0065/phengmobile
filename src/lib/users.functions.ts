import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ROLES = ["admin", "cashier", "technician", "warehouse"] as const;

const CreateStaffSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(72).optional().nullable(),
  fullName: z.string().min(1).max(120),
  phone: z.string().max(40).optional().nullable(),
  roles: z.array(z.enum(ROLES)).min(1).max(4),
  sendInvite: z.boolean().default(false),
});

export const createStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateStaffSchema.parse(d))
  .handler(async ({ data, context }) => {
    // Verify caller is admin
    const { data: roles, error: roleErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleErr) throw new Error(roleErr.message);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) throw new Error("ບໍ່ມີສິດ — ສະເພາະຜູ້ຄຸ້ມຄອງ");

    let userId: string | null = null;
    let tempPassword: string | null = null;

    if (data.sendInvite) {
      const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        data.email,
        { data: { full_name: data.fullName } }
      );
      if (error) throw new Error(error.message);
      userId = invited.user?.id ?? null;
    } else {
      const pwd =
        data.password && data.password.length >= 8
          ? data.password
          : `Tmp-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
      tempPassword = data.password ? null : pwd;
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: pwd,
        email_confirm: true,
        user_metadata: { full_name: data.fullName },
      });
      if (error) throw new Error(error.message);
      userId = created.user?.id ?? null;
    }

    if (!userId) throw new Error("ສ້າງບັນຊີບໍ່ສຳເລັດ");

    // Update profile (trigger creates it). Use admin client to bypass RLS.
    await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.fullName, phone: data.phone ?? null })
      .eq("id", userId);

    // Reset roles to requested set (trigger defaults to cashier)
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    const rows = data.roles.map((role) => ({ user_id: userId!, role }));
    const { error: insErr } = await supabaseAdmin.from("user_roles").insert(rows);
    if (insErr) throw new Error(insErr.message);

    return { userId, tempPassword };
  });
