-- Run this command in your Supabase SQL Editor

ALTER TABLE journal_entries 
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'journal_entries';
