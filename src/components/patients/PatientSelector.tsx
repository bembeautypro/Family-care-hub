import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Patient } from "@/hooks/useActivePatient";

type Props = {
  patients: Patient[];
  activeId: string | null;
  onChange: (id: string) => void;
};

export function PatientSelector({ patients, activeId, onChange }: Props) {
  if (patients.length <= 1) return null;
  return (
    <div className="sticky top-14 z-30 border-b bg-background/95 backdrop-blur">
      <div className="flex gap-2 overflow-x-auto px-5 py-2">
        {patients.map((p) => {
          const active = p.id === activeId;
          const initials = p.name
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();
          return (
            <button
              key={p.id}
              onClick={() => onChange(p.id)}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 ${
                active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
              }`}
            >
              <Avatar className="h-6 w-6">
                {p.photo_url ? <AvatarImage src={p.photo_url} alt={p.name} /> : null}
                <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{p.name.split(" ")[0]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
