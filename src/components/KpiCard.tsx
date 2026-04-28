import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  delta?: { pct: number; direction: "up" | "down" | "flat" };
  positiveDirection?: "up" | "down"; // which direction is "good"
  icon?: React.ReactNode;
  hint?: string;
}

export function KpiCard({ label, value, delta, positiveDirection = "up", icon, hint }: KpiCardProps) {
  const deltaColor =
    !delta || delta.direction === "flat"
      ? "text-muted-foreground"
      : delta.direction === positiveDirection
      ? "text-success"
      : "text-destructive";

  const Arrow = !delta ? Minus : delta.direction === "up" ? ArrowUpRight : delta.direction === "down" ? ArrowDownRight : Minus;

  return (
    <div className="kpi-card">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {delta && (
          <span className={cn("inline-flex items-center gap-0.5 font-medium tabular-nums", deltaColor)}>
            <Arrow className="h-3 w-3" />
            {Math.abs(delta.pct).toFixed(1)}%
          </span>
        )}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}
