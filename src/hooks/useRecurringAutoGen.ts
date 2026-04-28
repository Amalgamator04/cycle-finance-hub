import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/store/settings";
import { getCurrentCycle, cycleKeyFor } from "@/lib/cycle";
import { addDays, format } from "date-fns";

/**
 * On app load: for each active recurring template whose day_of_cycle has been
 * reached in the current cycle, ensure a transaction exists. Idempotent via
 * (source_recurring_id, cycle_key).
 */
export function useRecurringAutoGen() {
  const qc = useQueryClient();
  const enabled = useSettings((s) => s.settings.recurringAutoGen);
  const salaryDay = useSettings((s) => s.settings.salaryDay);
  const hydrated = useSettings((s) => s.hydrated);
  const ran = useRef(false);

  useEffect(() => {
    if (!hydrated || !enabled || ran.current) return;
    ran.current = true;
    (async () => {
      const cycle = getCurrentCycle(salaryDay);
      const today = new Date();
      const { data: templates } = await supabase.from("recurring_transactions").select("*").eq("active", true);
      if (!templates?.length) return;
      const { data: existing } = await supabase
        .from("transactions")
        .select("source_recurring_id")
        .eq("cycle_key", cycle.key)
        .not("source_recurring_id", "is", null);
      const existingSet = new Set((existing ?? []).map((e: any) => e.source_recurring_id));
      const inserts: any[] = [];
      for (const t of templates as any[]) {
        if (existingSet.has(t.id)) continue;
        const dayOffset = Math.max(0, (t.day_of_cycle ?? 1) - 1);
        const txDate = addDays(cycle.start, dayOffset);
        if (txDate > today) continue;
        inserts.push({
          amount: t.amount,
          type: t.type,
          category: t.category,
          description: t.description ?? "Recurring",
          date: format(txDate, "yyyy-MM-dd"),
          is_recurring: true,
          source_recurring_id: t.id,
          cycle_key: cycle.key,
        });
      }
      if (inserts.length) {
        await supabase.from("transactions").insert(inserts);
        qc.invalidateQueries({ queryKey: ["transactions"] });
      }
    })();
  }, [hydrated, enabled, salaryDay, qc]);
}
