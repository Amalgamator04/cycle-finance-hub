import { useFilters } from "@/store/filters";
import { useCategories } from "@/hooks/useFinance";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Filter, X, CalendarDays } from "lucide-react";
import { format } from "date-fns";

const presets: { label: string; value: "7d" | "30d" | "cycle" }[] = [
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "Cycle", value: "cycle" },
];

const types: ("income" | "expense" | "savings")[] = ["income", "expense", "savings"];

export function GlobalFilters() {
  const f = useFilters();
  const { data: categories } = useCategories();
  const hasActive = f.categories.length > 0 || f.types.length > 0 || f.dateRange !== "cycle";

  const toggle = <T,>(arr: T[], v: T): T[] => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3">
      <Filter className="h-4 w-4 text-muted-foreground ml-1" />
      <div className="flex gap-1">
        {presets.map((p) => (
          <Button
            key={p.value}
            size="sm"
            variant={f.dateRange === p.value ? "default" : "outline"}
            onClick={() => f.setDateRange(p.value)}
            className="h-8"
          >
            {p.label}
          </Button>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant={f.dateRange === "custom" ? "default" : "outline"} className="h-8 gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {f.dateRange === "custom" && f.customStart && f.customEnd
                ? `${format(new Date(f.customStart), "MMM d")} – ${format(new Date(f.customEnd), "MMM d")}`
                : "Custom"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={
                f.customStart && f.customEnd
                  ? { from: new Date(f.customStart), to: new Date(f.customEnd) }
                  : undefined
              }
              onSelect={(r: any) => {
                if (r?.from && r?.to) f.setCustom(format(r.from, "yyyy-MM-dd"), format(r.to, "yyyy-MM-dd"));
              }}
              numberOfMonths={2}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="mx-1 h-6 w-px bg-border" />

      <div className="flex flex-wrap gap-1">
        {types.map((t) => (
          <Badge
            key={t}
            variant={f.types.includes(t) ? "default" : "outline"}
            className="cursor-pointer capitalize"
            onClick={() => f.setTypes(toggle(f.types, t))}
          >
            {t}
          </Badge>
        ))}
      </div>

      {categories && categories.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-8">
              {f.categories.length ? `${f.categories.length} categories` : "All categories"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 max-h-72 overflow-auto">
            <div className="flex flex-wrap gap-1">
              {categories.map((c) => (
                <Badge
                  key={c.id}
                  variant={f.categories.includes(c.name) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => f.setCategories(toggle(f.categories, c.name))}
                >
                  {c.name}
                </Badge>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {hasActive && (
        <Button size="sm" variant="ghost" className="ml-auto h-8 gap-1" onClick={() => f.reset()}>
          <X className="h-3.5 w-3.5" /> Reset
        </Button>
      )}
    </div>
  );
}
