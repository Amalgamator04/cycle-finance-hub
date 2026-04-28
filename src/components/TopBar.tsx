import { useNow } from "@/hooks/useNow";
import { useSettings } from "@/store/settings";
import { getCurrentCycle, daysLeftInCycle } from "@/lib/cycle";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, CheckCircle2 } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function TopBar() {
  const now = useNow();
  const salaryDay = useSettings((s) => s.settings.salaryDay);
  const cycle = getCurrentCycle(salaryDay);
  const daysLeft = daysLeftInCycle(cycle, now);
  const todayDay = now.getDate();
  const salaryReceived = todayDay >= salaryDay;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
      <SidebarTrigger />
      <div className="hidden md:flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Cycle</span>
        <span className="font-semibold tabular-nums">{cycle.label}</span>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <div className="hidden sm:flex flex-col text-right leading-tight">
          <span className="text-sm font-medium tabular-nums">{format(now, "EEE, MMM d")}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{format(now, "HH:mm:ss")}</span>
        </div>
        {salaryReceived ? (
          <Badge variant="outline" className="border-success/40 bg-success/10 text-success gap-1">
            <CheckCircle2 className="h-3 w-3" /> Salary received
          </Badge>
        ) : (
          <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning gap-1">
            <CalendarClock className="h-3 w-3" /> {daysLeft}d left
          </Badge>
        )}
      </div>
    </header>
  );
}
