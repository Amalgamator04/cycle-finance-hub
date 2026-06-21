import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCategories, useUpsertTransaction, type Category } from "@/hooks/useFinance";
import type { Transaction } from "@/lib/analytics";
import { format } from "date-fns";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<Transaction> | null;
}

export function TransactionDialog({ open, onOpenChange, initial }: Props) {
  const { data: categories = [], isLoading: catsLoading } = useCategories();
  const upsert = useUpsertTransaction();
  const [type, setType] = useState<Transaction["type"]>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isRecurring, setIsRecurring] = useState(false);

  useEffect(() => {
    if (open) {
      setType((initial?.type as any) ?? "expense");
      setAmount(initial?.amount ? String(initial.amount) : "");
      setCategory(initial?.category ?? "");
      setDescription(initial?.description ?? "");
      setDate(initial?.date ?? format(new Date(), "yyyy-MM-dd"));
      setIsRecurring(initial?.is_recurring ?? false);
    }
  }, [open, initial]);

  const filteredCats = categories.filter((c: Category) => c.type === type);

  const submit = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    if (!category) return toast.error("Pick a category");
    try {
      await upsert.mutateAsync({
        id: initial?.id,
        amount: amt,
        type,
        category,
        description: description || null,
        date,
        is_recurring: isRecurring,
      } as any);
      toast.success(initial?.id ? "Transaction updated" : "Transaction added");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit transaction" : "Add transaction"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-3 gap-2">
            {(["expense", "income", "savings"] as const).map((t) => (
              <Button key={t} variant={type === t ? "default" : "outline"} onClick={() => { setType(t); setCategory(""); }} className="capitalize">
                {t}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Amount</Label>
              <Input type="number" inputMode="decimal" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Category</Label>
            <Select value={category || undefined} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Pick category" /></SelectTrigger>
              <SelectContent className="pointer-events-auto z-[60] max-h-72">
                {catsLoading ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Loading…</div>
                ) : filteredCats.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">No {type} categories. Add one in Categories.</div>
                ) : filteredCats.map((c) => (
                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="cursor-pointer">Mark as recurring</Label>
              <p className="text-xs text-muted-foreground">Visible badge only — auto-generation uses recurring templates.</p>
            </div>
            <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={upsert.isPending}>{initial?.id ? "Save" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
