-- Migration: Add version history for manuals
-- Created: 2026-01-10

-- Create manual_versions table to track changes
CREATE TABLE IF NOT EXISTS manual_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manual_id UUID NOT NULL REFERENCES manuals(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    category TEXT,
    description TEXT,
    type TEXT NOT NULL,
    content TEXT,
    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    changed_by UUID REFERENCES auth.users(id),
    change_description TEXT, -- Optional description of what changed
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_manual_versions_manual_id ON manual_versions(manual_id);
CREATE INDEX IF NOT EXISTS idx_manual_versions_created_at ON manual_versions(created_at);

-- Enable RLS
ALTER TABLE manual_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view versions for their manuals"
    ON manual_versions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM manuals
            WHERE manuals.id = manual_versions.manual_id
            AND manuals.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert versions for their manuals"
    ON manual_versions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM manuals
            WHERE manuals.id = manual_versions.manual_id
            AND manuals.user_id = auth.uid()
        )
    );

-- Function to automatically create version on manual update
CREATE OR REPLACE FUNCTION create_manual_version()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create version if content actually changed
    IF (OLD.title IS DISTINCT FROM NEW.title OR
        OLD.category IS DISTINCT FROM NEW.category OR
        OLD.description IS DISTINCT FROM NEW.description OR
        OLD.content IS DISTINCT FROM NEW.content OR
        OLD.room_id IS DISTINCT FROM NEW.room_id) THEN
        
        INSERT INTO manual_versions (
            manual_id,
            version_number,
            title,
            category,
            description,
            type,
            content,
            room_id,
            changed_by
        )
        SELECT 
            OLD.id,
            COALESCE((
                SELECT MAX(version_number) + 1 
                FROM manual_versions 
                WHERE manual_id = OLD.id
            ), 1),
            OLD.title,
            OLD.category,
            OLD.description,
            OLD.type,
            OLD.content,
            OLD.room_id,
            auth.uid();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER manual_version_on_update
    BEFORE UPDATE ON manuals
    FOR EACH ROW
    EXECUTE FUNCTION create_manual_version();
