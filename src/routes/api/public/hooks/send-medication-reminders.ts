import { createFileRoute } from "@tanstack/react-router";
import { sendWebPush } from "@/lib/push.server";
import { signDoseActionToken } from "./dose-action";

// Cron-invoked endpoint. Scans active medications whose schedule.times
// match the current 10-min window (in the patient's timezone) and sends
// push notifications to all active family caregivers.

type ScheduleShape = { times?: string[] };

function hhmmInTz(date: Date, tz: string): string {
  // Returns "HH:mm" in the given IANA timezone.
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return fmt.format(date);
}

function minutesBetween(a: string, b: string): number {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return (ah * 60 + am) - (bh * 60 + bm);
}

export const Route = createFileRoute("/api/public/hooks/send-medication-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Auth: cron must present the project's publishable key in `apikey` header.
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        const apikey = request.headers.get("apikey") ?? "";
        if (!expected || apikey.length !== expected.length) {
          return new Response("Unauthorized", { status: 401 });
        }
        // Timing-safe compare
        let diff = 0;
        for (let i = 0; i < expected.length; i++) {
          diff |= apikey.charCodeAt(i) ^ expected.charCodeAt(i);
        }
        if (diff !== 0) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const now = new Date();
        const windowMinutes = 6; // [now-1, now+5]

        const { data: meds, error: medsErr } = await supabaseAdmin
          .from("medications")
          .select("id, patient_id, name, dosage, schedule, status, start_date, end_date, patients!inner(id, family_id, name, timezone)")
          .eq("status", "active")
          .is("deleted_at", null);

        if (medsErr) {
          console.error("[reminders] fetch meds failed", medsErr);
          return Response.json({ ok: false, error: medsErr.message }, { status: 500 });
        }

        let sent = 0;
        let skipped = 0;

        for (const med of meds ?? []) {
          const patient = (med as unknown as { patients: { id: string; family_id: string; name: string; timezone: string } }).patients;
          if (!patient) continue;
          const sched = (med.schedule ?? null) as ScheduleShape | null;
          const times = sched?.times ?? [];
          if (!times.length) continue;

          const tz = patient.timezone || "America/Sao_Paulo";
          const nowHHMM = hhmmInTz(now, tz);

          // Find times within [-1, +5] minutes window.
          const matched = times.filter((t) => {
            const diff = minutesBetween(nowHHMM, t);
            return diff >= -1 && diff <= 5;
          });
          if (!matched.length) continue;

          for (const t of matched) {
            // Compute scheduled_for as today's date in TZ at HH:mm.
            const dateInTz = new Intl.DateTimeFormat("sv-SE", {
              timeZone: tz,
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(now);
            const scheduledFor = new Date(`${dateInTz}T${t}:00${tzOffsetStr(now, tz)}`);
            const scheduledIso = scheduledFor.toISOString();

            // Insert log row; UNIQUE prevents duplicates.
            const { error: logErr } = await supabaseAdmin
              .from("medication_reminder_log")
              .insert({
                medication_id: med.id,
                scheduled_for: scheduledIso,
                status: "sent",
                recipient_count: 0,
              });
            if (logErr) {
              // 23505 = unique violation → already dispatched
              if (logErr.code === "23505") {
                skipped++;
                continue;
              }
              console.error("[reminders] log insert error", logErr);
              continue;
            }

            // Gather active caregivers of this family.
            const { data: members } = await supabaseAdmin
              .from("family_members")
              .select("user_id, role")
              .eq("family_id", patient.family_id)
              .eq("status", "active");

            const caregiverIds = (members ?? [])
              .filter((m) => m.role === "admin" || m.role === "co_caregiver" || m.role === "caregiver")
              .map((m) => m.user_id)
              .filter((id): id is string => !!id);

            if (!caregiverIds.length) continue;

            const { data: subs } = await supabaseAdmin
              .from("push_subscriptions")
              .select("id, user_id, endpoint, p256dh, auth")
              .in("user_id", caregiverIds)
              .is("disabled_at", null);

            let recipients = 0;
            for (const sub of subs ?? []) {
              const token = await signDoseActionToken({
                medication_id: med.id,
                user_id: sub.user_id,
                patient_id: patient.id,
                scheduled_for: scheduledIso,
              });
              const payload = {
                title: `Hora do remédio · ${patient.name}`,
                body: `${med.name}${med.dosage ? ` — ${med.dosage}` : ""} (${t})`,
                tag: `med-${med.id}-${t}`,
                data: { url: "/dashboard", actionToken: token },
                actions: [
                  { action: "taken", title: "Tomei" },
                  { action: "skipped", title: "Não tomei" },
                ],
              };
              try {
                const res = await sendWebPush(sub, payload);
                if (res.gone) {
                  await supabaseAdmin
                    .from("push_subscriptions")
                    .update({ disabled_at: new Date().toISOString() })
                    .eq("id", sub.id);
                } else if (res.ok) {
                  recipients++;
                  sent++;
                }
              } catch (err) {
                console.error("[reminders] push failed", err);
              }
            }

            await supabaseAdmin
              .from("medication_reminder_log")
              .update({ recipient_count: recipients })
              .eq("medication_id", med.id)
              .eq("scheduled_for", scheduledIso);
          }
        }

        return Response.json({ ok: true, sent, skipped });
      },
    },
  },
});

// Build a "+HH:MM" / "-HH:MM" offset string for the given instant in the given IANA TZ.
function tzOffsetStr(at: Date, tz: string): string {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  const diffMin = Math.round((asUtc - at.getTime()) / 60000);
  const sign = diffMin >= 0 ? "+" : "-";
  const abs = Math.abs(diffMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}
