import { create } from "zustand";

export type DateRangePreset = "7d" | "30d" | "cycle" | "custom";

interface FiltersState {
  dateRange: DateRangePreset;
  customStart: string | null;
  customEnd: string | null;
  categories: string[]; // empty = all
  types: ("income" | "expense" | "savings")[]; // empty = all
  setDateRange: (r: DateRangePreset) => void;
  setCustom: (start: string | null, end: string | null) => void;
  setCategories: (c: string[]) => void;
  setTypes: (t: ("income" | "expense" | "savings")[]) => void;
  reset: () => void;
}

export const useFilters = create<FiltersState>((set) => ({
  dateRange: "cycle",
  customStart: null,
  customEnd: null,
  categories: [],
  types: [],
  setDateRange: (dateRange) => set({ dateRange }),
  setCustom: (customStart, customEnd) => set({ customStart, customEnd, dateRange: "custom" }),
  setCategories: (categories) => set({ categories }),
  setTypes: (types) => set({ types }),
  reset: () => set({ dateRange: "cycle", customStart: null, customEnd: null, categories: [], types: [] }),
}));
