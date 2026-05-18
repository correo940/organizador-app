-- 1. Add Citations support
ALTER TABLE debate_messages
ADD COLUMN IF NOT EXISTS reference_link TEXT;

-- 2. Create Reactions table
CREATE TABLE IF NOT EXISTS debate_message_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID REFERENCES debate_messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    reaction_type TEXT NOT NULL, -- 'like', 'fallacy', 'point', 'source'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_id, reaction_type) -- Prevent duplicate same-reaction by same user
);

-- Enable RLS for reactions
ALTER TABLE debate_message_reactions ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read reactions
-- Policy: Everyone can read reactions
DROP POLICY IF EXISTS "Everyone can view reactions" ON debate_message_reactions;
CREATE POLICY "Everyone can view reactions" ON debate_message_reactions
    FOR SELECT USING (true);

-- Policy: Authenticated users can insert their own reactions
DROP POLICY IF EXISTS "Users can add reactions" ON debate_message_reactions;
CREATE POLICY "Users can add reactions" ON debate_message_reactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own reactions
DROP POLICY IF EXISTS "Users can remove reactions" ON debate_message_reactions;
CREATE POLICY "Users can remove reactions" ON debate_message_reactions
    FOR DELETE USING (auth.uid() = user_id);

-- 3. Add Chess Clock & Turn support to Rooms
ALTER TABLE debate_rooms
ADD COLUMN IF NOT EXISTS current_turn_id UUID, -- Who speaks now?
ADD COLUMN IF NOT EXISTS turn_started_at TIMESTAMPTZ, -- When did they start speaking?
ADD COLUMN IF NOT EXISTS time_allocations JSONB DEFAULT '{"creator": 600, "guest": 600}', -- Seconds remaining
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{"strict_mode": false, "chess_clock": false}'; -- Toggles

-- 4. Function to switch turns (Atomic update to prevent race conditions)
CREATE OR REPLACE FUNCTION switch_debate_turn(
    p_room_id UUID, 
    p_next_turn_id UUID,
    p_time_consumed_seconds INT
)
RETURNS VOID AS $$
DECLARE
    v_room debate_rooms%ROWTYPE;
    v_current_speaker_key TEXT;
    v_new_time INT;
BEGIN
    SELECT * INTO v_room FROM debate_rooms WHERE id = p_room_id;
    
    -- Determine who was speaking to deduct time
    IF v_room.current_turn_id = v_room.creator_id THEN
        v_current_speaker_key := 'creator';
    ELSE
        v_current_speaker_key := 'guest';
    END IF;

    -- Update time allocation
    v_new_time := (v_room.time_allocations->>v_current_speaker_key)::INT - p_time_consumed_seconds;
    
    IF v_new_time < 0 THEN v_new_time := 0; END IF;

    -- Update row
    UPDATE debate_rooms
    SET 
        current_turn_id = p_next_turn_id,
        turn_started_at = NOW(),
        time_allocations = jsonb_set(time_allocations, ARRAY[v_current_speaker_key], to_jsonb(v_new_time))
    WHERE id = p_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
