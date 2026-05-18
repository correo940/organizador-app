-- Migration: Transform Compartir Pensamientos to Real Messaging System
-- Created: 2026-01-11
-- Description: Remove private diary tables, create user-to-user messaging with pause/cooldown features

-- ============================================
-- STEP 1: Clean up old system
-- ============================================

-- Drop old tables (cascade to remove dependencies)
DROP TABLE IF EXISTS confessions CASCADE;
DROP TABLE IF EXISTS confession_contacts CASCADE;

-- ============================================
-- STEP 2: Create new messaging tables
-- ============================================

-- Table: conversation_participants
-- Stores relationships between two users who can message each other
CREATE TABLE conversation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id_1 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_id_2 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure user_id_1 < user_id_2 for consistency (no duplicates)
    CONSTRAINT ordered_users CHECK (user_id_1 < user_id_2),
    CONSTRAINT unique_participant_pair UNIQUE (user_id_1, user_id_2)
);

-- Table: conversations
-- Metadata for each conversation between two users
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id UUID NOT NULL REFERENCES conversation_participants(id) ON DELETE CASCADE,
    last_message_at TIMESTAMPTZ,
    unread_count_user1 INTEGER NOT NULL DEFAULT 0,
    unread_count_user2 INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: messages
-- Individual messages (text, audio, video)
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('text', 'audio', 'video')),
    content TEXT NOT NULL, -- text content or storage path for media
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

-- Table: conversation_pauses
-- Active pauses/cooldowns on conversations
CREATE TABLE conversation_pauses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    paused_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    paused_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resume_at TIMESTAMPTZ NOT NULL,
    reason TEXT, -- optional: "necesito tiempo", "muy enfadado", etc.
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    cancelled_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_active_pauses ON conversation_pauses(conversation_id, is_active) WHERE is_active = TRUE;

-- ============================================
-- STEP 3: Row Level Security (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_pauses ENABLE ROW LEVEL SECURITY;

-- RLS: conversation_participants
-- Users can only see their own participant relationships
CREATE POLICY "Users can view their own participant relationships"
    ON conversation_participants FOR SELECT
    USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

CREATE POLICY "Users can create participant relationships"
    ON conversation_participants FOR INSERT
    WITH CHECK (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

-- RLS: conversations
-- Users can see conversations they're part of
CREATE POLICY "Users can view their conversations"
    ON conversations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversation_participants cp
            WHERE cp.id = participant_id
            AND (cp.user_id_1 = auth.uid() OR cp.user_id_2 = auth.uid())
        )
    );

CREATE POLICY "Users can create conversations"
    ON conversations FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM conversation_participants cp
            WHERE cp.id = participant_id
            AND (cp.user_id_1 = auth.uid() OR cp.user_id_2 = auth.uid())
        )
    );

CREATE POLICY "Users can update their conversations"
    ON conversations FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM conversation_participants cp
            WHERE cp.id = participant_id
            AND (cp.user_id_1 = auth.uid() OR cp.user_id_2 = auth.uid())
        )
    );

-- RLS: messages
-- Users can see messages in their conversations
CREATE POLICY "Users can view messages in their conversations"
    ON messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversations c
            JOIN conversation_participants cp ON c.participant_id = cp.id
            WHERE c.id = conversation_id
            AND (cp.user_id_1 = auth.uid() OR cp.user_id_2 = auth.uid())
        )
    );

CREATE POLICY "Users can send messages in their conversations"
    ON messages FOR INSERT
    WITH CHECK (
        sender_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM conversations c
            JOIN conversation_participants cp ON c.participant_id = cp.id
            WHERE c.id = conversation_id
            AND (cp.user_id_1 = auth.uid() OR cp.user_id_2 = auth.uid())
        )
    );

CREATE POLICY "Users can update their own messages (mark as read)"
    ON messages FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM conversations c
            JOIN conversation_participants cp ON c.participant_id = cp.id
            WHERE c.id = conversation_id
            AND (cp.user_id_1 = auth.uid() OR cp.user_id_2 = auth.uid())
        )
    );

-- RLS: conversation_pauses
-- Users can see pauses in their conversations
CREATE POLICY "Users can view pauses in their conversations"
    ON conversation_pauses FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversations c
            JOIN conversation_participants cp ON c.participant_id = cp.id
            WHERE c.id = conversation_id
            AND (cp.user_id_1 = auth.uid() OR cp.user_id_2 = auth.uid())
        )
    );

