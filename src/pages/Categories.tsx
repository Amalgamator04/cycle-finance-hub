import { useMemo, useState } from "react";
import { useCategories, useDeleteCategory, useTransactions, useUpsertCategory, type Category } from "@/hooks/useFinance";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function Categories() {
  const { data: categories = [] } = useCategories();
  const { data: txs = [] } = useTransactions();
  const upsert = useUpsertCategory();
  const del = useDeleteCategory();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<Category["type"]>("expense");

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of txs) m.set(`${t.type}:${t.category}`, (m.get(`${t.type}:${t.category}`) || 0) + 1);
    return m;
  }, [txs]);

  const grouped = {
    income: categories.filter((c) => c.type === "income"),
    expense: categories.filter((c) => c.type === "expense"),
    savings: categories.filter((c) => c.type === "savings"),
  };

  const openNew = () => { setEditing(null); setName(""); setType("expense"); setOpen(true); };
  const openEdit = (c: Category) => { setEditing(c); setName(c.name); setType(c.type); setOpen(true); };

  const save = async () => {
    if (!name.trim()) return toast.error("Enter a name");
    try {
      await upsert.mutateAsync({ id: editing?.id, name: name.trim(), type });
      toast.success(editing ? "Updated" : "Added");
      setOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (c: Category) => {
    const used = counts.get(`${c.type}:${c.name}`) || 0;
    if (used > 0 && !confirm(`"${c.name}" is used in ${used} transaction(s). Delete anyway? Existing transactions keep the category name.`)) return;
    if (used === 0 && !confirm(`Delete "${c.name}"?`)) return;
    try {
      await del.mutateAsync(c.id);
      toast.success("Deleted");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Categories</h1>
        <Button onClick={openNew} className="gap-1"><Plus className="h-4 w-4" /> Add category</Button>
      </div>

      {(["income", "expense", "savings"] as const).map((t) => (
        <div key={t} className="kpi-card">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold capitalize">{t}</h2>
            <Badge variant="outline">{grouped[t].length}</Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {grouped[t].map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl border p-3">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{counts.get(`${t}:${c.name}`) || 0} transactions</div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))}
            {!grouped[t].length && <p className="text-sm text-muted-foreground">No {t} categories yet.</p>}
          </div>
        </div>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit category" : "Add category"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Groceries" />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? "Save" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
