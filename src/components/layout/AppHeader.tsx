import { Link } from "@tanstack/react-router";
import { Zap } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Props = {
  userName?: string | null;
  userPhoto?: string | null;
  showEmergency?: boolean;
};

export function AppHeader({ userName, userPhoto, showEmergency = true }: Props) {
  const initials = (userName ?? "?")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 px-5 backdrop-blur">
      <Link to="/dashboard" className="text-lg font-bold tracking-tight text-primary">
        Amparo
      </Link>
      <div className="flex items-center gap-2">
        {showEmergency && (
          <Link
            to="/emergencia"
            aria-label="Emergência"
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <Zap className="h-5 w-5" />
          </Link>
        )}
        <Link to="/perfil" aria-label="Perfil">
          <Avatar className="h-9 w-9">
            {userPhoto ? <AvatarImage src={userPhoto} alt={userName ?? ""} /> : null}
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        </Link>
      </div>
    </header>
  );
}
