import { useEffect } from "react";
import { useSettings } from "@/store/settings";
import { useRecurringAutoGen } from "@/hooks/useRecurringAutoGen";

export function AppBoot({ children }: { children: React.ReactNode }) {
  const { settings, hydrated, loadFromCloud } = useSettings();

  useEffect(() => { loadFromCloud(); }, [loadFromCloud]);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      let dark = settings.theme === "dark";
      if (settings.theme === "auto") dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", dark);
    };
    apply();
    if (settings.theme === "auto") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [settings.theme]);

  useRecurringAutoGen();

  if (!hydrated) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }
  return <>{children}</>;
}
