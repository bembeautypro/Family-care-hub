import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createFamilySchema = z.object({
  name: z.string().trim().min(2).max(100),
  role: z.enum(["filho", "conjuge", "cuidador", "outro"]),
});

// Creates a family and inserts the current user as its admin in one atomic
// server-side step. Uses supabaseAdmin to bypass RLS for the bootstrap
// family_members row (the "admins can manage family_members" policy can't
// authorize the very first admin row for the family).
export const createFamilyWithAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createFamilySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;

    const { data: family, error: famErr } = await supabaseAdmin
      .from("families")
      .insert({ name: data.name, created_by: userId })
      .select("id")
      .single();
    if (famErr || !family) {
      throw new Error(famErr?.message ?? "Falha ao criar família");
    }

    const { error: memErr } = await supabaseAdmin
      .from("family_members")
      .insert({
        family_id: family.id,
        user_id: userId,
        role: "admin",
        status: "active",
        invited_by: userId,
      });
    if (memErr) {
      // best-effort rollback
      await supabaseAdmin.from("families").delete().eq("id", family.id);
      throw new Error(memErr.message);
    }

    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .update({ onboarding_step: 1 })
      .eq("id", userId);
    if (profErr) {
      console.error("profiles.onboarding_step update failed", profErr);
    }

    return { familyId: family.id, role: data.role };
  });
