-- Create table for Debate Roles (Admin, Moderator, Participant)
CREATE TABLE IF NOT EXISTS debate_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    debate_id UUID REFERENCES debate_rooms(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'moderator', 'participant')),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID REFERENCES auth.users(id),
    UNIQUE(debate_id, user_id)
);

-- Enable RLS
ALTER TABLE debate_roles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see roles in debates they participate in
CREATE POLICY "View Debate Roles" ON debate_roles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM debate_rooms 
            WHERE debate_rooms.id = debate_roles.debate_id 
            AND (
                debate_rooms.is_public = TRUE 
                OR debate_rooms.creator_id = auth.uid() 
                OR debate_rooms.guest_id = auth.uid()
            )
        )
    );

-- Policy: Only admins can assign roles
CREATE POLICY "Assign Roles" ON debate_roles
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM debate_rooms
            WHERE debate_rooms.id = debate_roles.debate_id
            AND debate_rooms.creator_id = auth.uid()
        )
    );

-- Policy: Only admins can update roles
CREATE POLICY "Update Roles" ON debate_roles
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM debate_rooms
            WHERE debate_rooms.id = debate_roles.debate_id
            AND debate_rooms.creator_id = auth.uid()
        )
    );

-- Function to automatically assign admin role to debate creator
CREATE OR REPLACE FUNCTION assign_creator_as_admin()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO debate_roles (debate_id, user_id, role, assigned_by)
    VALUES (NEW.id, NEW.creator_id, 'admin', NEW.creator_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-assign admin role on debate creation
DROP TRIGGER IF EXISTS auto_assign_creator_admin ON debate_rooms;
CREATE TRIGGER auto_assign_creator_admin
    AFTER INSERT ON debate_rooms
    FOR EACH ROW
    EXECUTE FUNCTION assign_creator_as_admin();

-- Function to assign/update debate role
CREATE OR REPLACE FUNCTION assign_debate_role(
    p_debate_id UUID,
    p_user_id UUID,
    p_role TEXT
) RETURNS VOID AS $$
DECLARE
    v_is_admin BOOLEAN;
BEGIN
    -- Check if caller is admin of the debate
    SELECT EXISTS (
        SELECT 1 FROM debate_rooms
        WHERE id = p_debate_id
        AND creator_id = auth.uid()
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Only debate admins can assign roles';
    END IF;

    -- Insert or update role
    INSERT INTO debate_roles (debate_id, user_id, role, assigned_by)
    VALUES (p_debate_id, p_user_id, p_role, auth.uid())
    ON CONFLICT (debate_id, user_id) 
    DO UPDATE SET 
        role = p_role, 
        assigned_at = NOW(),
        assigned_by = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete a debate message (for moderators)
CREATE OR REPLACE FUNCTION delete_debate_message(
    p_message_id UUID
) RETURNS VOID AS $$
DECLARE
    v_room_id UUID;
    v_has_permission BOOLEAN;
BEGIN
    -- Get room_id from message
    SELECT room_id INTO v_room_id 
    FROM debate_messages 
    WHERE id = p_message_id;

    IF v_room_id IS NULL THEN
        RAISE EXCEPTION 'Message not found';
    END IF;

    -- Check if user has moderator or admin role
    SELECT EXISTS (
        SELECT 1 FROM debate_roles
        WHERE debate_id = v_room_id
        AND user_id = auth.uid()
        AND role IN ('admin', 'moderator')
    ) OR EXISTS (
        -- Or is the room creator
        SELECT 1 FROM debate_rooms
        WHERE id = v_room_id
        AND creator_id = auth.uid()
    ) INTO v_has_permission;

    IF NOT v_has_permission THEN
        RAISE EXCEPTION 'You do not have permission to delete messages';
    END IF;

    -- Delete the message
    DELETE FROM debate_messages WHERE id = p_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user role in a debate
CREATE OR REPLACE FUNCTION get_user_debate_role(
    p_debate_id UUID,
    p_user_id UUID DEFAULT auth.uid()
) RETURNS TEXT AS $$
DECLARE
    v_role TEXT;
BEGIN
    -- Check if user is creator (automatic admin)
    SELECT 'admin' INTO v_role
    FROM debate_rooms
    WHERE id = p_debate_id
    AND creator_id = p_user_id;

    IF v_role IS NOT NULL THEN
        RETURN v_role;
    END IF;

    -- Check assigned role
    SELECT role INTO v_role
    FROM debate_roles
    WHERE debate_id = p_debate_id
    AND user_id = p_user_id;

    -- Default to participant if in the room
    IF v_role IS NULL THEN
        SELECT 'participant' INTO v_role
        FROM debate_rooms
        WHERE id = p_debate_id
        AND (creator_id = p_user_id OR guest_id = p_user_id);
    END IF;

    RETURN COALESCE(v_role, 'none');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_debate_roles_debate_id ON debate_roles(debate_id);
CREATE INDEX IF NOT EXISTS idx_debate_roles_user_id ON debate_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_debate_roles_role ON debate_roles(role);
