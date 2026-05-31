import { Link, useLocation } from "@tanstack/react-router";
import { Home, Pill, Calendar, FileText, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ITEMS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/medicamentos", label: "Medicamentos", icon: Pill },
  { to: "/agenda", label: "Agenda", icon: Calendar },
  { to: "/documentos", label: "Documentos", icon: FileText },
  { to: "/familia", label: "Família", icon: Users },
];

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {ITEMS.map((it) => {
          const active = pathname === it.to || pathname.startsWith(it.to + "/");
          const Icon = it.icon;
          return (
            <li key={it.to}>
              <Link
                to={it.to as never}
                className={`flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
