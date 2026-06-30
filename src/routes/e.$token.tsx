import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Phone, AlertTriangle, Pill, ClipboardList, Building2, FileText } from "lucide-react";

import { logEmergencyAccess } from "@/functions/emergency.functions";

export const Route = createFileRoute("/e/$token")({
  head: () => ({ meta: [{ title: "Cartão de Emergência — Amparo" }] }),
  component: PublicEmergencyPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type PatientData = {
  id: string;
  name: string;
  photo_url: string | null;
  birth_date: string | null;
  blood_type: string | null;
  health_insurance_name: string | null;
  health_insurance_number: string | null;
  preferred_hospital: string | null;
};

type Allergy = {
  allergy: string;
  severity: string | null;
};

type Medication = {
  name: string;
  generic_name: string | null;
  dosage: string | null;
  frequency: string | null;
};

type Condition = {
  name: string;
  status: string | null;
};

type Contact = {
  name: string;
  relationship: string | null;
  phone: string | null;
  priority: number | null;
};

type DocumentUrl = {
  title: string;
  type: string;
  signed_url: string;
};

type EmergencyData = {
  patient: PatientData;
  allergies: Allergy[];
  medications: Medication[];
  conditions: Condition[];
  contacts: Contact[];
  document_urls: DocumentUrl[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-600 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-yellow-400 text-yellow-900",
  low: "bg-gray-200 text-gray-700",
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Moderada",
  low: "Leve",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1;
  return age;
}

function cacheKey(token: string) {
  return `emergency_cache_${token}`;
}

function saveCache(token: string, data: EmergencyData) {
  try {
    localStorage.setItem(
      cacheKey(token),
      JSON.stringify({ data, ts: Date.now() })
    );
  } catch {
    // quota exceeded — ignore
  }
}

function loadCache(token: string): EmergencyData | null {
  try {
    const raw = localStorage.getItem(cacheKey(token));
    if (!raw) return null;
    const parsed: { data: EmergencyData; ts: number } = JSON.parse(raw);
    if (Date.now() - parsed.ts > CACHE_TTL_MS) {
      localStorage.removeItem(cacheKey(token));
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  return (
    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-red-100 text-3xl font-bold text-red-700 ring-4 ring-red-200">
      {initials}
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-8 animate-pulse">
      <div className="flex flex-col items-center gap-3">
        <div className="h-24 w-24 rounded-full bg-gray-200" />
        <div className="h-6 w-48 rounded bg-gray-200" />
        <div className="h-8 w-16 rounded-full bg-gray-200" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl bg-gray-100 p-4">
          <div className="mb-3 h-5 w-32 rounded bg-gray-200" />
          <div className="space-y-2">
            <div className="h-4 w-full rounded bg-gray-200" />
            <div className="h-4 w-3/4 rounded bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Invalid link screen ──────────────────────────────────────────────────────

function InvalidLink() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
      <svg
        className="mb-6 h-16 w-16 text-gray-300"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M18.364 5.636a9 9 0 11-12.728 0M12 3v9"
        />
      </svg>
      <h1 className="text-2xl font-bold text-gray-800">
        Link não disponível
      </h1>
      <p className="mt-3 text-base text-gray-500">
        Este link de emergência foi desativado ou expirou.
        <br />
        Solicite um novo link ao cuidador do paciente.
      </p>
      <p className="mt-10 text-sm font-semibold tracking-widest text-red-600 uppercase">
        Amparo
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function ConfirmGate({ onConfirm }: { onConfirm: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
        <AlertTriangle className="h-10 w-10 text-red-600" />
      </div>
      <p className="text-sm font-bold uppercase tracking-widest text-red-600">
        Amparo · Emergência
      </p>
      <h1 className="mt-4 text-2xl font-bold text-gray-900">
        Acesso ao cartão de emergência
      </h1>
      <p className="mt-3 max-w-sm text-base text-gray-600">
        Você está prestes a visualizar dados clínicos sensíveis (alergias,
        medicamentos, condições e documentos). <strong>Cada acesso é
        registrado</strong> e notificado aos cuidadores responsáveis.
      </p>
      <p className="mt-2 max-w-sm text-sm text-gray-500">
        Confirme apenas se você é um profissional de saúde, socorrista ou
        responsável atendendo o paciente neste momento.
      </p>
      <button
        type="button"
        onClick={onConfirm}
        className="mt-8 inline-flex min-h-[52px] w-full max-w-xs items-center justify-center rounded-xl bg-red-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-red-700 active:bg-red-800"
      >
        Confirmar acesso de emergência
      </button>
      <p className="mt-6 text-xs text-gray-400">
        Ao continuar, o IP e o dispositivo serão registrados no log de auditoria.
      </p>
    </div>
  );
}

function PublicEmergencyPage() {
  const { token } = Route.useParams();

  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [offline, setOffline] = useState(false);
  const [data, setData] = useState<EmergencyData | null>(null);

  useEffect(() => {
    if (!confirmed) return;
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

      if (!isOnline) {
        const cached = loadCache(token);
        if (cancelled) return;
        if (cached) {
          setData(cached);
          setOffline(true);
        } else {
          setInvalid(true);
        }
        setLoading(false);
        return;
      }

      try {
        const result = await logEmergencyAccess({
          data: {
            token,
            ip_address: "",
            user_agent:
              typeof navigator !== "undefined" ? navigator.userAgent : "",
          },
        });
        if (cancelled) return;
        saveCache(token, result);
        setData(result);
      } catch (err) {
        if (cancelled) return;
        const cached = loadCache(token);
        if (cached) {
          setData(cached);
          setOffline(true);
        } else {
          setInvalid(true);
        }
        void err;
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchData();
    return () => {
      cancelled = true;
    };
  }, [confirmed, token]);

  if (!confirmed) return <ConfirmGate onConfirm={() => setConfirmed(true)} />;
  if (loading) return <LoadingSkeleton />;
  if (invalid || !data) return <InvalidLink />;

  const { patient, allergies, medications, conditions, contacts, document_urls } = data;
  const age = calcAge(patient.birth_date);

  return (
    <div className="min-h-screen bg-white text-base">
      {/* ── Offline banner ── */}
      {offline && (
        <div className="flex items-center gap-2 bg-orange-500 px-4 py-3 text-base font-medium text-white">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>
            Você está offline. Estas informações podem não estar atualizadas.
          </span>
        </div>
      )}

      {/* ── Header / Logo ── */}
      <header className="border-b px-4 py-3">
        <p className="text-sm font-bold uppercase tracking-widest text-red-600">
          Amparo
        </p>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 pb-12 pt-6">
        {/* ── Seção 1: Identificação ── */}
        <section className="flex flex-col items-center gap-3 pb-4 text-center">
          {patient.photo_url ? (
            <img
              src={patient.photo_url}
              alt={patient.name}
              className="h-24 w-24 rounded-full object-cover ring-4 ring-red-200"
            />
          ) : (
            <Initials name={patient.name} />
          )}

          <div>
            <h1 className="text-2xl font-bold text-gray-900">{patient.name}</h1>
            {age !== null && (
              <p className="mt-0.5 text-base text-gray-500">{age} anos</p>
            )}
          </div>

          {patient.blood_type && (
            <span className="inline-flex items-center rounded-full bg-red-600 px-5 py-1.5 text-lg font-bold text-white ring-2 ring-red-300">
              {patient.blood_type}
            </span>
          )}
        </section>

        {/* ── Seção 2: Alergias ── */}
        <section className="rounded-xl bg-red-50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-700" />
            <h2 className="text-base font-bold uppercase tracking-wide text-red-800">
              Alergias
            </h2>
          </div>

          {allergies.length === 0 ? (
            <p className="text-base font-medium text-green-700">
              Nenhuma alergia cadastrada
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {allergies.map((a, i) => {
                const sev = a.severity ?? "low";
                const colorClass = SEVERITY_BADGE[sev] ?? SEVERITY_BADGE.low;
                const label = SEVERITY_LABEL[sev] ?? sev;
                return (
                  <span
                    key={`${a.allergy}-${i}`}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-base font-semibold ${colorClass}`}
                  >
                    {a.allergy}
                    <span className="text-xs font-normal opacity-80">
                      ({label})
                    </span>
                  </span>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Seção 3: Medicamentos ── */}
        {medications.length > 0 && (
          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Pill className="h-5 w-5 shrink-0 text-blue-600" />
              <h2 className="text-base font-bold text-gray-800">
                Medicamentos em uso
              </h2>
            </div>
            <ul className="space-y-3">
              {medications.map((m, i) => (
                <li key={`${m.name}-${i}`} className="text-base text-gray-800">
                  <span className="font-semibold">{m.name}</span>
                  {m.generic_name && (
                    <span className="text-gray-500"> ({m.generic_name})</span>
                  )}
                  {m.dosage && (
                    <span className="text-gray-600"> — {m.dosage}</span>
                  )}
                  {m.frequency && (
                    <span className="text-gray-500"> · {m.frequency}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Seção 4: Condições médicas ── */}
        {conditions.length > 0 && (
          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 shrink-0 text-purple-600" />
              <h2 className="text-base font-bold text-gray-800">
                Condições de saúde
              </h2>
            </div>
            <ul className="space-y-2">
              {conditions.map((c, i) => (
                <li
                  key={`${c.name}-${i}`}
                  className="text-base font-medium text-gray-800"
                >
                  {c.name}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Seção 5: Convênio e hospital ── */}
        {(patient.health_insurance_name ||
          patient.health_insurance_number ||
          patient.preferred_hospital) && (
          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Building2 className="h-5 w-5 shrink-0 text-teal-600" />
              <h2 className="text-base font-bold text-gray-800">
                Convênio e hospital
              </h2>
            </div>
            <dl className="space-y-1.5 text-base text-gray-800">
              {patient.health_insurance_name && (
                <div className="flex gap-2">
                  <dt className="font-semibold shrink-0">Convênio:</dt>
                  <dd>{patient.health_insurance_name}</dd>
                </div>
              )}
              {patient.health_insurance_number && (
                <div className="flex gap-2">
                  <dt className="font-semibold shrink-0">Carteirinha:</dt>
                  <dd>{patient.health_insurance_number}</dd>
                </div>
              )}
              {patient.preferred_hospital && (
                <div className="flex gap-2">
                  <dt className="font-semibold shrink-0">Hospital de preferência:</dt>
                  <dd>{patient.preferred_hospital}</dd>
                </div>
              )}
            </dl>
          </section>
        )}

        {/* ── Seção 6: Contatos de emergência ── */}
        {contacts.length > 0 && (
          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Phone className="h-5 w-5 shrink-0 text-green-600" />
              <h2 className="text-base font-bold text-gray-800">
                Contatos de emergência
              </h2>
            </div>
            <ul className="space-y-3">
              {contacts.filter((c) => !!c.phone).map((c, i) => (
                <li
                  key={`${c.name}-${i}`}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-gray-800">
                      {c.name}
                    </p>
                    {c.relationship && (
                      <p className="text-sm text-gray-500">{c.relationship}</p>
                    )}
                    <p className="text-base text-gray-700">{c.phone}</p>
                  </div>
                  <a
                    href={`tel:${(c.phone ?? "").replace(/\D/g, "")}`}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-green-600 px-4 py-2 text-base font-semibold text-white hover:bg-green-700 active:bg-green-800"
                  >
                    <Phone className="h-4 w-4" />
                    Ligar
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Seção 7: Documentos ── */}
        {document_urls.length > 0 && (
          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <FileText className="h-5 w-5 shrink-0 text-gray-600" />
              <h2 className="text-base font-bold text-gray-800">Documentos</h2>
            </div>
            <ul className="space-y-3">
              {document_urls.map((doc, i) => (
                <li
                  key={`${doc.title}-${i}`}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium text-gray-800">
                      {doc.title}
                    </p>
                    {doc.type && (
                      <p className="text-sm capitalize text-gray-500">
                        {doc.type}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => window.open(doc.signed_url, "_blank", "noopener,noreferrer")}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gray-800 px-4 py-2 text-base font-semibold text-white hover:bg-gray-700 active:bg-gray-900"
                  >
                    Ver
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t px-4 py-6 text-center">
        <p className="text-sm text-gray-500">
          Esta página é somente informativa e não substitui orientação médica
          profissional.
        </p>
        <p className="mt-3 text-xs font-bold uppercase tracking-widest text-red-600">
          Amparo
        </p>
      </footer>
    </div>
  );
}
