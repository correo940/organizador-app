-- Add interest_rate to savings_accounts
ALTER TABLE savings_accounts ADD COLUMN IF NOT EXISTS interest_rate NUMERIC DEFAULT 0;

-- Create Savings Account Transactions Table
CREATE TABLE IF NOT EXISTS savings_account_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  account_id UUID REFERENCES savings_accounts(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL, -- Positive for deposit, negative for withdrawal
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE savings_account_transactions ENABLE ROW LEVEL SECURITY;

-- Policy
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'savings_account_transactions' AND policyname = 'Users can manage their own account transactions') THEN
        CREATE POLICY "Users can manage their own account transactions" ON savings_account_transactions FOR ALL USING (
            account_id IN (SELECT id FROM savings_accounts WHERE user_id = auth.uid())
        );
    END IF;
END $$;
