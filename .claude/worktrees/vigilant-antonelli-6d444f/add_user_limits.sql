-- Add this to your Supabase SQL Editor to enable individual user API limits

-- Table: Custom configurable limits per specific user per endpoint
CREATE TABLE IF NOT EXISTS user_api_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    monthly_limit INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, endpoint)
);

-- RLS Policies
ALTER TABLE user_api_limits ENABLE ROW LEVEL SECURITY;

-- Users can read their own custom limits
CREATE POLICY "Users can read own user_api_limits" ON user_api_limits FOR SELECT USING (auth.uid() = user_id);

-- Service role can do anything
CREATE POLICY "Service role can manage user_api_limits" ON user_api_limits FOR ALL USING (true);
