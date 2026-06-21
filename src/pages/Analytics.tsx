import { useMemo, useRef, useState } from "react";
import { GlobalFilters } from "@/components/GlobalFilters";
import { useTransactions } from "@/hooks/useFinance";
import { useFilteredTransactions } from "@/hooks/useFilteredTransactions";
import { useFilters } from "@/store/filters";
import { useSettings } from "@/store/settings";
import { buildCycleSeries, categoryBreakdown, savingsRate, topCategory, totalsForTransactions } from "@/lib/analytics";
import { getCurrentCycle } from "@/lib/cycle";
import { formatCurrency, formatPercent } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportElementToPdf } from "@/lib/pdfExport";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area, ComposedChart,
} from "recharts";
import { format, parseISO, eachDayOfInterval, min as dateMin, max as dateMax, subDays } from "date-fns";

const CHART_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--chart-6))"];

export default function Analytics() {
  const { data: txs = [] } = useTransactions();
  const filtered = useFilteredTransactions(txs);
  const settings = useSettings((s) => s.settings);
  const f = useFilters();
  const symbol = settings.currencySymbol;
  const { charts } = settings;
  const dailyRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const series = useMemo(() => buildCycleSeries(txs, settings.salaryDay, 6), [txs, settings.salaryDay]);

  const trendData = series.map((s) => ({
    name: format(s.cycle.start, "MMM"),
    Income: Math.round(s.totals.income),
    Expense: Math.round(s.totals.expense),
    Savings: Math.round(s.totals.savings),
  }));

  const breakdown = useMemo(() => categoryBreakdown(filtered, "expense"), [filtered]);
  const savingsRateData = series.map((s) => ({
    name: format(s.cycle.start, "MMM"),
    Rate: Number(savingsRate(s.totals).toFixed(1)),
  }));
  const burnRateData = series.map((s) => ({ name: format(s.cycle.start, "MMM"), "Burn/day": Math.round(s.avgDaily) }));

  // Daywise series for filtered range
  const dailyData = useMemo(() => {
    if (!filtered.length) return [];
    const dates = filtered.map((t) => parseISO(t.date));
    const start = dateMin(dates);
    const end = dateMax(dates);
    const days = eachDayOfInterval({ start, end });
    const map = new Map<string, { Income: number; Expense: number; Savings: number }>();
    for (const d of days) map.set(format(d, "yyyy-MM-dd"), { Income: 0, Expense: 0, Savings: 0 });
    for (const t of filtered) {
      const key = t.date;
      const row = map.get(key);
      if (!row) continue;
      const amt = Number(t.amount);
      if (t.type === "income") row.Income += amt;
      else if (t.type === "expense") row.Expense += amt;
      else if (t.type === "savings") row.Savings += amt;
    }
    return Array.from(map.entries()).map(([date, v]) => ({
      date,
      name: format(parseISO(date), "MMM d"),
      Income: Math.round(v.Income),
      Expense: Math.round(v.Expense),
      Savings: Math.round(v.Savings),
    }));
  }, [filtered]);

  const dailyCumulative = useMemo(() => {
    let inc = 0, exp = 0, sav = 0;
    return dailyData.map((d) => {
      inc += d.Income; exp += d.Expense; sav += d.Savings;
      return { name: d.name, Income: inc, Expense: exp, Savings: sav, Net: inc - exp - sav };
    });
  }, [dailyData]);

  const filteredTotals = totalsForTransactions(filtered);
  const top = topCategory(filtered, "expense");

  const expenses = series.map((s) => s.totals.expense);
  const avgExpense = expenses.length ? expenses.reduce((a, b) => a + b, 0) / expenses.length : 0;
  const highest = series.reduce((acc, s) => (s.totals.expense > (acc?.totals.expense ?? -1) ? s : acc), series[0]);
  const incomes = series.map(s => s.totals.income).filter(v => v > 0);
  const incMean = incomes.reduce((a, b) => a + b, 0) / Math.max(1, incomes.length);
  const incVar = incomes.reduce((a, b) => a + (b - incMean) ** 2, 0) / Math.max(1, incomes.length);
  const incStability = incMean > 0 ? Math.max(0, 100 - (Math.sqrt(incVar) / incMean) * 100) : 0;
  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  const expDelta = prev ? ((last.totals.expense - prev.totals.expense) / Math.max(1, prev.totals.expense)) * 100 : 0;
  const avgSr = series.length ? series.reduce((s, c) => s + savingsRate(c.totals), 0) / series.length : 0;

  const rangeLabel = useMemo(() => {
    const cycle = getCurrentCycle(settings.salaryDay);
    const today = new Date();
    if (f.dateRange === "7d") return `${format(subDays(today, 6), "MMM d")} – ${format(today, "MMM d, yyyy")}`;
    if (f.dateRange === "30d") return `${format(subDays(today, 29), "MMM d")} – ${format(today, "MMM d, yyyy")}`;
    if (f.dateRange === "cycle") return `${format(cycle.start, "MMM d")} – ${format(cycle.end, "MMM d, yyyy")} (cycle)`;
    if (f.dateRange === "custom" && f.customStart && f.customEnd)
      return `${format(parseISO(f.customStart), "MMM d")} – ${format(parseISO(f.customEnd), "MMM d, yyyy")}`;
    return "All";
  }, [f, settings.salaryDay]);

  const dailyInsights = useMemo(() => {
    if (!dailyData.length) return null;
    const totalExp = dailyData.reduce((a, b) => a + b.Expense, 0);
    const totalInc = dailyData.reduce((a, b) => a + b.Income, 0);
    const totalSav = dailyData.reduce((a, b) => a + b.Savings, 0);
    const activeDays = dailyData.filter((d) => d.Expense > 0).length || 1;
    const avgDaily = totalExp / activeDays;
    const peak = dailyData.reduce((acc, d) => (d.Expense > acc.Expense ? d : acc), dailyData[0]);
    const zeroDays = dailyData.filter((d) => d.Expense === 0).length;
    return { totalExp, totalInc, totalSav, avgDaily, peak, zeroDays, days: dailyData.length };
  }, [dailyData]);

  const handleExportPdf = async () => {
    if (!dailyRef.current) return;
    if (!dailyData.length) { toast.error("No data in current range to export"); return; }
    try {
      setExporting(true);
      await exportElementToPdf(
        dailyRef.current,
        `daily-analytics-${format(new Date(), "yyyyMMdd-HHmm")}.pdf`,
        "Daily Analytics Report",
        [`Range: ${rangeLabel}`, `Generated: ${format(new Date(), "PPpp")}`, `Currency: ${symbol}`],
      );
      toast.success("PDF exported");
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <Button onClick={handleExportPdf} disabled={exporting} className="gap-2">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export daily analytics
        </Button>
      </div>
      <GlobalFilters />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="Top category" value={top?.category ?? "—"} sub={top ? formatCurrency(top.amount, symbol) : ""} />
        <Stat label="Highest expense cycle" value={highest ? format(highest.cycle.start, "MMM") : "—"} sub={highest ? formatCurrency(highest.totals.expense, symbol) : ""} />
        <Stat label="Avg expense / cycle" value={formatCurrency(avgExpense, symbol)} />
        <Stat label="Avg savings rate" value={`${avgSr.toFixed(1)}%`} />
        <Stat label="Expense Δ vs prev" value={formatPercent(expDelta)} accent={expDelta > 0 ? "bad" : "good"} />
        <Stat label="Income stability" value={`${incStability.toFixed(0)}/100`} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {charts.cycleTrend && (
          <ChartCard title="Cycle trend">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Legend />
                <Line type="monotone" dataKey="Income" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Expense" stroke="hsl(var(--chart-5))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Savings" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {charts.expenseBreakdown && (
          <ChartCard title="Expense breakdown" subtitle={`${formatCurrency(filteredTotals.expense, symbol)} total in view`}>
            {!breakdown.length ? <Empty /> : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={breakdown} dataKey="amount" nameKey="category" innerRadius={60} outerRadius={100} paddingAngle={2}>
                    {breakdown.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} formatter={(v: any) => formatCurrency(Number(v), symbol)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        )}

        {charts.cycleComparison && (
          <ChartCard title="Cycle comparison">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Legend />
                <Bar dataKey="Income" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Expense" fill="hsl(var(--chart-5))" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Savings" fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {charts.savingsRate && (
          <ChartCard title="Savings rate">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={savingsRateData}>
                <defs>
                  <linearGradient id="sr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} unit="%" />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} formatter={(v: any) => `${v}%`} />
                <Area type="monotone" dataKey="Rate" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#sr)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {charts.burnRate && (
          <ChartCard title="Burn rate trend">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={burnRateData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} formatter={(v: any) => formatCurrency(Number(v), symbol)} />
                <Line type="monotone" dataKey="Burn/day" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
        {charts.dailyTrend && (
          <ChartCard title="Daywise trend" subtitle="Per-day income, expense & savings in current view">
            {!dailyData.length ? <Empty /> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} interval="preserveStartEnd" />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} formatter={(v: any) => formatCurrency(Number(v), symbol)} />
                  <Legend />
                  <Bar dataKey="Income" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Expense" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Savings" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        )}

        {charts.dailyCumulative && (
          <ChartCard title="Daywise cumulative" subtitle="Running totals across the selected range">
            {!dailyCumulative.length ? <Empty /> : (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={dailyCumulative}>
                  <defs>
                    <linearGradient id="cumNet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} interval="preserveStartEnd" />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} formatter={(v: any) => formatCurrency(Number(v), symbol)} />
                  <Legend />
                  <Area type="monotone" dataKey="Net" stroke="hsl(var(--chart-2))" strokeWidth={2} fill="url(#cumNet)" />
                  <Line type="monotone" dataKey="Income" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Expense" stroke="hsl(var(--chart-5))" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        )}
      </div>

      <div ref={dailyRef} className="space-y-3 rounded-2xl bg-background p-3">
        <div>
          <h2 className="text-lg font-semibold">Daily Analytics</h2>
          <p className="text-xs text-muted-foreground">{rangeLabel}</p>
        </div>

        {dailyInsights && (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
            <Stat label="Days in view" value={String(dailyInsights.days)} />
            <Stat label="Total expense" value={formatCurrency(dailyInsights.totalExp, symbol)} />
            <Stat label="Total income" value={formatCurrency(dailyInsights.totalInc, symbol)} />
            <Stat label="Total savings" value={formatCurrency(dailyInsights.totalSav, symbol)} />
            <Stat label="Avg / active day" value={formatCurrency(dailyInsights.avgDaily, symbol)} />
            <Stat label="Peak day" value={dailyInsights.peak.name} sub={formatCurrency(dailyInsights.peak.Expense, symbol)} />
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-2">
          <ChartCard title="Daywise trend" subtitle="Per-day income, expense & savings">
            {!dailyData.length ? <Empty /> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} interval="preserveStartEnd" />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} formatter={(v: any) => formatCurrency(Number(v), symbol)} />
                  <Legend />
                  <Bar dataKey="Income" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Expense" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Savings" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Daywise cumulative" subtitle="Running totals across the selected range">
            {!dailyCumulative.length ? <Empty /> : (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={dailyCumulative}>
                  <defs>
                    <linearGradient id="cumNet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} interval="preserveStartEnd" />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} formatter={(v: any) => formatCurrency(Number(v), symbol)} />
                  <Legend />
                  <Area type="monotone" dataKey="Net" stroke="hsl(var(--chart-2))" strokeWidth={2} fill="url(#cumNet)" />
                  <Line type="monotone" dataKey="Income" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Expense" stroke="hsl(var(--chart-5))" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {dailyInsights && (
          <div className="kpi-card text-sm">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Key insights</div>
            <ul className="space-y-1 list-disc pl-5">
              <li>Spent {formatCurrency(dailyInsights.totalExp, symbol)} across {dailyInsights.days} day{dailyInsights.days === 1 ? "" : "s"}, averaging {formatCurrency(dailyInsights.avgDaily, symbol)} per active day.</li>
              <li>Peak spend day was <strong>{dailyInsights.peak.name}</strong> at {formatCurrency(dailyInsights.peak.Expense, symbol)}.</li>
              <li>{dailyInsights.zeroDays} zero-spend day{dailyInsights.zeroDays === 1 ? "" : "s"} in this range.</li>
              <li>Net flow: {formatCurrency(dailyInsights.totalInc - dailyInsights.totalExp - dailyInsights.totalSav, symbol)} (Income − Expense − Savings).</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="kpi-card">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
          {subtitle && <div className="text-xs text-muted-foreground/80">{subtitle}</div>}
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "good" | "bad" }) {
  return (
    <div className="kpi-card">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${accent === "good" ? "text-success" : accent === "bad" ? "text-destructive" : ""}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground tabular-nums">{sub}</div>}
    </div>
  );
}

function Empty() {
  return <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">No data in current filter.</div>;
}
