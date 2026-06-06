import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const logEmergencyAccessSchema = z.object({
  token: z.string(),
  ip_address: z.string(),
  user_agent: z.string(),
});

export const logEmergencyAccess = createServerFn({ method: "POST" })
  .inputValidator((input) => logEmergencyAccessSchema.parse(input))
  .handler(async ({ data }) => {
    const { token, ip_address, user_agent } = data;

    // 1. Busca emergency_link pelo token
    const { data: link, error: linkErr } = await supabaseAdmin
      .from("emergency_links")
      .select("id, patient_id, is_active, expires_at, access_count")
      .eq("token", token)
      .single();

    if (linkErr || !link || !link.patient_id) {
      throw new Error("LINK_INVALID");
    }
    const patientId = link.patient_id;


    // 2. Valida is_active e expiração
    const isExpired =
      link.expires_at !== null && new Date(link.expires_at) <= new Date();
    if (!link.is_active || isExpired) {
      throw new Error("LINK_INVALID");
    }

    // 3. INSERT em access_logs
    await supabaseAdmin.from("access_logs").insert({
      emergency_link_id: link.id,
      patient_id: link.patient_id,
      action: "emergency_view",
      resource_type: "emergency_link",
      resource_id: link.id,
      ip_address,
      user_agent,
    });

    // 4. UPDATE access_count
    await supabaseAdmin
      .from("emergency_links")
      .update({ access_count: (link.access_count ?? 0) + 1 })
      .eq("id", link.id);

    // 5. Busca dados do paciente com selects separados (parallel)
    const [
      patientRes,
      allergiesRes,
      medicationsRes,
      conditionsRes,
      contactsRes,
      documentsRes,
    ] = await Promise.all([
      supabaseAdmin
        .from("patients")
        .select(
          "id, name, photo_url, birth_date, blood_type, health_insurance_name, health_insurance_number, preferred_hospital"
        )
        .eq("id", patientId)
        .single(),
      supabaseAdmin
        .from("patient_allergies")
        .select("allergy, severity")
        .eq("patient_id", patientId)
        .is("deleted_at", null),
      supabaseAdmin
        .from("medications")
        .select("name, generic_name, dosage, frequency")
        .eq("patient_id", patientId)
        .eq("status", "active")
        .is("deleted_at", null),
      supabaseAdmin
        .from("patient_conditions")
        .select("name, status")
        .eq("patient_id", patientId)
        .eq("status", "active")
        .is("deleted_at", null),
      supabaseAdmin
        .from("emergency_contacts")
        .select("name, relationship, phone, priority")
        .eq("patient_id", patientId)
        .is("deleted_at", null)
        .order("priority", { ascending: true }),
      supabaseAdmin
        .from("documents")
        .select("id, title, type, file_path, document_date")
        .eq("patient_id", patientId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const patient = patientRes.data;
    if (!patient) {
      throw new Error("LINK_INVALID");
    }

    // 6. Gera signed URLs para documentos
    const documents = documentsRes.data ?? [];
    const documentUrls: { title: string; type: string; signed_url: string }[] =
      [];
    for (const doc of documents) {
      if (!doc.file_path) continue;
      const { data: signedData } = await supabaseAdmin.storage
        .from("medical-documents")
        .createSignedUrl(doc.file_path, 3600);
      if (signedData?.signedUrl) {
        documentUrls.push({
          title: doc.title,
          type: doc.type ?? "",
          signed_url: signedData.signedUrl,
        });
      }
    }

    return {
      patient,
      allergies: allergiesRes.data ?? [],
      medications: medicationsRes.data ?? [],
      conditions: conditionsRes.data ?? [],
      contacts: contactsRes.data ?? [],
      document_urls: documentUrls,
    };
  });
