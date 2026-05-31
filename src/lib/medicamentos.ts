export const FREQUENCIES = [
  { value: "1x", label: "1x ao dia", times: 1 },
  { value: "2x", label: "2x ao dia", times: 2 },
  { value: "3x", label: "3x ao dia", times: 3 },
  { value: "4x", label: "4x ao dia", times: 4 },
  { value: "6h", label: "A cada 6h", times: 4 },
  { value: "8h", label: "A cada 8h", times: 3 },
  { value: "12h", label: "A cada 12h", times: 2 },
  { value: "prn", label: "Conforme necessário", times: 0 },
  { value: "outro", label: "Outro", times: 0 },
] as const;

export type FrequencyValue = (typeof FREQUENCIES)[number]["value"];

export function timesCountFor(freq: FrequencyValue): number {
  return FREQUENCIES.find((f) => f.value === freq)?.times ?? 0;
}

export const MED_STATUSES = ["active", "paused", "ended"] as const;
export type MedStatus = (typeof MED_STATUSES)[number];

export const STATUS_LABEL: Record<MedStatus, string> = {
  active: "Ativo",
  paused: "Pausado",
  ended: "Encerrado",
};

export const ALLOWED_MIMES = ["image/jpeg", "image/png", "application/pdf"];

export function isValidMime(file: File): boolean {
  if (file.name.toLowerCase().endsWith(".heic")) return false;
  return ALLOWED_MIMES.includes(file.type);
}

export function buildSchedule(times: string[]): { times: string[] } {
  const valid = times.filter((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t));
  return { times: valid };
}

export function nextTimeToday(times: string[] | undefined): string | null {
  if (!times || times.length === 0) return null;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const upcoming = times
    .map((t) => {
      const [h, m] = t.split(":").map(Number);
      return { t, mins: h * 60 + m };
    })
    .filter((x) => x.mins >= cur)
    .sort((a, b) => a.mins - b.mins);
  return upcoming[0]?.t ?? times[0];
}
