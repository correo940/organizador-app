-- Create Savings Tables

-- 1. Banks (Savings Accounts)
CREATE TABLE IF NOT EXISTS savings_accounts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g. "Santander Principal"
  bank_name TEXT, -- e.g. "Santander", "BBVA"
  logo_url TEXT, -- URL or icon name
  color TEXT,
  password_id UUID REFERENCES passwords(id) ON DELETE SET NULL, -- Optional link to password
  current_balance NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Monthly Records (Snapshots)
CREATE TABLE IF NOT EXISTS savings_records (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  account_id UUID REFERENCES savings_accounts(id) ON DELETE CASCADE,
  month_date DATE NOT NULL, -- YYYY-MM-01
  balance_start NUMERIC DEFAULT 0, -- Day 1
  balance_end NUMERIC DEFAULT 0,   -- Day 31
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(account_id, month_date)
);

-- 3. Goals (Buckets)
CREATE TABLE IF NOT EXISTS savings_goals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount NUMERIC NOT NULL,
  current_amount NUMERIC DEFAULT 0,
  deadline DATE,
  icon TEXT,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE savings_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'savings_accounts' AND policyname = 'Users can manage their own accounts') THEN
        CREATE POLICY "Users can manage their own accounts" ON savings_accounts FOR ALL USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'savings_records' AND policyname = 'Users can manage their own records') THEN
        CREATE POLICY "Users can manage their own records" ON savings_records FOR ALL USING (
            account_id IN (SELECT id FROM savings_accounts WHERE user_id = auth.uid())
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'savings_goals' AND policyname = 'Users can manage their own goals') THEN
        CREATE POLICY "Users can manage their own goals" ON savings_goals FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;
