import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Atualiza nome e telefone do perfil do usuário autenticado
export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        full_name: z.string().trim().min(2).max(100),
        phone: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        phone: data.phone ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", context.userId);

    if (error) {
      throw new Error(error.message);
    }
  });

// Exclui a conta do usuário autenticado.
// Lança SOLO_ADMIN se o usuário for o único admin de alguma família.
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Busca todas as famílias onde o usuário é admin ativo
    const { data: adminMemberships, error: fetchErr } = await supabaseAdmin
      .from("family_members")
      .select("family_id")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .eq("status", "active");

    if (fetchErr) {
      throw new Error(fetchErr.message);
    }

    const soloFamilies: string[] = [];

    for (const membership of adminMemberships ?? []) {
      if (!membership.family_id) continue;
      // Conta quantos admins ativos existem nessa família
      const { count, error: countErr } = await supabaseAdmin
        .from("family_members")
        .select("id", { count: "exact", head: true })
        .eq("family_id", membership.family_id)
        .eq("role", "admin")
        .eq("status", "active");

      if (countErr) {
        throw new Error(countErr.message);
      }

      // Se há apenas 1 admin (o próprio usuário), esta é uma família solo
      if ((count ?? 0) <= 1) {
        soloFamilies.push(membership.family_id);
      }
    }

    if (soloFamilies.length > 0) {
      throw new Error("SOLO_ADMIN");
    }

    const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(
      context.userId,
    );

    if (deleteErr) {
      throw new Error(deleteErr.message);
    }
  });
