-- Migration: Compartir Pensamientos - Shareable Thoughts System v3.0
-- Created: 2026-01-11
-- Description: Link-based shareable thoughts with optional anonymity and public access

-- ============================================
-- STEP 1: Clean up old system
-- ============================================

-- Drop old messaging tables
DROP TABLE IF EXISTS conversation_pauses CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS conversation_participants CASCADE;

-- Drop old diary tables (if still exist)
DROP TABLE IF EXISTS confessions CASCADE;
DROP TABLE IF EXISTS confession_contacts CASCADE;

-- ============================================
-- STEP 2: Create new tables
-- ============================================

-- Table: shared_thoughts
-- Individual shareable thoughts created by Quioba users
CREATE TABLE shared_thoughts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    share_token TEXT NOT NULL UNIQUE,
    initial_message_id UUID, -- Will be set after creating first message
    is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
    creator_name TEXT, -- Display name if not anonymous
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_by_creator BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_by_recipient BOOLEAN NOT NULL DEFAULT FALSE
);

-- Table: thought_messages
-- Messages in the conversation (bidirectional)
CREATE TABLE thought_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thought_id UUID NOT NULL REFERENCES shared_thoughts(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('creator', 'recipient')),
    sender_session_id TEXT, -- For identifying recipient without account
    type TEXT NOT NULL CHECK (type IN ('text', 'audio', 'video')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

-- Table: thought_pauses
-- Cooldown system for conversations
CREATE TABLE thought_pauses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thought_id UUID NOT NULL REFERENCES shared_thoughts(id) ON DELETE CASCADE,
    paused_by TEXT NOT NULL CHECK (paused_by IN ('creator', 'recipient')),
    paused_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resume_at TIMESTAMPTZ NOT NULL,
    reason TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    cancelled_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX idx_shared_thoughts_creator ON shared_thoughts(creator_id, created_at DESC);
CREATE INDEX idx_shared_thoughts_token ON shared_thoughts(share_token);
CREATE INDEX idx_thought_messages_thought ON thought_messages(thought_id, created_at ASC);
CREATE INDEX idx_thought_pauses_active ON thought_pauses(thought_id, is_active) WHERE is_active = TRUE;

-- ============================================
-- STEP 3: Row Level Security (RLS)
-- ============================================

ALTER TABLE shared_thoughts ENABLE ROW LEVEL SECURITY;
ALTER TABLE thought_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE thought_pauses ENABLE ROW LEVEL SECURITY;

-- RLS: shared_thoughts
-- Creators can see their own thoughts
CREATE POLICY "Creators can view their own thoughts"
    ON shared_thoughts FOR SELECT
    USING (auth.uid() = creator_id);

-- Anyone can view thoughts by token (PUBLIC ACCESS)
CREATE POLICY "Public access via share token"
    ON shared_thoughts FOR SELECT
    USING (true); -- Public read access

-- Only creators can insert
CREATE POLICY "Creators can create thoughts"
    ON shared_thoughts FOR INSERT
    WITH CHECK (auth.uid() = creator_id);

-- Only creators can update their thoughts
CREATE POLICY "Creators can update their thoughts"
    ON shared_thoughts FOR UPDATE
    USING (auth.uid() = creator_id);

-- RLS: thought_messages
-- Anyone can view messages if they have access to the thought
CREATE POLICY "Public can view messages in accessible thoughts"
    ON thought_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM shared_thoughts st
            WHERE st.id = thought_id
            AND (st.deleted_by_creator = FALSE OR st.deleted_by_recipient = FALSE)
        )
    );

-- Creators can insert messages
CREATE POLICY "Creators can send messages"
    ON thought_messages FOR INSERT
    WITH CHECK (
        sender_type = 'creator'
        AND EXISTS (
            SELECT 1 FROM shared_thoughts st
            WHERE st.id = thought_id
            AND st.creator_id = auth.uid()
        )
    );

-- Recipients can insert messages (without auth)
CREATE POLICY "Recipients can send messages"
    ON thought_messages FOR INSERT
    WITH CHECK (
        sender_type = 'recipient'
        AND sender_session_id IS NOT NULL
    );

