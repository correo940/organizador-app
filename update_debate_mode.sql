-- Add debate_mode column to debate_rooms
ALTER TABLE debate_rooms 
ADD COLUMN IF NOT EXISTS debate_mode TEXT DEFAULT 'both' CHECK (debate_mode IN ('text', 'voice', 'both'));

-- Add max_characters column if it doesn't exist (it should be rule_max_chars based on create_debate_tables.sql but let's check)
-- In create_debate_tables.sql it was named rule_max_chars
-- But in create-debate-dialog.tsx it tries to insert max_characters
-- Let's check which one we should use. 
-- Ideally we should rename the columns in the DB to match the code or vice versa.
-- Code uses: max_characters, max_voice_seconds
-- DB (create_debate_tables.sql) uses: rule_max_chars, rule_max_seconds

-- OPTION 1: Add the columns that the Code expects
ALTER TABLE debate_rooms 
ADD COLUMN IF NOT EXISTS max_characters INTEGER DEFAULT 500,
ADD COLUMN IF NOT EXISTS max_voice_seconds INTEGER DEFAULT 60;

-- OPTION 2: Drop the old columns if they are not used
-- ALTER TABLE debate_rooms DROP COLUMN IF EXISTS rule_max_chars;
-- ALTER TABLE debate_rooms DROP COLUMN IF EXISTS rule_max_seconds;
