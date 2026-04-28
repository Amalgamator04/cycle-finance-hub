import { useMemo, useState } from "react";
import { GlobalFilters } from "@/components/GlobalFilters";
import { KpiCard } from "@/components/KpiCard";
import { useBudgets, useTransactions } from "@/hooks/useFinance";
import { useFilteredTransactions } from "@/hooks/useFilteredTransactions";
import { useSettings } from "@/store/settings";
import { getCurrentCycle, getPreviousCycle, daysElapsedInCycle, daysLeftInCycle, cycleLength } from "@/lib/cycle";
import { filterByCycle, totalsForTransactions, generateInsights, avgDailySpend, projectedSpend } from "@/lib/analytics";
import { formatCurrency, formatDelta } from "@/lib/format";
import { TrendingUp, TrendingDown, PiggyBank, Wallet, Plus, AlertTriangle, CheckCircle2, Info, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TransactionDialog } from "@/components/TransactionDialog";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: txs = [] } = useTransactions();
  const { data: budgets = [] } = useBudgets();
  const settings = useSettings((s) => s.settings);
  const filtered = useFilteredTransactions(txs);
  const [dialog, setDialog] = useState(false);

  const cycle = getCurrentCycle(settings.salaryDay);
  const prevCycle = getPreviousCycle(cycle, settings.salaryDay);
  const cycleTx = filterByCycle(txs, cycle, settings.salaryDay);
  const prevTx = filterByCycle(txs, prevCycle, settings.salaryDay);
  const cur = totalsForTransactions(cycleTx);
  const prev = totalsForTransactions(prevTx);

  const elapsed = daysElapsedInCycle(cycle);
  const left = daysLeftInCycle(cycle);
  const len = cycleLength(cycle);
  const burn = avgDailySpend(cycleTx, cycle);
  const projected = projectedSpend(cycleTx, cycle);

  const overallBudget = budgets.find((b) => !b.category);
  const insights = useMemo(
    () => generateInsights({ current: cur, previous: prev, currentTx: cycleTx, cycle, budgets }),
    [cur, prev, cycleTx, cycle, budgets]
  );

  const recent = [...filtered].slice(0, 8);
  const symbol = settings.currencySymbol;
  const cards = settings.dashboardCards;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Cycle {cycle.label} · {elapsed}/{len} days</p>
        </div>
        <Button onClick={() => setDialog(true)} className="gap-1"><Plus className="h-4 w-4" /> Add transaction</Button>
      </div>

      <GlobalFilters />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {cards.balance && (
          <KpiCard label="Balance" value={formatCurrency(cur.balance, symbol)}
            delta={formatDelta(cur.balance, prev.balance)} positiveDirection="up" icon={<Wallet className="h-4 w-4" />} />
        )}
        {cards.income && (
          <KpiCard label="Income" value={formatCurrency(cur.income, symbol)}
            delta={formatDelta(cur.income, prev.income)} positiveDirection="up" icon={<TrendingUp className="h-4 w-4 text-success" />} />
        )}
        {cards.expense && (
          <KpiCard label="Expense" value={formatCurrency(cur.expense, symbol)}
            delta={formatDelta(cur.expense, prev.expense)} positiveDirection="down" icon={<TrendingDown className="h-4 w-4 text-destructive" />} />
        )}
        {cards.savings && (
          <KpiCard label="Savings" value={formatCurrency(cur.savings, symbol)}
            delta={formatDelta(cur.savings, prev.savings)} positiveDirection="up" icon={<PiggyBank className="h-4 w-4 text-primary" />} />
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {cards.cycleProgress && (
          <div className="kpi-card lg:col-span-1">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Cycle progress</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums">{left}</span>
              <span className="text-sm text-muted-foreground">days left</span>
            </div>
            <Progress value={(elapsed / len) * 100} className="mt-3" />
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-muted p-2">
                <div className="text-muted-foreground">Burn rate</div>
                <div className="font-semibold tabular-nums">{formatCurrency(burn, symbol)}/day</div>
              </div>
              <div className="rounded-lg bg-muted p-2">
                <div className="text-muted-foreground">Projected</div>
                <div className="font-semibold tabular-nums">{formatCurrency(projected, symbol)}</div>
              </div>
            </div>
          </div>
        )}

        {cards.budget && (
          <div className="kpi-card lg:col-span-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Budgets</div>
              <Link to="/settings" className="text-xs text-primary hover:underline">Manage</Link>
            </div>
            {!budgets.length && (
              <div className="mt-4 text-sm text-muted-foreground">No budgets yet. Set one in Settings → Budgets.</div>
            )}
            {overallBudget && (
              <BudgetRow label="Overall" spent={cur.expense} amount={overallBudget.amount} symbol={symbol} />
            )}
            {budgets.filter(b => b.category).slice(0, 3).map((b) => {
              const spent = cycleTx.filter(t => t.type === "expense" && t.category === b.category).reduce((s, t) => s + Number(t.amount), 0);
              return <BudgetRow key={b.id} label={b.category!} spent={spent} amount={b.amount} symbol={symbol} />;
            })}
          </div>
        )}
      </div>

      {cards.insights && settings.smartInsights && insights.length > 0 && (
        <div className="kpi-card">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
            <Sparkles className="h-3.5 w-3.5" /> Smart insights
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {insights.slice(0, 6).map((i) => (
              <div key={i.id} className="rounded-xl border p-3 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  {i.level === "good" && <CheckCircle2 className="h-4 w-4 text-success" />}
                  {i.level === "bad" && <AlertTriangle className="h-4 w-4 text-destructive" />}
                  {i.level === "warn" && <AlertTriangle className="h-4 w-4 text-warning" />}
                  {i.level === "info" && <Info className="h-4 w-4 text-muted-foreground" />}
                  <span>{i.title}</span>
                </div>
                {i.detail && <p className="mt-1 text-xs text-muted-foreground">{i.detail}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {cards.recent && (
        <div className="kpi-card">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Recent transactions</div>
            <Link to="/transactions" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          {!recent.length ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No transactions yet.
              <div className="mt-3"><Button onClick={() => setDialog(true)} size="sm" className="gap-1"><Plus className="h-3 w-3" /> Add your first transaction</Button></div>
            </div>
          ) : (
            <div className="mt-3 divide-y">
              {recent.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${t.type === "income" ? "bg-success/15 text-success" : t.type === "expense" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>
                      {t.type === "income" ? <TrendingUp className="h-4 w-4" /> : t.type === "expense" ? <TrendingDown className="h-4 w-4" /> : <PiggyBank className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{t.category} {t.is_recurring && <Badge variant="outline" className="ml-1 text-[10px]">Recurring</Badge>}</div>
                      <div className="text-xs text-muted-foreground truncate">{t.description || "—"} · {format(new Date(t.date), "MMM d")}</div>
                    </div>
                  </div>
                  <div className={`tabular-nums font-semibold ${t.type === "income" ? "text-success" : t.type === "expense" ? "text-destructive" : ""}`}>
                    {t.type === "expense" ? "-" : t.type === "income" ? "+" : ""}{formatCurrency(Number(t.amount), symbol)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <TransactionDialog open={dialog} onOpenChange={setDialog} />
    </div>
  );
}

function BudgetRow({ label, spent, amount, symbol }: { label: string; spent: number; amount: number; symbol: string }) {
  const pct = Math.min(100, (spent / amount) * 100);
  const over = spent > amount;
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className={`tabular-nums ${over ? "text-destructive" : "text-muted-foreground"}`}>
          {formatCurrency(spent, symbol)} / {formatCurrency(amount, symbol)}
        </span>
      </div>
      <Progress value={pct} className={`mt-1 ${over ? "[&>div]:bg-destructive" : pct >= 90 ? "[&>div]:bg-warning" : ""}`} />
    </div>
  );
}
