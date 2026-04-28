import { useMemo } from "react";
import { useFilters } from "@/store/filters";
import { useSettings } from "@/store/settings";
import { getCurrentCycle } from "@/lib/cycle";
import { subDays, parseISO } from "date-fns";
import type { Transaction } from "@/lib/analytics";

export function useFilteredTransactions(all: Transaction[] | undefined) {
  const f = useFilters();
  const salaryDay = useSettings((s) => s.settings.salaryDay);

  return useMemo(() => {
    if (!all) return [];
    const cycle = getCurrentCycle(salaryDay);
    let start: Date | null = null;
    let end: Date | null = null;
    const today = new Date();
    if (f.dateRange === "7d") { start = subDays(today, 6); end = today; }
    else if (f.dateRange === "30d") { start = subDays(today, 29); end = today; }
    else if (f.dateRange === "cycle") { start = cycle.start; end = cycle.end; }
    else if (f.dateRange === "custom" && f.customStart && f.customEnd) {
      start = parseISO(f.customStart); end = parseISO(f.customEnd);
    }
    return all.filter((t) => {
      if (start && end) {
        const d = parseISO(t.date);
        if (d < start || d > end) return false;
      }
      if (f.types.length && !f.types.includes(t.type)) return false;
      if (f.categories.length && !f.categories.includes(t.category)) return false;
      return true;
    });
  }, [all, f, salaryDay]);
}
