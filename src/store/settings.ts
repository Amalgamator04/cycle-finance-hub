import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "@/integrations/supabase/client";

export interface AppSettings {
  salaryDay: number;
  currencySymbol: string;
  currencyCode: string;
  theme: "dark" | "light" | "auto";
  compactMode: boolean;
  smartInsights: boolean;
  spendingAlerts: boolean;
  recurringAutoGen: boolean;
  defaultDateFilter: "7d" | "30d" | "cycle" | "custom";
  charts: {
    cycleTrend: boolean;
    expenseBreakdown: boolean;
    cycleComparison: boolean;
    savingsRate: boolean;
    burnRate: boolean;
    dailyTrend: boolean;
    dailyCumulative: boolean;
  };
  dashboardCards: {
    balance: boolean;
    income: boolean;
    expense: boolean;
    savings: boolean;
    cycleProgress: boolean;
    budget: boolean;
    insights: boolean;
    recent: boolean;
  };
}

const DEFAULTS: AppSettings = {
  salaryDay: 7,
  currencySymbol: "₹",
  currencyCode: "INR",
  theme: "dark",
  compactMode: false,
  smartInsights: true,
  spendingAlerts: true,
  recurringAutoGen: true,
  defaultDateFilter: "cycle",
  charts: { cycleTrend: true, expenseBreakdown: true, cycleComparison: true, savingsRate: true, burnRate: true },
  dashboardCards: { balance: true, income: true, expense: true, savings: true, cycleProgress: true, budget: true, insights: true, recent: true },
};

interface SettingsStore {
  settings: AppSettings;
  hydrated: boolean;
  setHydrated: (b: boolean) => void;
  update: (patch: Partial<AppSettings>) => Promise<void>;
  loadFromCloud: () => Promise<void>;
  reset: () => Promise<void>;
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set, get) => ({
      settings: DEFAULTS,
      hydrated: false,
      setHydrated: (b) => set({ hydrated: b }),
      update: async (patch) => {
        const next = { ...get().settings, ...patch, charts: { ...get().settings.charts, ...(patch as any).charts }, dashboardCards: { ...get().settings.dashboardCards, ...(patch as any).dashboardCards } };
        set({ settings: next });
        await supabase.from("settings").upsert({ key: "app", value: next as any }, { onConflict: "key" });
      },
      loadFromCloud: async () => {
        const { data } = await supabase.from("settings").select("value").eq("key", "app").maybeSingle();
        if (data?.value) {
          const cloud = data.value as Partial<AppSettings>;
          set({ settings: { ...DEFAULTS, ...cloud, charts: { ...DEFAULTS.charts, ...(cloud as any).charts }, dashboardCards: { ...DEFAULTS.dashboardCards, ...(cloud as any).dashboardCards } } });
        }
        set({ hydrated: true });
      },
      reset: async () => {
        set({ settings: DEFAULTS });
        await supabase.from("settings").upsert({ key: "app", value: DEFAULTS as any }, { onConflict: "key" });
      },
    }),
    { name: "finance-settings" }
  )
);
