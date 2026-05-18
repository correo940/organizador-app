-- Add subscription tier to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium', 'family'));

-- Add avatar_url to profiles if not exists (it usually is in auth.users metadata, but having it here helps)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS custom_avatar_url TEXT;

-- Create contacts table for "Friends" system
CREATE TABLE IF NOT EXISTS contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'accepted', -- pending, accepted, blocked
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, contact_id)
);

-- RLS policies for contacts
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own contacts" 
ON contacts FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can add contacts" 
ON contacts FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contacts" 
ON contacts FOR DELETE 
USING (auth.uid() = user_id);
