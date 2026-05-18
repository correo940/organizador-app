-- Migration: Add tags support to manuals
-- Created: 2026-01-10

-- Create manual_tags table for many-to-many relationship
CREATE TABLE IF NOT EXISTS manual_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manual_id UUID NOT NULL REFERENCES manuals(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Ensure no duplicate tags for same manual
    UNIQUE(manual_id, tag)
);

-- Create index for faster tag queries
CREATE INDEX IF NOT EXISTS idx_manual_tags_manual_id ON manual_tags(manual_id);
CREATE INDEX IF NOT EXISTS idx_manual_tags_tag ON manual_tags(tag);

-- Enable RLS
ALTER TABLE manual_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see tags for their own manuals
CREATE POLICY "Users can view tags for their manuals"
    ON manual_tags FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM manuals
            WHERE manuals.id = manual_tags.manual_id
            AND manuals.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert tags for their manuals"
    ON manual_tags FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM manuals
            WHERE manuals.id = manual_tags.manual_id
            AND manuals.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete tags for their manuals"
    ON manual_tags FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM manuals
            WHERE manuals.id = manual_tags.manual_id
            AND manuals.user_id = auth.uid()
        )
    );
