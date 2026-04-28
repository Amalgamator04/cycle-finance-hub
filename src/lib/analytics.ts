import type { Cycle } from "./cycle";
import { cycleLength, daysElapsedInCycle, daysLeftInCycle, getLastNCycles } from "./cycle";

export interface Transaction {
  id: string;
  amount: number;
  type: "income" | "expense" | "savings";
  category: string;
  description: string | null;
  date: string;
  is_recurring: boolean;
  cycle_key: string | null;
}

export interface CycleTotals {
  income: number;
  expense: number;
  savings: number;
  balance: number;
  transactionCount: number;
}

export function totalsForTransactions(txs: Transaction[]): CycleTotals {
  let income = 0, expense = 0, savings = 0;
  for (const t of txs) {
    if (t.type === "income") income += Number(t.amount);
    else if (t.type === "expense") expense += Number(t.amount);
    else if (t.type === "savings") savings += Number(t.amount);
  }
  return { income, expense, savings, balance: income - expense - savings, transactionCount: txs.length };
}

export function filterByCycle(txs: Transaction[], cycle: Cycle, salaryDay: number): Transaction[] {
  return txs.filter((t) => {
    if (t.cycle_key) return t.cycle_key === cycle.key;
    const d = new Date(t.date);
    return d >= cycle.start && d <= cycle.end;
  });
}

export function topCategory(txs: Transaction[], type: Transaction["type"] = "expense"): { category: string; amount: number } | null {
  const map = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== type) continue;
    map.set(t.category, (map.get(t.category) || 0) + Number(t.amount));
  }
  let best: { category: string; amount: number } | null = null;
  for (const [c, a] of map.entries()) {
    if (!best || a > best.amount) best = { category: c, amount: a };
  }
  return best;
}

export function categoryBreakdown(txs: Transaction[], type: Transaction["type"] = "expense") {
  const map = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== type) continue;
    map.set(t.category, (map.get(t.category) || 0) + Number(t.amount));
  }
  return Array.from(map.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function avgDailySpend(txs: Transaction[], cycle: Cycle, today = new Date()): number {
  const elapsed = Math.max(1, daysElapsedInCycle(cycle, today));
  const expense = txs.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  return expense / elapsed;
}

export function projectedSpend(txs: Transaction[], cycle: Cycle, today = new Date()): number {
  return avgDailySpend(txs, cycle, today) * cycleLength(cycle);
}

export function savingsRate(totals: CycleTotals): number {
  if (totals.income <= 0) return 0;
  return (totals.savings / totals.income) * 100;
}

export interface CycleSeries {
  cycle: Cycle;
  totals: CycleTotals;
  avgDaily: number;
}

export function buildCycleSeries(txs: Transaction[], salaryDay: number, n = 6): CycleSeries[] {
  const cycles = getLastNCycles(n, salaryDay);
  return cycles.map((c) => {
    const cTx = filterByCycle(txs, c, salaryDay);
    const totals = totalsForTransactions(cTx);
    const len = cycleLength(c);
    return { cycle: c, totals, avgDaily: totals.expense / Math.max(1, len) };
  });
}

export interface Insight {
  id: string;
  level: "info" | "good" | "warn" | "bad";
  title: string;
  detail?: string;
}

export function generateInsights(opts: {
  current: CycleTotals;
  previous: CycleTotals;
  currentTx: Transaction[];
  cycle: Cycle;
  budgets: { category: string | null; amount: number }[];
  today?: Date;
}): Insight[] {
  const { current, previous, currentTx, cycle, budgets } = opts;
  const today = opts.today ?? new Date();
  const insights: Insight[] = [];

  // Expense delta
  if (previous.expense > 0) {
    const delta = ((current.expense - previous.expense) / previous.expense) * 100;
    if (Math.abs(delta) > 5) {
      insights.push({
        id: "expense-delta",
        level: delta > 0 ? "warn" : "good",
        title: `Expenses ${delta > 0 ? "↑" : "↓"} ${Math.abs(delta).toFixed(0)}% vs last cycle`,
        detail: `Now ${current.expense.toFixed(0)} vs ${previous.expense.toFixed(0)} previous.`,
      });
    }
  }

  // Top category
  const top = topCategory(currentTx, "expense");
  if (top) {
    insights.push({
      id: "top-cat",
      level: "info",
      title: `Top spending: ${top.category}`,
      detail: `${((top.amount / Math.max(1, current.expense)) * 100).toFixed(0)}% of cycle expenses.`,
    });
  }

  // Savings rate
  const sr = savingsRate(current);
  if (current.income > 0) {
    insights.push({
      id: "savings-rate",
      level: sr >= 20 ? "good" : sr >= 10 ? "info" : "warn",
      title: `You saved ${sr.toFixed(0)}% this cycle`,
      detail: sr >= 20 ? "Great pace!" : sr >= 10 ? "Solid, can push further." : "Below 10% — try increasing savings.",
    });
  }

  // Pace / projection
  const elapsed = daysElapsedInCycle(cycle, today);
  const left = daysLeftInCycle(cycle, today);
  if (elapsed > 0 && left > 0) {
    const dailySpend = current.expense / elapsed;
    const projected = dailySpend * cycleLength(cycle);
    const overall = budgets.find((b) => !b.category);
    if (overall && projected > overall.amount) {
      insights.push({
        id: "pace-overall",
        level: "bad",
        title: `Projected to exceed budget`,
        detail: `At current pace you'll spend ${projected.toFixed(0)} vs budget ${overall.amount.toFixed(0)}.`,
      });
    } else if (overall) {
      insights.push({
        id: "pace-good",
        level: "good",
        title: `Spending pace under budget`,
        detail: `Projected ${projected.toFixed(0)} vs budget ${overall.amount.toFixed(0)}.`,
      });
    }
  }

  // Burn rate
  if (elapsed > 0) {
    const burn = current.expense / elapsed;
    insights.push({
      id: "burn",
      level: "info",
      title: `Burn rate ${burn.toFixed(0)}/day`,
      detail: `${left} days left in cycle.`,
    });
  }

  // Per-category budget projections
  for (const b of budgets) {
    if (!b.category) continue;
    const spent = currentTx.filter(t => t.type === "expense" && t.category === b.category).reduce((s, t) => s + Number(t.amount), 0);
    const pct = (spent / b.amount) * 100;
    if (pct >= 90) {
      insights.push({
        id: `budget-${b.category}`,
        level: pct >= 100 ? "bad" : "warn",
        title: `${b.category} budget ${pct >= 100 ? "exceeded" : "near limit"} (${pct.toFixed(0)}%)`,
        detail: `Spent ${spent.toFixed(0)} of ${b.amount.toFixed(0)}.`,
      });
    } else if (elapsed > 0) {
      const dailyCat = spent / elapsed;
      const projCat = dailyCat * cycleLength(cycle);
      if (projCat > b.amount && spent > 0) {
        const daysToOverrun = Math.ceil((b.amount - spent) / Math.max(1, dailyCat));
        insights.push({
          id: `proj-${b.category}`,
          level: "warn",
          title: `May exceed ${b.category} budget in ${daysToOverrun}d`,
          detail: `Projected ${projCat.toFixed(0)} vs budget ${b.amount.toFixed(0)}.`,
        });
      }
    }
  }

  return insights;
}
