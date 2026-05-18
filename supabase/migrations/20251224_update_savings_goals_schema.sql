-- Add columns to savings_goals
ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS linked_account_id UUID REFERENCES savings_accounts(id) ON DELETE SET NULL;
ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS interest_rate NUMERIC DEFAULT 0;