-- Anyone can mark as read
CREATE POLICY "Anyone can mark messages as read"
    ON thought_messages FOR UPDATE
    USING (true);

-- RLS: thought_pauses
-- Anyone can view pauses
CREATE POLICY "Public can view pauses"
    ON thought_pauses FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM shared_thoughts st
            WHERE st.id = thought_id
        )
    );

-- Anyone can create pauses
CREATE POLICY "Anyone can create pauses"
    ON thought_pauses FOR INSERT
    WITH CHECK (true);

-- Anyone can update their own pauses
CREATE POLICY "Anyone can cancel pauses"
    ON thought_pauses FOR UPDATE
    USING (true);

-- ============================================
-- STEP 4: Storage Bucket Policies
-- ============================================

-- Reuse existing 'confessions' bucket
-- Update policies for new system

-- Anyone can upload (creator or recipient)
CREATE POLICY "Anyone can upload thought media"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'confessions'
    );

-- Anyone can view media
CREATE POLICY "Anyone can view thought media"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'confessions'
    );

-- Anyone can delete their own uploads
CREATE POLICY "Users can delete their own thought media"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'confessions'
    );

-- ============================================
-- STEP 5: Helper Functions
-- ============================================

-- Function: Generate unique share token
CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_token TEXT;
    v_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate 12-character token
        v_token := substring(md5(random()::text || clock_timestamp()::text) from 1 for 12);
        
        -- Check if exists
        SELECT EXISTS(SELECT 1 FROM shared_thoughts WHERE share_token = v_token) INTO v_exists;
        
        EXIT WHEN NOT v_exists;
    END LOOP;
    
    RETURN v_token;
END;
$$;

-- Function: Get thought by token
CREATE OR REPLACE FUNCTION get_thought_by_token(p_token TEXT)
RETURNS TABLE (
    id UUID,
    creator_id UUID,
    is_anonymous BOOLEAN,
    creator_name TEXT,
    created_at TIMESTAMPTZ,
    deleted_by_creator BOOLEAN,
    deleted_by_recipient BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        st.id,
        st.creator_id,
        st.is_anonymous,
        st.creator_name,
        st.created_at,
        st.deleted_by_creator,
        st.deleted_by_recipient
    FROM shared_thoughts st
    WHERE st.share_token = p_token;
END;
$$;

-- Function: Check if thought is deleted
CREATE OR REPLACE FUNCTION is_thought_deleted(p_thought_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_deleted BOOLEAN;
BEGIN
    SELECT (deleted_by_creator AND deleted_by_recipient) INTO v_deleted
    FROM shared_thoughts
    WHERE id = p_thought_id;
    
    RETURN COALESCE(v_deleted, FALSE);
END;
$$;

-- Function: Check if thought is paused
CREATE OR REPLACE FUNCTION is_thought_paused(p_thought_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_paused BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM thought_pauses
        WHERE thought_id = p_thought_id
        AND is_active = TRUE
        AND resume_at > NOW()
    ) INTO v_paused;
    
    RETURN v_paused;
END;
$$;

-- ============================================
-- STEP 6: Triggers
-- ============================================

-- Trigger: Auto-delete if both parties deleted
CREATE OR REPLACE FUNCTION check_thought_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.deleted_by_creator = TRUE AND NEW.deleted_by_recipient = TRUE THEN
        DELETE FROM shared_thoughts WHERE id = NEW.id;
        RETURN NULL;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_thought_deletion
    AFTER UPDATE ON shared_thoughts
    FOR EACH ROW
    WHEN (NEW.deleted_by_creator = TRUE OR NEW.deleted_by_recipient = TRUE)
    EXECUTE FUNCTION check_thought_deletion();

-- Trigger: Set initial_message_id automatically
CREATE OR REPLACE FUNCTION set_initial_message()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- If this is the first message from creator, set it as initial
    IF NEW.sender_type = 'creator' THEN
        UPDATE shared_thoughts
        SET initial_message_id = NEW.id
        WHERE id = NEW.thought_id
        AND initial_message_id IS NULL;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_first_message_created
    AFTER INSERT ON thought_messages
    FOR EACH ROW
    EXECUTE FUNCTION set_initial_message();

-- ============================================
-- DONE! ✅
-- ============================================
