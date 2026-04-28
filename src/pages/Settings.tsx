import { useState } from "react";
import { useSettings } from "@/store/settings";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  useBudgets, useCategories, useDeleteBudget, useDeleteRecurring, useRecurring,
  useTransactions, useUpsertBudget, useUpsertRecurring,
} from "@/hooks/useFinance";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { downloadFile, parseCSV, toCSV } from "@/lib/csv";
import { format } from "date-fns";
import { cycleKeyFor } from "@/lib/cycle";

export default function Settings() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);

  return (
    <div className="space-y-4 max-w-4xl">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Accordion type="multiple" defaultValue={["cycle", "currency", "budgets"]} className="space-y-3">
        <Section value="cycle" title="Salary & Cycle">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Salary day of month</Label>
              <Input type="number" min={1} max={28} value={settings.salaryDay}
                onChange={(e) => update({ salaryDay: Math.max(1, Math.min(28, Number(e.target.value) || 1)) })} />
              <p className="mt-1 text-xs text-muted-foreground">Cycles run from this day to one day before next month's salary day. All charts and KPIs recompute.</p>
            </div>
          </div>
        </Section>

        <Section value="currency" title="Currency">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Symbol</Label>
              <Input value={settings.currencySymbol} onChange={(e) => update({ currencySymbol: e.target.value || "₹" })} />
            </div>
            <div>
              <Label>Code</Label>
              <Input value={settings.currencyCode} onChange={(e) => update({ currencyCode: e.target.value.toUpperCase() })} />
            </div>
          </div>
        </Section>

        <Section value="budgets" title="Budgets"><BudgetsSection /></Section>

        <Section value="analytics" title="Analytics">
          <div className="grid gap-2">
            {(Object.keys(settings.charts) as (keyof typeof settings.charts)[]).map((k) => (
              <Toggle key={k} label={labelize(k)} checked={settings.charts[k]} onChange={(v) => update({ charts: { ...settings.charts, [k]: v } } as any)} />
            ))}
            <div className="mt-3">
              <Label>Default date filter</Label>
              <Select value={settings.defaultDateFilter} onValueChange={(v) => update({ defaultDateFilter: v as any })}>
                <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="cycle">Current cycle</SelectItem>
                  <SelectItem value="custom">Custom range</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Section>

        <Section value="prefs" title="UI Preferences">
          <div className="grid gap-3">
            <div>
              <Label>Theme</Label>
              <Select value={settings.theme} onValueChange={(v) => update({ theme: v as any })}>
                <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="auto">Auto (system)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Toggle label="Compact mode" checked={settings.compactMode} onChange={(v) => update({ compactMode: v })} />
            <div className="mt-2">
              <Label>Dashboard cards</Label>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(Object.keys(settings.dashboardCards) as (keyof typeof settings.dashboardCards)[]).map((k) => (
                  <Toggle key={k} label={labelize(k)} checked={settings.dashboardCards[k]} onChange={(v) => update({ dashboardCards: { ...settings.dashboardCards, [k]: v } } as any)} />
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section value="behavior" title="App Behavior">
          <div className="grid gap-2">
            <Toggle label="Smart insights" checked={settings.smartInsights} onChange={(v) => update({ smartInsights: v })} />
            <Toggle label="Spending alerts" checked={settings.spendingAlerts} onChange={(v) => update({ spendingAlerts: v })} />
            <Toggle label="Auto-generate recurring transactions on cycle start" checked={settings.recurringAutoGen} onChange={(v) => update({ recurringAutoGen: v })} />
          </div>
        </Section>

        <Section value="recurring" title="Recurring transactions"><RecurringSection /></Section>

        <Section value="data" title="Data Management"><DataSection /></Section>
      </Accordion>
    </div>
  );
}

function Section({ value, title, children }: { value: string; title: string; children: React.ReactNode }) {
  return (
    <AccordionItem value={value} className="rounded-2xl border bg-card px-4">
      <AccordionTrigger className="text-sm font-semibold">{title}</AccordionTrigger>
      <AccordionContent className="pt-2 pb-4">{children}</AccordionContent>
    </AccordionItem>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-lg border p-3 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function labelize(s: string) {
  return s.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

function BudgetsSection() {
  const settings = useSettings((s) => s.settings);
  const cycleKey = cycleKeyFor(new Date(), settings.salaryDay);
  const { data: budgets = [] } = useBudgets();
  const { data: categories = [] } = useCategories();
  const upsert = useUpsertBudget();
  const del = useDeleteBudget();
  const [newCategory, setNewCategory] = useState<string>("__overall");
  const [newAmount, setNewAmount] = useState("");

  const cycleBudgets = budgets.filter((b) => !b.cycle_key || b.cycle_key === cycleKey);
  const expenseCats = categories.filter((c) => c.type === "expense");

  const addBudget = async () => {
    const amt = Number(newAmount);
    if (!amt || amt <= 0) return toast.error("Enter amount");
    const cat = newCategory === "__overall" ? null : newCategory;
    await upsert.mutateAsync({ category: cat, amount: amt, cycle_key: cycleKey });
    setNewAmount("");
    toast.success("Budget added");
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto] items-end">
        <div>
          <Label>Category</Label>
          <Select value={newCategory} onValueChange={setNewCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__overall">Overall (whole cycle)</SelectItem>
              {expenseCats.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Amount</Label>
          <Input type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="0" />
        </div>
        <Button onClick={addBudget} className="gap-1"><Plus className="h-4 w-4" /> Add</Button>
      </div>
      <div className="divide-y rounded-lg border">
        {!cycleBudgets.length && <div className="p-4 text-sm text-muted-foreground">No budgets for this cycle yet.</div>}
        {cycleBudgets.map((b) => (
          <div key={b.id} className="flex items-center justify-between p-3 text-sm">
            <span className="font-medium">{b.category ?? "Overall cycle budget"}</span>
            <div className="flex items-center gap-2">
              <span className="tabular-nums">{settings.currencySymbol}{Number(b.amount).toLocaleString()}</span>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => del.mutate(b.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecurringSection() {
  const { data: recurring = [] } = useRecurring();
  const { data: categories = [] } = useCategories();
  const upsert = useUpsertRecurring();
  const del = useDeleteRecurring();
  const [type, setType] = useState<"income" | "expense" | "savings">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [day, setDay] = useState(1);
  const [desc, setDesc] = useState("");

  const cats = categories.filter((c) => c.type === type);

  const add = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0 || !category) return toast.error("Fill amount and category");
    await upsert.mutateAsync({ amount: amt, type, category, description: desc, day_of_cycle: day, active: true });
    setAmount(""); setDesc("");
    toast.success("Recurring added");
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-5 items-end">
        <div>
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => { setType(v as any); setCategory(""); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="savings">Savings</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Amount</Label>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue placeholder="Pick" /></SelectTrigger>
            <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Day of cycle</Label>
          <Input type="number" min={1} max={31} value={day} onChange={(e) => setDay(Number(e.target.value) || 1)} />
        </div>
        <Button onClick={add} className="gap-1"><Plus className="h-4 w-4" /> Add</Button>
      </div>
      <div>
        <Label>Description (optional)</Label>
        <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Rent" />
      </div>
      <div className="divide-y rounded-lg border">
        {!recurring.length && <div className="p-4 text-sm text-muted-foreground">No recurring transactions yet.</div>}
        {recurring.map((r) => (
          <div key={r.id} className="flex items-center justify-between p-3 text-sm">
            <div>
              <div className="font-medium">{r.category} <span className="text-xs text-muted-foreground">· day {r.day_of_cycle}</span></div>
              <div className="text-xs text-muted-foreground">{r.description || "—"} · {r.type}</div>
            </div>
            <div className="flex items-center gap-2 tabular-nums">
              <span>{Number(r.amount).toLocaleString()}</span>
              <Switch checked={r.active} onCheckedChange={(v) => upsert.mutate({ ...r, active: v })} />
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => del.mutate(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DataSection() {
  const { data: txs = [] } = useTransactions();
  const { data: cats = [] } = useCategories();
  const { data: budgets = [] } = useBudgets();
  const { data: recurring = [] } = useRecurring();
  const settings = useSettings((s) => s.settings);
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState("");

  const exportAll = () => {
    const stamp = format(new Date(), "yyyyMMdd-HHmm");
    if (txs.length) downloadFile(`transactions-${stamp}.csv`, toCSV(txs));
    if (cats.length) downloadFile(`categories-${stamp}.csv`, toCSV(cats));
    if (budgets.length) downloadFile(`budgets-${stamp}.csv`, toCSV(budgets));
    if (recurring.length) downloadFile(`recurring-${stamp}.csv`, toCSV(recurring));
    downloadFile(`settings-${stamp}.json`, JSON.stringify(settings, null, 2), "application/json");
    toast.success("Export started");
  };

  const importTx = async (file: File) => {
    const text = await file.text();
    const rows = parseCSV(text);
    if (!rows.length) return toast.error("Empty CSV");
    const cleaned = rows.map((r) => ({
      amount: Number(r.amount),
      type: r.type as any,
      category: r.category,
      description: r.description || null,
      date: r.date,
      is_recurring: r.is_recurring === "true",
      cycle_key: cycleKeyFor(r.date, settings.salaryDay),
    })).filter((r) => r.amount && r.type && r.category && r.date);
    if (!cleaned.length) return toast.error("No valid rows");
    const { error } = await supabase.from("transactions").insert(cleaned);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["transactions"] });
    toast.success(`Imported ${cleaned.length} transactions`);
  };

  const deleteAll = async () => {
    if (confirming !== "DELETE") return toast.error('Type "DELETE" to confirm');
    await supabase.from("transactions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("budgets").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("recurring_transactions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    qc.invalidateQueries();
    setConfirming("");
    toast.success("All transactional data deleted");
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border p-3">
        <div className="text-sm font-medium">Single shared dataset</div>
        <p className="mt-1 text-xs text-muted-foreground">This app has no login. Anyone with the URL can view and edit your data.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={exportAll}>Export everything (CSV + JSON)</Button>
        <label className="inline-flex">
          <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && importTx(e.target.files[0])} />
          <Button asChild variant="outline"><span>Import transactions CSV</span></Button>
        </label>
      </div>
      <div className="rounded-lg border border-destructive/40 p-3">
        <div className="text-sm font-medium text-destructive">Danger zone</div>
        <p className="text-xs text-muted-foreground mt-1">Deletes all transactions, budgets and recurring templates. Categories and settings are kept.</p>
        <div className="mt-2 flex gap-2">
          <Input placeholder='Type "DELETE" to confirm' value={confirming} onChange={(e) => setConfirming(e.target.value)} className="max-w-xs" />
          <Button variant="destructive" onClick={deleteAll} disabled={confirming !== "DELETE"}>Delete all data</Button>
        </div>
      </div>
    </div>
  );
}
