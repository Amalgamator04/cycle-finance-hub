
# Personal Finance Analytics Dashboard

A single-user, no-auth fintech-style web app where every number, chart and insight is computed from a configurable **salary cycle** (default: day 7 → day 6 of next month). Dark-first UI inspired by Revolut/Robinhood, with a polished light mode available.

---

## 1. Visual Direction

- **Default theme:** dark, deep-navy surfaces with a vibrant accent (electric green for positive / coral for negative). Light mode toggle available, persisted.
- Rounded cards, soft inner borders, subtle shadows, generous spacing, tabular numerals for currency, smooth transitions.
- Fully responsive: sidebar collapses to icon rail on tablet, drawer on mobile; KPI cards stack; tables become condensed cards on small screens.
- All colors as HSL design tokens in `index.css`; semantic Tailwind tokens (no hardcoded colors in components).

---

## 2. App Shell

- **Sidebar** (collapsible icon rail): Dashboard, Transactions, Analytics, Categories, Settings.
- **Top bar**:
  - Left: logo + app name.
  - Center: current cycle label (e.g. *Apr 7 – May 6*) with a chevron to jump cycles.
  - Right: live date, ticking clock, cycle status pill (`Salary received` once today ≥ salary day, else `Cycle ending soon` with days-left).
- **Global filter bar** (Dashboard + Analytics): date range (Last 7d / Last 30d / Current cycle / Custom), category multi-select, type filter, visible reset chip.

---

## 3. Salary-Cycle Engine (core)

A single pure module `lib/cycle.ts` exposes:
- `getCycleForDate(date, salaryDay)` → `{ start, end, key }`
- `getCurrentCycle(salaryDay)`, `getPreviousCycles(n, salaryDay)`
- `daysLeftInCycle`, `daysElapsedInCycle`, `cycleLength`
- `groupTransactionsByCycle(transactions, salaryDay)`

Rule: if `txn.day >= salaryDay` → that month's cycle; else → previous month's cycle. Every KPI, chart, filter, budget check and insight consumes this module — no calendar-month logic anywhere.

---

## 4. Pages & Features

### Dashboard
- KPI cards (current cycle): Total Balance, Income, Expense, Savings — each with delta vs previous cycle.
- Cycle progress card: days left, days elapsed, % of cycle complete, daily burn rate, projected end-of-cycle spend.
- Budget summary: overall budget bar + top 3 category bars; red highlight + alert pill when ≥90%.
- Smart insights strip (computed, not hardcoded): top spending category, biggest delta, savings rate, pace warning, projected overspend ETA.
- Recent transactions table (last 8) with quick-edit/delete.
- Empty states with a "Add your first transaction" CTA.

### Transactions
- Searchable, sortable, filterable table (date, amount, type, category, recurring badge).
- Add/Edit dialog: amount, type (income/expense/savings), category (filtered by type), description, date (default today), recurring toggle.
- Bulk select → delete. Inline validation, optimistic updates via React Query.

### Analytics
All cycle-based:
- **Cycle Trend** (line): income vs expense vs savings across last 6 cycles.
- **Expense Breakdown** (donut): category share for selected range.
- **Cycle Comparison** (grouped bars): last 5–6 cycles side by side.
- **Savings Rate** (line/area): savings ÷ income % per cycle.
- **Burn Rate Trend** (line): avg daily spend per cycle.
- Stat cards: top spending category, highest-expense cycle, avg expense/cycle, avg savings rate, expense Δ vs prev, income stability (stdev-based).

### Categories
- Grid of cards grouped by type with usage counts (transactions referencing it).
- Add/Edit/Delete with safe-delete confirm (warns if in use; offers reassign-to or block delete).
- Seeded defaults on first load.

### Settings (grouped accordion or tabs)
- **Salary & Cycle:** salary day picker (1–28); changing it triggers global recompute.
- **Currency:** symbol + code (default ₹ INR); applied via a `formatCurrency` util used everywhere.
- **Categories:** quick link + inline CRUD.
- **Budgets:** overall cycle budget + per-category budgets, with progress preview.
- **Analytics:** toggle each chart on/off, default date filter.
- **UI Preferences:** dark/light/auto, compact mode, dashboard card visibility checkboxes.
- **App Behavior:** smart insights toggle, spending alerts toggle, recurring auto-generation toggle.
- **Data:** export CSV (transactions / categories / budgets / recurring / settings — selectable), import CSV (with preview + validation), delete-all with typed confirmation.

