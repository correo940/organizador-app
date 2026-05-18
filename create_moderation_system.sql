-- ============================================
-- Moderation System Database Migration
-- ============================================

-- 1. Table: debate_reports
-- Stores reports made by moderators/users about offensive messages
CREATE TABLE IF NOT EXISTS debate_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    debate_id UUID REFERENCES debate_rooms(id) ON DELETE CASCADE NOT NULL,
    message_id UUID REFERENCES debate_messages(id) ON DELETE CASCADE NOT NULL,
    reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action_taken TEXT, -- 'warning', 'muted', 'banned', 'message_deleted', 'none'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

-- 2. Table: debate_user_restrictions
-- Stores mutes and bans for users in specific debates
CREATE TABLE IF NOT EXISTS debate_user_restrictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    debate_id UUID REFERENCES debate_rooms(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    restriction_type TEXT NOT NULL CHECK (restriction_type IN ('muted', 'banned')),
    duration_minutes INTEGER, -- NULL = permanent
    expires_at TIMESTAMPTZ,
    reason TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(debate_id, user_id, restriction_type)
);

-- 3. Table: debate_warnings
-- Stores warnings given to users
CREATE TABLE IF NOT EXISTS debate_warnings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    debate_id UUID REFERENCES debate_rooms(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    reason TEXT NOT NULL,
    related_message_id UUID REFERENCES debate_messages(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Modify debate_messages table for soft delete
ALTER TABLE debate_messages 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================
-- RPC Functions
-- ============================================

-- Function: report_message
-- Allows users to report offensive messages
CREATE OR REPLACE FUNCTION report_message(
    p_debate_id UUID,
    p_message_id UUID,
    p_reason TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_report_id UUID;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Create report
    INSERT INTO debate_reports (debate_id, message_id, reported_by, reason)
    VALUES (p_debate_id, p_message_id, v_user_id, p_reason)
    RETURNING id INTO v_report_id;
    
    RETURN jsonb_build_object('success', true, 'report_id', v_report_id);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Function: check_user_restrictions
-- Checks if user has active restrictions in a debate
CREATE OR REPLACE FUNCTION check_user_restrictions(
    p_debate_id UUID,
    p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_restriction RECORD;
BEGIN
    -- Check for active restrictions
    SELECT * INTO v_restriction
    FROM debate_user_restrictions
    WHERE debate_id = p_debate_id
    AND user_id = p_user_id
    AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1;
    
    IF v_restriction IS NOT NULL THEN
        RETURN jsonb_build_object(
            'restricted', true,
            'type', v_restriction.restriction_type,
            'reason', v_restriction.reason,
            'expires_at', v_restriction.expires_at
        );
    ELSE
        RETURN jsonb_build_object('restricted', false);
    END IF;
END;
$$;

-- Function: mute_user_in_debate
-- Mutes a user in a debate (prevents sending messages)
CREATE OR REPLACE FUNCTION mute_user_in_debate(
    p_debate_id UUID,
    p_user_id UUID,
    p_duration_minutes INTEGER,
    p_reason TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_moderator_id UUID;
    v_user_role TEXT;
    v_expires_at TIMESTAMPTZ;
BEGIN
    v_moderator_id := auth.uid();
    
    IF v_moderator_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Check if moderator has permission (get role)
    v_user_role := get_user_debate_role(p_debate_id, v_moderator_id);
    
    IF v_user_role NOT IN ('admin', 'moderator') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
    END IF;
    
    -- Calculate expiration
    IF p_duration_minutes IS NOT NULL AND p_duration_minutes > 0 THEN
        v_expires_at := NOW() + (p_duration_minutes || ' minutes')::INTERVAL;
    ELSE
        v_expires_at := NULL; -- Permanent
    END IF;
    
    -- Insert or update restriction
    INSERT INTO debate_user_restrictions (debate_id, user_id, restriction_type, duration_minutes, expires_at, reason, created_by)
    VALUES (p_debate_id, p_user_id, 'muted', p_duration_minutes, v_expires_at, p_reason, v_moderator_id)
    ON CONFLICT (debate_id, user_id, restriction_type) 
    DO UPDATE SET 
        duration_minutes = EXCLUDED.duration_minutes,
        expires_at = EXCLUDED.expires_at,
        reason = EXCLUDED.reason,
        created_by = EXCLUDED.created_by,
        created_at = NOW();
    
    RETURN jsonb_build_object('success', true, 'expires_at', v_expires_at);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Function: ban_user_from_debate
-- Bans a user from a debate (cannot access it)
CREATE OR REPLACE FUNCTION ban_user_from_debate(
    p_debate_id UUID,
    p_user_id UUID,
    p_reason TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_moderator_id UUID;
    v_user_role TEXT;
BEGIN
    v_moderator_id := auth.uid();
    
    IF v_moderator_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Check if moderator has permission (only admin can ban)
    v_user_role := get_user_debate_role(p_debate_id, v_moderator_id);
    
    IF v_user_role != 'admin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only admins can ban users');
    END IF;
    
    -- Insert or update ban
    INSERT INTO debate_user_restrictions (debate_id, user_id, restriction_type, duration_minutes, expires_at, reason, created_by)
    VALUES (p_debate_id, p_user_id, 'banned', NULL, NULL, p_reason, v_moderator_id)
    ON CONFLICT (debate_id, user_id, restriction_type) 
    DO UPDATE SET 
        reason = EXCLUDED.reason,
        created_by = EXCLUDED.created_by,
        created_at = NOW();
    
    RETURN jsonb_build_object('success', true);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Function: add_warning_to_user
-- Adds a warning to a user's record
CREATE OR REPLACE FUNCTION add_warning_to_user(
    p_debate_id UUID,
    p_user_id UUID,
    p_reason TEXT,
    p_message_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_moderator_id UUID;
    v_user_role TEXT;
    v_warning_id UUID;
BEGIN
    v_moderator_id := auth.uid();
    
    IF v_moderator_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Check if moderator has permission
    v_user_role := get_user_debate_role(p_debate_id, v_moderator_id);
    
    IF v_user_role NOT IN ('admin', 'moderator') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
    END IF;
    
    -- Add warning
    INSERT INTO debate_warnings (debate_id, user_id, reason, related_message_id, created_by)
    VALUES (p_debate_id, p_user_id, p_reason, p_message_id, v_moderator_id)
    RETURNING id INTO v_warning_id;
    
    RETURN jsonb_build_object('success', true, 'warning_id', v_warning_id);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Function: review_report
-- Allows admin to review and take action on a report
CREATE OR REPLACE FUNCTION review_report(
    p_report_id UUID,
    p_action TEXT, -- 'warning', 'mute', 'ban', 'delete', 'dismiss'
    p_duration_minutes INTEGER DEFAULT NULL,
    p_reason TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reviewer_id UUID;
    v_report RECORD;
    v_user_role TEXT;
    v_result JSONB;
BEGIN
    v_reviewer_id := auth.uid();
    
    IF v_reviewer_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Get report details
    SELECT * INTO v_report
    FROM debate_reports
    WHERE id = p_report_id;
    
    IF v_report IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Report not found');
    END IF;
    
    -- Check permissions
    v_user_role := get_user_debate_role(v_report.debate_id, v_reviewer_id);
    
    IF v_user_role != 'admin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only admins can review reports');
    END IF;
    
    -- Get reported user from message
    DECLARE
        v_reported_user_id UUID;
    BEGIN
        SELECT sender_id INTO v_reported_user_id
        FROM debate_messages
        WHERE id = v_report.message_id;
        
        -- Take action based on decision
        CASE p_action
            WHEN 'warning' THEN
                v_result := add_warning_to_user(v_report.debate_id, v_reported_user_id, COALESCE(p_reason, v_report.reason), v_report.message_id);
            WHEN 'mute' THEN
                v_result := mute_user_in_debate(v_report.debate_id, v_reported_user_id, p_duration_minutes, COALESCE(p_reason, v_report.reason));
            WHEN 'ban' THEN
                v_result := ban_user_from_debate(v_report.debate_id, v_reported_user_id, COALESCE(p_reason, v_report.reason));
            WHEN 'delete' THEN
                UPDATE debate_messages 
                SET deleted_at = NOW(), deleted_by = v_reviewer_id
                WHERE id = v_report.message_id;
                v_result := jsonb_build_object('success', true);
            WHEN 'dismiss' THEN
                v_result := jsonb_build_object('success', true);
            ELSE
                RETURN jsonb_build_object('success', false, 'error', 'Invalid action');
        END CASE;
        
        -- Update report status
        UPDATE debate_reports
        SET status = 'reviewed',
            reviewed_by = v_reviewer_id,
            reviewed_at = NOW(),
            action_taken = p_action
        WHERE id = p_report_id;
        
        RETURN jsonb_build_object('success', true, 'action_result', v_result);
    END;
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Function: remove_restriction
-- Removes a restriction (unmute/unban)
CREATE OR REPLACE FUNCTION remove_restriction(
    p_debate_id UUID,
    p_user_id UUID,
    p_restriction_type TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_moderator_id UUID;
    v_user_role TEXT;
BEGIN
    v_moderator_id := auth.uid();
    
    IF v_moderator_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Check permissions
    v_user_role := get_user_debate_role(p_debate_id, v_moderator_id);
    
    IF v_user_role NOT IN ('admin', 'moderator') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
    END IF;
    
    -- Remove restriction
    DELETE FROM debate_user_restrictions
    WHERE debate_id = p_debate_id
    AND user_id = p_user_id
    AND restriction_type = p_restriction_type;
    
    RETURN jsonb_build_object('success', true);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================
-- Row Level Security Policies
-- ============================================

-- Enable RLS
ALTER TABLE debate_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE debate_user_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE debate_warnings ENABLE ROW LEVEL SECURITY;

-- Policies for debate_reports
CREATE POLICY "Users can create reports" ON debate_reports
    FOR INSERT
    WITH CHECK (auth.uid() = reported_by);

CREATE POLICY "Moderators can view reports" ON debate_reports
    FOR SELECT
    USING (
        get_user_debate_role(debate_id, auth.uid()) IN ('admin', 'moderator')
    );

-- Policies for debate_user_restrictions
CREATE POLICY "Moderators can view restrictions" ON debate_user_restrictions
    FOR SELECT
    USING (
        get_user_debate_role(debate_id, auth.uid()) IN ('admin', 'moderator')
        OR user_id = auth.uid()
    );

-- Policies for debate_warnings
CREATE POLICY "Users can view their own warnings" ON debate_warnings
    FOR SELECT
    USING (
        user_id = auth.uid()
        OR get_user_debate_role(debate_id, auth.uid()) IN ('admin', 'moderator')
    );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_reports_debate_status ON debate_reports(debate_id, status);
CREATE INDEX IF NOT EXISTS idx_restrictions_debate_user ON debate_user_restrictions(debate_id, user_id);
CREATE INDEX IF NOT EXISTS idx_restrictions_expires ON debate_user_restrictions(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_warnings_debate_user ON debate_warnings(debate_id, user_id);
