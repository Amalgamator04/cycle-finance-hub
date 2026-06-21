import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/format";
import { Sparkles, ShieldCheck, TrendingUp, Coins, Wallet, PiggyBank } from "lucide-react";
import { Button } from "@/components/ui/button";

type Profile = "conservative" | "balanced" | "aggressive";

const PROFILES: Record<Profile, { label: string; alloc: { key: string; label: string; pct: number; note: string; icon: any; tone: string }[] }> = {
  conservative: {
    label: "Conservative",
    alloc: [
      { key: "emergency", label: "Emergency Fund", pct: 40, note: "High-yield savings / liquid fund", icon: ShieldCheck, tone: "text-success" },
      { key: "debt", label: "Debt / FD", pct: 30, note: "Fixed deposit or debt mutual fund", icon: Wallet, tone: "text-primary" },
      { key: "equity", label: "Equity SIP", pct: 15, note: "Index fund (Nifty 50 / S&P 500)", icon: TrendingUp, tone: "text-chart-1" },
      { key: "gold", label: "Gold", pct: 10, note: "Sovereign Gold Bond / Gold ETF", icon: Coins, tone: "text-warning" },
      { key: "buffer", label: "Spending buffer", pct: 5, note: "Keep liquid for the month", icon: PiggyBank, tone: "text-muted-foreground" },
    ],
  },
  balanced: {
    label: "Balanced",
    alloc: [
      { key: "equity", label: "Equity SIP", pct: 40, note: "Index + flexicap mutual funds", icon: TrendingUp, tone: "text-chart-1" },
      { key: "emergency", label: "Emergency Fund", pct: 20, note: "Top up until 6 months of expenses", icon: ShieldCheck, tone: "text-success" },
      { key: "debt", label: "Debt / FD", pct: 20, note: "Debt fund or short-term FD", icon: Wallet, tone: "text-primary" },
      { key: "gold", label: "Gold", pct: 10, note: "SGB / Gold ETF", icon: Coins, tone: "text-warning" },
      { key: "buffer", label: "Discretionary", pct: 10, note: "Travel / lifestyle goals", icon: PiggyBank, tone: "text-muted-foreground" },
    ],
  },
  aggressive: {
    label: "Aggressive",
    alloc: [
      { key: "equity", label: "Equity SIP", pct: 60, note: "Index + flexicap + smallcap split", icon: TrendingUp, tone: "text-chart-1" },
      { key: "intl", label: "International equity", pct: 15, note: "US / global index fund", icon: TrendingUp, tone: "text-chart-2" },
      { key: "emergency", label: "Emergency Fund", pct: 10, note: "Maintain a baseline cushion", icon: ShieldCheck, tone: "text-success" },
      { key: "gold", label: "Gold", pct: 10, note: "SGB / Gold ETF", icon: Coins, tone: "text-warning" },
      { key: "buffer", label: "Buffer", pct: 5, note: "Stay liquid for opportunities", icon: PiggyBank, tone: "text-muted-foreground" },
    ],
  },
};

interface Props {
  available: number;
  symbol: string;
}

export function InvestmentSuggestions({ available, symbol }: Props) {
  const [profile, setProfile] = useState<Profile>("balanced");
  const config = PROFILES[profile];

  const rows = useMemo(
    () => config.alloc.map((a) => ({ ...a, amount: Math.max(0, Math.round((available * a.pct) / 100)) })),
    [config, available]
  );

  const positive = available > 0;

  return (
    <div className="kpi-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
          <Sparkles className="h-3.5 w-3.5" /> Investment suggestions
        </div>
        <div className="flex gap-1">
          {(Object.keys(PROFILES) as Profile[]).map((p) => (
            <Button key={p} size="sm" variant={profile === p ? "default" : "outline"} className="h-7 px-2 text-xs capitalize" onClick={() => setProfile(p)}>
              {PROFILES[p].label}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <div className="text-2xl font-semibold tabular-nums">{formatCurrency(Math.max(0, available), symbol)}</div>
        <div className="text-xs text-muted-foreground">available to allocate this cycle</div>
      </div>

      {!positive ? (
        <p className="mt-3 rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm text-muted-foreground">
          No surplus this cycle. Trim expenses or wait for next income to start allocating.
        </p>
      ) : (
        <>
          <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-muted">
            {rows.map((r, i) => (
              <div key={r.key} style={{ width: `${r.pct}%` }} className={`h-full ${["bg-success", "bg-primary", "bg-chart-1", "bg-warning", "bg-muted-foreground/40", "bg-chart-2"][i % 6]}`} />
            ))}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {rows.map((r) => {
              const Icon = r.icon;
              return (
                <div key={r.key} className="flex items-start justify-between gap-3 rounded-xl border p-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${r.tone}`} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{r.label} <span className="text-xs text-muted-foreground">· {r.pct}%</span></div>
                      <div className="text-xs text-muted-foreground">{r.note}</div>
                    </div>
                  </div>
                  <div className="tabular-nums text-sm font-semibold whitespace-nowrap">{formatCurrency(r.amount, symbol)}</div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Suggestions are illustrative only — not financial advice. Adjust to your goals and risk profile.
          </p>
        </>
      )}
    </div>
  );
}
