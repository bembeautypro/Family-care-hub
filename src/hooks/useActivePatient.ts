import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Patient = {
  id: string;
  name: string;
  birth_date: string | null;
  photo_url: string | null;
  family_id: string | null;
};

const ACTIVE_PATIENT_KEY = "amparo:active_patient_id";

export function usePatients() {
  const [patients, setPatients] = useState<Patient[] | null>(null);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("patients")
      .select("id, name, birth_date, photo_url, family_id")
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    const list = (data ?? []) as Patient[];
    setPatients(list);
    const stored = typeof window !== "undefined" ? localStorage.getItem(ACTIVE_PATIENT_KEY) : null;
    const valid = stored && list.find((p) => p.id === stored) ? stored : list[0]?.id ?? null;
    setActiveIdState(valid);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setActiveId = useCallback((id: string) => {
    setActiveIdState(id);
    if (typeof window !== "undefined") localStorage.setItem(ACTIVE_PATIENT_KEY, id);
  }, []);

  const active = patients?.find((p) => p.id === activeId) ?? null;

  return { patients, active, activeId, setActiveId, loading, reload };
}

export function ageFromBirthDate(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1;
  return age;
}
