import { createFileRoute } from "@tanstack/react-router";

// JWT HS256 verify (compatible with sign() in send-medication-reminders).

function b64urlDecode(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function verifyJwt(token: string, secret: string): Promise<Record<string, unknown> | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    b64urlDecode(s),
    new TextEncoder().encode(`${h}.${p}`),
  );
  if (!ok) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(p))) as Record<string, unknown>;
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/public/hooks/dose-action")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.DOSE_ACTION_JWT_SECRET;
        if (!secret) return new Response("Server misconfigured", { status: 500 });

        let body: { token?: string; status?: string };
        try {
          body = (await request.json()) as { token?: string; status?: string };
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        if (!body.token || !body.status) {
          return new Response("Missing token or status", { status: 400 });
        }
        const status = body.status === "taken" ? "taken" : body.status === "skipped" ? "skipped" : null;
        if (!status) return new Response("Invalid status", { status: 400 });

        const claims = await verifyJwt(body.token, secret);
        if (!claims) return new Response("Invalid token", { status: 401 });

        const medicationId = claims.medication_id as string | undefined;
        const userId = claims.user_id as string | undefined;
        const patientId = claims.patient_id as string | undefined;
        const scheduledFor = claims.scheduled_for as string | undefined;
        if (!medicationId || !userId || !patientId || !scheduledFor) {
          return new Response("Malformed token", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("medication_doses").insert({
          medication_id: medicationId,
          patient_id: patientId,
          scheduled_at: scheduledFor,
          taken_at: new Date().toISOString(),
          taken_by: userId,
          status,
        });
        if (error) {
          console.error("[dose-action] insert failed", error);
          return new Response("Insert failed", { status: 500 });
        }
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});

// Helper for signing tokens (used by send-medication-reminders).
export async function signDoseActionToken(claims: {
  medication_id: string;
  user_id: string;
  patient_id: string;
  scheduled_for: string;
}): Promise<string> {
  const secret = process.env.DOSE_ACTION_JWT_SECRET!;
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    ...claims,
    exp: Math.floor(Date.now() / 1000) + 60 * 30,
  };
  const enc = (o: unknown) =>
    b64urlEncode(new TextEncoder().encode(JSON.stringify(o)));
  const signingInput = `${enc(header)}.${enc(payload)}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${b64urlEncode(sig)}`;
}
