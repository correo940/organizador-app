-- Function for a user to join a debate as the guest
CREATE OR REPLACE FUNCTION join_debate(p_room_id UUID)
RETURNS VOID AS $$
DECLARE
    v_room_id UUID;
    v_guest_id UUID;
BEGIN
    -- Check if room exists and has no guest yet
    SELECT id, guest_id INTO v_room_id, v_guest_id
    FROM debate_rooms
    WHERE id = p_room_id;
    
    IF v_room_id IS NULL THEN
        RAISE EXCEPTION 'Debate not found';
    END IF;
    
    IF v_guest_id IS NOT NULL THEN
        RAISE EXCEPTION 'This debate already has a guest';
    END IF;

    -- Update the room setting the current user as guest
    UPDATE debate_rooms
    SET guest_id = auth.uid(),
        status = 'active', -- Automatically start when guest joins? Or keep waiting? Let's say active.
        updated_at = NOW()
    WHERE id = p_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
