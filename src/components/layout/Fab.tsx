import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Pill, Calendar, FileText, Activity } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const ACTIONS = [
  { to: "/medicamentos/novo", icon: Pill, label: "Adicionar medicamento" },
  { to: "/agenda/nova", icon: Calendar, label: "Registrar consulta" },
  { to: "/documentos/novo", icon: FileText, label: "Subir documento" },
  { to: "/eventos/novo", icon: Activity, label: "Adicionar evento clínico" },
];

export function Fab() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="Adicionar"
          className="fixed right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95"
          style={{ bottom: "72px" }}
        >
          <Plus className="h-6 w-6" />
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Ações rápidas</SheetTitle>
        </SheetHeader>
        <div className="mt-4 grid gap-2 pb-6">
          {ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.to}
                to={a.to as never}
                onClick={() => setOpen(false)}
                className="flex min-h-[52px] items-center gap-3 rounded-xl border bg-card px-4 py-3 active:bg-muted"
              >
                <Icon className="h-5 w-5 text-primary" />
                <span className="text-base font-medium">{a.label}</span>
              </Link>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
