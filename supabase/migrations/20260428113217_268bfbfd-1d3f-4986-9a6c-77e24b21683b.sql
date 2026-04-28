
-- Categories
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('income','expense','savings')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(name, type)
);

-- Transactions
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric NOT NULL,
  type text NOT NULL CHECK (type IN ('income','expense','savings')),
  category text NOT NULL,
  description text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  is_recurring boolean NOT NULL DEFAULT false,
  source_recurring_id uuid,
  cycle_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tx_date ON public.transactions(date);
CREATE INDEX idx_tx_cycle ON public.transactions(cycle_key);

-- Settings (key/value)
CREATE TABLE public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Budgets
CREATE TABLE public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text,
  amount numeric NOT NULL,
  cycle_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_budgets_cycle ON public.budgets(cycle_key, category);

-- Recurring transactions
CREATE TABLE public.recurring_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric NOT NULL,
  type text NOT NULL CHECK (type IN ('income','expense','savings')),
  category text NOT NULL,
  description text,
  day_of_cycle int NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS, permissive policies (single shared dataset, no auth)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_all_categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_settings" ON public.settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_budgets" ON public.budgets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_recurring" ON public.recurring_transactions FOR ALL USING (true) WITH CHECK (true);

-- Seed default categories
INSERT INTO public.categories (name, type) VALUES
('Food','expense'),('Rent','expense'),('Travel','expense'),('Bills','expense'),
('Shopping','expense'),('Health','expense'),('Entertainment','expense'),
('Salary','income'),('Freelance','income'),('Bonus','income'),
('Investment','savings'),('Emergency Fund','savings')
ON CONFLICT (name, type) DO NOTHING;
