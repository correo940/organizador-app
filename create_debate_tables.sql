-- Create table for Debate Rooms
CREATE TABLE IF NOT EXISTS debate_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic TEXT NOT NULL,
    description TEXT,
    creator_id UUID REFERENCES auth.users(id) NOT NULL,
    guest_id UUID REFERENCES auth.users(id), -- Can be null initially for public invites
    
    -- Rules
    rule_max_chars INTEGER DEFAULT 500, -- 0 means no limit
    rule_max_seconds INTEGER DEFAULT 60, -- 0 means no limit
    is_public BOOLEAN DEFAULT FALSE, -- If true, appears in "The Arena"
    
    -- Status
    status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'voting', 'finished')),
    winner_id UUID REFERENCES auth.users(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create table for Debate Messages
CREATE TABLE IF NOT EXISTS debate_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES debate_rooms(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES auth.users(id) NOT NULL,
    
    type TEXT DEFAULT 'text' CHECK (type IN ('text', 'audio')),
    content TEXT NOT NULL, -- Text content or Audio URL
    length INTEGER DEFAULT 0, -- Char count or seconds
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create table for Debate Votes (Jury)
CREATE TABLE IF NOT EXISTS debate_votes (
    room_id UUID REFERENCES debate_rooms(id) ON DELETE CASCADE,
    voter_id UUID REFERENCES auth.users(id),
    vote_for UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (room_id, voter_id)
);

-- Function to handle voting and potentially close the debate
CREATE OR REPLACE FUNCTION vote_debate(p_room_id UUID, p_vote_for UUID)
RETURNS VOID AS $$
DECLARE
    v_status TEXT;
BEGIN
    -- Check if room is in voting mode
    SELECT status INTO v_status FROM debate_rooms WHERE id = p_room_id;
    
    IF v_status != 'voting' THEN
        RAISE EXCEPTION 'This debate is not currently open for voting.';
    END IF;

    -- Insert or Update vote
    INSERT INTO debate_votes (room_id, voter_id, vote_for)
    VALUES (p_room_id, auth.uid(), p_vote_for)
    ON CONFLICT (room_id, voter_id) DO UPDATE
    SET vote_for = EXCLUDED.vote_for, created_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RLS Policies

-- Enable RLS
ALTER TABLE debate_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE debate_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE debate_votes ENABLE ROW LEVEL SECURITY;

-- Strategies for debate_rooms

-- Everyone can view public rooms or rooms they are part of
CREATE POLICY "View Rooms" ON debate_rooms
    FOR SELECT
    USING (
        is_public = TRUE 
        OR auth.uid() = creator_id 
        OR auth.uid() = guest_id
    );

-- Creator can update their room
CREATE POLICY "Update Own Room" ON debate_rooms
    FOR UPDATE
    USING (auth.uid() = creator_id);

-- Anyone can insert a room
CREATE POLICY "Create Room" ON debate_rooms
    FOR INSERT
    WITH CHECK (auth.uid() = creator_id);

-- Strategies for debate_messages

-- View messages if you have access to the room
CREATE POLICY "View Messages" ON debate_messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM debate_rooms 
            WHERE debate_rooms.id = debate_messages.room_id 
            AND (debate_rooms.is_public = TRUE OR debate_rooms.creator_id = auth.uid() OR debate_rooms.guest_id = auth.uid())
        )
    );

-- Send messages if you are a participant and room is active
CREATE POLICY "Send Messages" ON debate_messages
    FOR INSERT
    WITH CHECK (
        auth.uid() = sender_id 
        AND EXISTS (
            SELECT 1 FROM debate_rooms 
            WHERE debate_rooms.id = debate_messages.room_id 
            AND debate_rooms.status = 'active'
            AND (debate_rooms.creator_id = auth.uid() OR debate_rooms.guest_id = auth.uid())
        )
    );

-- Strategies for debate_votes

-- Anyone can see vote counts (aggregates handled in view usually, but raw access allowed for public rooms)
CREATE POLICY "View Votes" ON debate_votes
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM debate_rooms 
            WHERE debate_rooms.id = debate_votes.room_id 
            AND debate_rooms.is_public = TRUE
        )
    );

-- Votes are inserted via RPC, but if direct insert needed:
CREATE POLICY "Cast Vote" ON debate_votes
    FOR INSERT
    WITH CHECK (
        auth.uid() = voter_id
        -- Can add check for 'voting' status here too if strictly enforcing via RLS
    );
