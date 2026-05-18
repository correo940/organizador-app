-- Create Recurring Transactions Table for Savings
CREATE TABLE IF NOT EXISTS savings_recurring_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES savings_accounts(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL, -- Positive for income, negative for expense
  description TEXT NOT NULL,
  day_of_month INTEGER NOT NULL CHECK (day_of_month >= 1 AND day_of_month <= 31),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE, -- NULL = indefinite
  is_active BOOLEAN DEFAULT true,
  last_executed_date DATE, -- Last date this recurring was executed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE savings_recurring_transactions ENABLE ROW LEVEL SECURITY;

-- Policy
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'savings_recurring_transactions' AND policyname = 'Users can manage their own recurring transactions') THEN
        CREATE POLICY "Users can manage their own recurring transactions" ON savings_recurring_transactions FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_savings_recurring_user ON savings_recurring_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_recurring_account ON savings_recurring_transactions(account_id);