CREATE POLICY "Users can create pauses in their conversations"
    ON conversation_pauses FOR INSERT
    WITH CHECK (
        paused_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM conversations c
            JOIN conversation_participants cp ON c.participant_id = cp.id
            WHERE c.id = conversation_id
            AND (cp.user_id_1 = auth.uid() OR cp.user_id_2 = auth.uid())
        )
    );

CREATE POLICY "Users can cancel their own pauses"
    ON conversation_pauses FOR UPDATE
    USING (paused_by = auth.uid());

-- ============================================
-- STEP 4: Storage Bucket Configuration
-- ============================================

-- Update existing 'confessions' bucket to 'thought_messages'
-- Note: Run this manually in Supabase dashboard or via API
-- We'll reuse the existing bucket and update policies

-- Storage policies for message media (audio/video)
CREATE POLICY "Users can upload media to their conversations"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'confessions'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can view media in their conversations"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'confessions'
        AND (
            auth.uid()::text = (storage.foldername(name))[1]
            OR EXISTS (
                SELECT 1 FROM messages m
                JOIN conversations c ON m.conversation_id = c.id
                JOIN conversation_participants cp ON c.participant_id = cp.id
                WHERE m.content = name
                AND (cp.user_id_1 = auth.uid() OR cp.user_id_2 = auth.uid())
            )
        )
    );

CREATE POLICY "Users can delete their own media"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'confessions'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- ============================================
-- STEP 5: Helper Functions
-- ============================================

-- Function: Get user email by ID
CREATE OR REPLACE FUNCTION get_user_email(user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_email TEXT;
BEGIN
    SELECT email INTO v_email
    FROM auth.users
    WHERE id = user_id;
    
    RETURN v_email;
END;
$$;

-- Function: Get or create conversation between two users
CREATE OR REPLACE FUNCTION get_or_create_conversation(other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_participant_id UUID;
    v_conversation_id UUID;
    v_user1 UUID;
    v_user2 UUID;
BEGIN
    -- Ensure user1 < user2 for consistency
    IF auth.uid() < other_user_id THEN
        v_user1 := auth.uid();
        v_user2 := other_user_id;
    ELSE
        v_user1 := other_user_id;
        v_user2 := auth.uid();
    END IF;

    -- Get or create participant relationship
    INSERT INTO conversation_participants (user_id_1, user_id_2)
    VALUES (v_user1, v_user2)
    ON CONFLICT (user_id_1, user_id_2) DO NOTHING
    RETURNING id INTO v_participant_id;

    -- If not inserted (already exists), get existing
    IF v_participant_id IS NULL THEN
        SELECT id INTO v_participant_id
        FROM conversation_participants
        WHERE user_id_1 = v_user1 AND user_id_2 = v_user2;
    END IF;

    -- Get or create conversation
    INSERT INTO conversations (participant_id)
    VALUES (v_participant_id)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_conversation_id;

    -- If not inserted, get existing
    IF v_conversation_id IS NULL THEN
        SELECT id INTO v_conversation_id
        FROM conversations
        WHERE participant_id = v_participant_id;
    END IF;

    RETURN v_conversation_id;
END;
$$;

-- Function: Check if conversation is currently paused
CREATE OR REPLACE FUNCTION is_conversation_paused(conv_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_paused BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM conversation_pauses
        WHERE conversation_id = conv_id
        AND is_active = TRUE
        AND resume_at > NOW()
    ) INTO v_paused;

    RETURN v_paused;
END;
$$;

-- ============================================
-- STEP 6: Triggers
-- ============================================

-- Trigger: Update last_message_at when new message is sent
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE conversations
    SET last_message_at = NEW.created_at
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_message_created
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_timestamp();

-- Trigger: Auto-deactivate expired pauses
CREATE OR REPLACE FUNCTION deactivate_expired_pauses()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE conversation_pauses
    SET is_active = FALSE
    WHERE is_active = TRUE
    AND resume_at <= NOW();
    RETURN NULL;
END;
$$;

-- Note: This should be run periodically via a cron job or Edge Function
-- For now, we'll check on query time

-- ============================================
-- DONE! ✅
-- ============================================