Settings persist to Supabase `settings` table AND mirror to `localStorage` for instant boot; Supabase value wins on hydration.

---

## 5. Analytics Engine

Pure functions in `lib/analytics.ts`, fully unit-testable, no UI coupling:
- `computeCycleTotals`, `savingsRate`, `cycleDelta`, `topCategory`, `avgDailySpend`, `projectedSpend`, `paceVsAverage`, `budgetStatus`, `incomeStability`.
- Insights generator returns a typed `Insight[]` with severity + message; UI just renders. Examples produced from real data:
  - "Expenses ↑ 18% vs last cycle"
  - "You may exceed Food budget in ~5 days at current pace"
  - "Burn rate ₹612/day — 14% above your 6-cycle average"

---

## 6. Recurring Transactions

- Stored as templates with `day_of_cycle` (1..cycleLength) and `active` flag.
- **Auto-generate on cycle start:** on app load, if current cycle has no materialized entries for an active template whose `day_of_cycle` ≤ today, insert them. Idempotent via a `(template_id, cycle_key)` uniqueness check stored on the generated transaction (e.g., a `source_recurring_id` + `cycle_key` pair).
- Manage page section under Settings → Recurring (list, toggle active, edit, delete).

---

## 7. Data Model (Supabase)

Tables: `transactions`, `categories`, `settings`, `budgets`, `recurring_transactions` exactly as specified, plus:
- `transactions.source_recurring_id uuid null` and `transactions.cycle_key text` (denormalized for fast filters).
- Indexes on `transactions(date)`, `transactions(cycle_key)`, `budgets(cycle_key, category)`.
- Seed default categories on first run (idempotent insert).
- **RLS:** enabled on all tables with permissive `USING (true) WITH CHECK (true)` policies for anon — single shared dataset as you chose. A clear note will be added in Settings → Data explaining anyone with the URL can edit.

---

## 8. Tech Choices

- React + TypeScript + Vite + Tailwind + shadcn/ui (already in project).
- **Charts:** Recharts (works cleanly with the existing stack; responsive containers).
- **Data:** Supabase JS + TanStack Query for caching, optimistic updates, and minimal re-renders.
- **Dates:** `date-fns`.
- **State:** React Query for server state; a tiny Zustand store for UI prefs + cached settings hydration.
- **Structure:**
  ```text
  src/
    components/  (ui, layout, charts, forms, kpi)
    pages/       (Dashboard, Transactions, Analytics, Categories, Settings)
    lib/         (cycle.ts, analytics.ts, format.ts, csv.ts, supabase.ts)
    hooks/       (useTransactions, useSettings, useBudgets, useRecurring, useCycle)
    store/       (uiPrefs.ts)
    types/
  ```

---

## 9. Build Order

1. Design tokens (dark-first navy palette) + app shell with sidebar/topbar + routing.
2. Supabase schema migration + seed defaults + RLS policies.
3. Settings store + cycle engine + currency formatter (foundations).
4. Transactions CRUD + Categories CRUD.
5. Dashboard KPIs, cycle progress, recent transactions.
6. Budgets + budget alerts.
7. Analytics page (5 charts + stat cards).
8. Insights engine wired to Dashboard + Analytics.
9. Recurring transactions + auto-generation on boot.
10. Settings page (all 8 sections) + CSV import/export + delete-all.
11. Polish: empty states, loading skeletons, mobile pass, light-mode pass.

---

## 10. Notes & Confirmed Decisions

- **Balance formula:** `Income − Expense − Savings` (consistent everywhere).
- **Recurring:** auto-generated when a new cycle begins (idempotent).
- **Auth:** none; single shared dataset with permissive RLS.
- **Theme:** dark-first deep navy default, light mode available via toggle.
