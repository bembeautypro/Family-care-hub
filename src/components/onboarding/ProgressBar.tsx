import { Progress } from "@/components/ui/progress";

interface ProgressBarProps {
  current: number;
  total: number;
}

export function OnboardingProgress({ current, total }: ProgressBarProps) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="w-full space-y-2">
      <p className="text-sm font-medium text-muted-foreground">
        Passo {current} de {total}
      </p>
      <Progress value={pct} className="h-2" />
    </div>
  );
}
