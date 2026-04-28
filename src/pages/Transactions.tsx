import { useMemo, useState } from "react";
import { GlobalFilters } from "@/components/GlobalFilters";
import { useDeleteTransaction, useTransactions } from "@/hooks/useFinance";
import { useFilteredTransactions } from "@/hooks/useFilteredTransactions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, ArrowUpDown, Search } from "lucide-react";
import { TransactionDialog } from "@/components/TransactionDialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useSettings } from "@/store/settings";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import type { Transaction } from "@/lib/analytics";

export default function Transactions() {
  const { data: txs = [], isLoading } = useTransactions();
  const filtered = useFilteredTransactions(txs);
  const del = useDeleteTransaction();
  const settings = useSettings((s) => s.settings);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"date" | "amount">("date");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [open, setOpen] = useState(false);

  const rows = useMemo(() => {
    let r = filtered;
    if (search.trim()) {
      const s = search.toLowerCase();
      r = r.filter(t => t.category.toLowerCase().includes(s) || (t.description || "").toLowerCase().includes(s));
    }
    r = [...r].sort((a, b) => {
      const av = sort === "date" ? new Date(a.date).getTime() : Number(a.amount);
      const bv = sort === "date" ? new Date(b.date).getTime() : Number(b.amount);
      return dir === "asc" ? av - bv : bv - av;
    });
    return r;
  }, [filtered, search, sort, dir]);

  const toggleSort = (col: "date" | "amount") => {
    if (sort === col) setDir(dir === "asc" ? "desc" : "asc");
    else { setSort(col); setDir("desc"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this transaction?")) return;
    await del.mutateAsync(id);
    toast.success("Deleted");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-1"><Plus className="h-4 w-4" /> Add</Button>
      </div>
      <GlobalFilters />
      <div className="kpi-card p-0 overflow-hidden">
        <div className="flex items-center gap-2 p-3 border-b">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by category or description" value={search} onChange={(e) => setSearch(e.target.value)} className="border-0 focus-visible:ring-0 h-8" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left p-3 cursor-pointer" onClick={() => toggleSort("date")}>
                  <span className="inline-flex items-center gap-1">Date <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Category</th>
                <th className="text-left p-3 hidden md:table-cell">Description</th>
                <th className="text-right p-3 cursor-pointer" onClick={() => toggleSort("amount")}>
                  <span className="inline-flex items-center gap-1">Amount <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="p-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!isLoading && !rows.length && (
                <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">No transactions in this view.</td></tr>
              )}
              {rows.map((t) => (
                <tr key={t.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 tabular-nums">{format(new Date(t.date), "MMM d, yyyy")}</td>
                  <td className="p-3">
                    <Badge variant="outline" className={`capitalize ${t.type === "income" ? "border-success/40 text-success" : t.type === "expense" ? "border-destructive/40 text-destructive" : "border-primary/40 text-primary"}`}>
                      {t.type}
                    </Badge>
                  </td>
                  <td className="p-3">
                    {t.category}
                    {t.is_recurring && <Badge variant="outline" className="ml-2 text-[10px]">↻</Badge>}
                  </td>
                  <td className="p-3 hidden md:table-cell text-muted-foreground truncate max-w-xs">{t.description || "—"}</td>
                  <td className={`p-3 text-right tabular-nums font-semibold ${t.type === "income" ? "text-success" : t.type === "expense" ? "text-destructive" : ""}`}>
                    {t.type === "expense" ? "-" : t.type === "income" ? "+" : ""}{formatCurrency(Number(t.amount), settings.currencySymbol)}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(t); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <TransactionDialog open={open} onOpenChange={setOpen} initial={editing} />
    </div>
  );
}
