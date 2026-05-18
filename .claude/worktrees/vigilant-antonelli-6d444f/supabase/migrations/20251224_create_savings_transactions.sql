-- Create Savings Goal Transactions Table
CREATE TABLE IF NOT EXISTS savings_goal_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  goal_id UUID REFERENCES savings_goals(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL, -- Positive for deposit, negative for withdrawal
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  description TEXT, -- e.g. "Transferencia mensual", "Retiro para reserva"
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE savings_goal_transactions ENABLE ROW LEVEL SECURITY;

-- Policy
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'savings_goal_transactions' AND policyname = 'Users can manage their own goal transactions') THEN
        CREATE POLICY "Users can manage their own goal transactions" ON savings_goal_transactions FOR ALL USING (
            goal_id IN (SELECT id FROM savings_goals WHERE user_id = auth.uid())
        );
    END IF;
END $$;
