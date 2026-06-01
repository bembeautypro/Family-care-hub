import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const roleSchema = z.enum(["admin", "editor", "viewer", "caregiver"]);

// ── 1. generateInviteLink ────────────────────────────────────────────────────
export const generateInviteLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        family_id: z.string().uuid(),
        role: roleSchema,
        email: z.string().email().optional(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Verify caller is admin of this family
    const { data: membership, error: memErr } = await supabaseAdmin
      .from("family_members")
      .select("id, role")
      .eq("family_id", data.family_id)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (memErr) throw new Error(memErr.message);
    if (!membership || membership.role !== "admin") {
      throw new Error("Apenas administradores podem gerar convites.");
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: invitation, error: invErr } = await supabaseAdmin
      .from("invitations")
      .insert({
        family_id: data.family_id,
        role: data.role,
        email: data.email ?? null,
        invited_by: userId,
        status: "pending",
        expires_at: expiresAt,
      })
      .select("token, expires_at")
      .single();

    if (invErr || !invitation) {
      throw new Error(invErr?.message ?? "Falha ao gerar convite.");
    }

    return { token: invitation.token as string, expiresAt: invitation.expires_at as string };
  });

// ── 2. acceptInvitation ──────────────────────────────────────────────────────
export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ token: z.string() })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Fetch invitation
    const { data: inv, error: invErr } = await supabaseAdmin
      .from("invitations")
      .select("id, family_id, role, invited_by, status, expires_at")
      .eq("token", data.token)
      .maybeSingle();

    if (invErr) throw new Error(invErr.message);
    if (!inv) throw new Error("Convite não encontrado.");
    if (inv.status !== "pending") throw new Error("Este convite já foi utilizado.");
    if (new Date(inv.expires_at as string) < new Date()) {
      throw new Error("Este convite expirou.");
    }

    // Check if user is already a member
    const { data: existing, error: existErr } = await supabaseAdmin
      .from("family_members")
      .select("id")
      .eq("family_id", inv.family_id as string)
      .eq("user_id", userId)
      .maybeSingle();

    if (existErr) throw new Error(existErr.message);
    if (existing) {
      return { alreadyMember: true, familyId: inv.family_id as string };
    }

    // Insert new member
    const { error: insertErr } = await supabaseAdmin.from("family_members").insert({
      family_id: inv.family_id as string,
      user_id: userId,
      role: inv.role as string,
      status: "active",
      invited_by: inv.invited_by as string,
    });
    if (insertErr) throw new Error(insertErr.message);

    // Mark invitation as accepted
    const { error: updateInvErr } = await supabaseAdmin
      .from("invitations")
      .update({ status: "accepted" })
      .eq("id", inv.id as string);
    if (updateInvErr) console.error("Failed to mark invitation accepted", updateInvErr);

    // Update onboarding_step to 3 if less than 3
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("onboarding_step")
      .eq("id", userId)
      .maybeSingle();

    const currentStep = profile?.onboarding_step ?? 0;
    if (currentStep < 3) {
      await supabaseAdmin
        .from("profiles")
        .update({ onboarding_step: 3 })
        .eq("id", userId);
    }

    return { alreadyMember: false, familyId: inv.family_id as string };
  });

// ── 3. changeMemberRole ──────────────────────────────────────────────────────
export const changeMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        member_id: z.string().uuid(),
        role: roleSchema,
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Fetch the target member to get family_id
    const { data: targetMember, error: targetErr } = await supabaseAdmin
      .from("family_members")
      .select("id, family_id, user_id, role")
      .eq("id", data.member_id)
      .eq("status", "active")
      .maybeSingle();

    if (targetErr) throw new Error(targetErr.message);
    if (!targetMember) throw new Error("Membro não encontrado.");

    // Verify caller is admin of that family
    const { data: callerMembership, error: callerErr } = await supabaseAdmin
      .from("family_members")
      .select("id, role")
      .eq("family_id", targetMember.family_id as string)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (callerErr) throw new Error(callerErr.message);
    if (!callerMembership || callerMembership.role !== "admin") {
      throw new Error("Apenas administradores podem alterar papéis.");
    }

    // Prevent the only admin from downgrading themselves
    if (
      targetMember.user_id === userId &&
      targetMember.role === "admin" &&
      data.role !== "admin"
    ) {
      const { count, error: countErr } = await supabaseAdmin
        .from("family_members")
        .select("id", { count: "exact", head: true })
        .eq("family_id", targetMember.family_id as string)
        .eq("role", "admin")
        .eq("status", "active");

      if (countErr) throw new Error(countErr.message);
      if ((count ?? 0) <= 1) {
        throw new Error("Você é o único administrador. Promova outro membro antes de alterar seu papel.");
      }
    }

    const { error: updateErr } = await supabaseAdmin
      .from("family_members")
      .update({ role: data.role })
      .eq("id", data.member_id);

    if (updateErr) throw new Error(updateErr.message);

    return { success: true };
  });

// ── 4. removeMember ──────────────────────────────────────────────────────────
export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ member_id: z.string().uuid() })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Fetch the target member
    const { data: targetMember, error: targetErr } = await supabaseAdmin
      .from("family_members")
      .select("id, family_id, user_id, role")
      .eq("id", data.member_id)
      .eq("status", "active")
      .maybeSingle();

    if (targetErr) throw new Error(targetErr.message);
    if (!targetMember) throw new Error("Membro não encontrado.");

    // Verify caller is admin of that family
    const { data: callerMembership, error: callerErr } = await supabaseAdmin
      .from("family_members")
      .select("id, role")
      .eq("family_id", targetMember.family_id as string)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (callerErr) throw new Error(callerErr.message);
    if (!callerMembership || callerMembership.role !== "admin") {
      throw new Error("Apenas administradores podem remover membros.");
    }

    // Prevent removing the only admin
    if (targetMember.role === "admin") {
      const { count, error: countErr } = await supabaseAdmin
        .from("family_members")
        .select("id", { count: "exact", head: true })
        .eq("family_id", targetMember.family_id as string)
        .eq("role", "admin")
        .eq("status", "active");

      if (countErr) throw new Error(countErr.message);
      if ((count ?? 0) <= 1) {
        throw new Error("Não é possível remover o único administrador da família.");
      }
    }

    const { error: updateErr } = await supabaseAdmin
      .from("family_members")
      .update({ status: "removed" })
      .eq("id", data.member_id);

    if (updateErr) throw new Error(updateErr.message);

    return { success: true };
  });
