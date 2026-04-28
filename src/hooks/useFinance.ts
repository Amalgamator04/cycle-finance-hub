import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cycleKeyFor } from "@/lib/cycle";
import { useSettings } from "@/store/settings";
import type { Transaction } from "@/lib/analytics";

export function useTransactions() {
  return useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("date", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Transaction[];
    },
  });
}

export function useUpsertTransaction() {
  const qc = useQueryClient();
  const salaryDay = useSettings((s) => s.settings.salaryDay);
  return useMutation({
    mutationFn: async (t: Partial<Transaction> & { id?: string }) => {
      const cycle_key = t.date ? cycleKeyFor(t.date, salaryDay) : null;
      const payload = { ...t, cycle_key };
      if (t.id) {
        const { error } = await supabase.from("transactions").update(payload as any).eq("id", t.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("transactions").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });
}

export interface Category { id: string; name: string; type: "income" | "expense" | "savings" }

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("type").order("name");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });
}

export function useUpsertCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: Partial<Category> & { id?: string }) => {
      if (c.id) {
        const { error } = await supabase.from("categories").update({ name: c.name, type: c.type } as any).eq("id", c.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("categories").insert({ name: c.name, type: c.type } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export interface Budget { id: string; category: string | null; amount: number; cycle_key: string | null }

export function useBudgets() {
  return useQuery({
    queryKey: ["budgets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("budgets").select("*");
      if (error) throw error;
      return (data ?? []) as Budget[];
    },
  });
}

export function useUpsertBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (b: Partial<Budget> & { id?: string }) => {
      if (b.id) {
        const { error } = await supabase.from("budgets").update({ category: b.category, amount: b.amount, cycle_key: b.cycle_key } as any).eq("id", b.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("budgets").insert({ category: b.category, amount: b.amount, cycle_key: b.cycle_key } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budgets"] }),
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("budgets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budgets"] }),
  });
}

export interface Recurring {
  id: string;
  amount: number;
  type: "income" | "expense" | "savings";
  category: string;
  description: string | null;
  day_of_cycle: number;
  active: boolean;
}

export function useRecurring() {
  return useQuery({
    queryKey: ["recurring"],
    queryFn: async () => {
      const { data, error } = await supabase.from("recurring_transactions").select("*").order("day_of_cycle");
      if (error) throw error;
      return (data ?? []) as Recurring[];
    },
  });
}

export function useUpsertRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: Partial<Recurring> & { id?: string }) => {
      const payload: any = { amount: r.amount, type: r.type, category: r.category, description: r.description, day_of_cycle: r.day_of_cycle, active: r.active };
      if (r.id) {
        const { error } = await supabase.from("recurring_transactions").update(payload).eq("id", r.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("recurring_transactions").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring"] }),
  });
}

export function useDeleteRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recurring_transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring"] }),
  });
}
