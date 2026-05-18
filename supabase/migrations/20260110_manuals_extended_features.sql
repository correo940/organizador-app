-- Migration: Extended features for manuals
-- Created: 2026-01-10
-- Adds: favorites, multiple images, PDFs, notes, energy consumption, maintenance checklists

-- Add favorite flag to manuals
ALTER TABLE manuals 
ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS energy_consumption_kwh DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS monthly_cost DECIMAL(10,2);

-- Create manual_images table for multiple images per manual
CREATE TABLE IF NOT EXISTS manual_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manual_id UUID NOT NULL REFERENCES manuals(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    caption TEXT,
    image_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manual_images_manual_id ON manual_images(manual_id);
CREATE INDEX IF NOT EXISTS idx_manual_images_order ON manual_images(manual_id, image_order);

-- Create manual_attachments table for PDFs and other files
CREATE TABLE IF NOT EXISTS manual_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manual_id UUID NOT NULL REFERENCES manuals(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manual_attachments_manual_id ON manual_attachments(manual_id);

-- Create manual_notes table for additional notes/comments
CREATE TABLE IF NOT EXISTS manual_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manual_id UUID NOT NULL REFERENCES manuals(id) ON DELETE CASCADE,
    note_type TEXT DEFAULT 'general', -- 'general', 'repair', 'tip', 'problem'
    title TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manual_notes_manual_id ON manual_notes(manual_id);
CREATE INDEX IF NOT EXISTS idx_manual_notes_type ON manual_notes(note_type);

-- Create maintenance_checklists table
CREATE TABLE IF NOT EXISTS maintenance_checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reminder_id UUID NOT NULL REFERENCES manual_reminders(id) ON DELETE CASCADE,
    task_description TEXT NOT NULL,
    task_order INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_checklists_reminder ON maintenance_checklists(reminder_id);

-- Create manual_links table for related manuals
CREATE TABLE IF NOT EXISTS manual_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manual_id UUID NOT NULL REFERENCES manuals(id) ON DELETE CASCADE,
    related_manual_id UUID NOT NULL REFERENCES manuals(id) ON DELETE CASCADE,
    link_type TEXT DEFAULT 'related', -- 'related', 'replacement', 'accessory'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(manual_id, related_manual_id)
);

CREATE INDEX IF NOT EXISTS idx_manual_links_manual_id ON manual_links(manual_id);

-- Enable RLS on all new tables
ALTER TABLE manual_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies for manual_images
CREATE POLICY "Users can view images for their manuals"
    ON manual_images FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM manuals
            WHERE manuals.id = manual_images.manual_id
            AND manuals.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert images for their manuals"
    ON manual_images FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM manuals
            WHERE manuals.id = manual_images.manual_id
            AND manuals.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete images for their manuals"
    ON manual_images FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM manuals
            WHERE manuals.id = manual_images.manual_id
            AND manuals.user_id = auth.uid()
        )
    );

-- RLS Policies for manual_attachments (same pattern)
CREATE POLICY "Users can view attachments for their manuals"
    ON manual_attachments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM manuals
            WHERE manuals.id = manual_attachments.manual_id
            AND manuals.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert attachments for their manuals"
    ON manual_attachments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM manuals
            WHERE manuals.id = manual_attachments.manual_id
            AND manuals.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete attachments for their manuals"
    ON manual_attachments FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM manuals
            WHERE manuals.id = manual_attachments.manual_id
            AND manuals.user_id = auth.uid()
        )
    );

-- RLS Policies for manual_notes
CREATE POLICY "Users can view notes for their manuals"
    ON manual_notes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM manuals
            WHERE manuals.id = manual_notes.manual_id
            AND manuals.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert notes for their manuals"
    ON manual_notes FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM manuals
            WHERE manuals.id = manual_notes.manual_id
            AND manuals.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update notes for their manuals"
    ON manual_notes FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM manuals
            WHERE manuals.id = manual_notes.manual_id
            AND manuals.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete notes for their manuals"
    ON manual_notes FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM manuals
            WHERE manuals.id = manual_notes.manual_id
            AND manuals.user_id = auth.uid()
        )
    );

-- RLS Policies for maintenance_checklists
CREATE POLICY "Users can view checklists for their reminders"
    ON maintenance_checklists FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM manual_reminders mr
            JOIN manuals m ON mr.manual_id = m.id
            WHERE mr.id = maintenance_checklists.reminder_id
            AND m.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage checklists for their reminders"
    ON maintenance_checklists FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM manual_reminders mr
            JOIN manuals m ON mr.manual_id = m.id
            WHERE mr.id = maintenance_checklists.reminder_id
            AND m.user_id = auth.uid()
        )
    );

-- RLS Policies for manual_links
CREATE POLICY "Users can view links for their manuals"
    ON manual_links FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM manuals
            WHERE manuals.id = manual_links.manual_id
            AND manuals.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage links for their manuals"
    ON manual_links FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM manuals
            WHERE manuals.id = manual_links.manual_id
            AND manuals.user_id = auth.uid()
        )
    );

-- Triggers
CREATE TRIGGER update_manual_notes_updated_at BEFORE UPDATE ON manual_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
