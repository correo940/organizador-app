-- Migration: Add maintenance reminders for manuals
-- Created: 2026-01-10

-- Create manual_reminders table
CREATE TABLE IF NOT EXISTS manual_reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manual_id UUID NOT NULL REFERENCES manuals(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    interval_months INTEGER NOT NULL, -- Interval in months (e.g., 6 for every 6 months)
    next_date DATE NOT NULL, -- Next reminder date
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_manual_reminders_manual_id ON manual_reminders(manual_id);
CREATE INDEX IF NOT EXISTS idx_manual_reminders_next_date ON manual_reminders(next_date);
CREATE INDEX IF NOT EXISTS idx_manual_reminders_active ON manual_reminders(is_active);

-- Enable RLS
ALTER TABLE manual_reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see reminders for their own manuals
CREATE POLICY "Users can view reminders for their manuals"
    ON manual_reminders FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM manuals
            WHERE manuals.id = manual_reminders.manual_id
            AND manuals.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert reminders for their manuals"
    ON manual_reminders FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM manuals
            WHERE manuals.id = manual_reminders.manual_id
            AND manuals.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update reminders for their manuals"
    ON manual_reminders FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM manuals
            WHERE manuals.id = manual_reminders.manual_id
            AND manuals.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete reminders for their manuals"
    ON manual_reminders FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM manuals
            WHERE manuals.id = manual_reminders.manual_id
            AND manuals.user_id = auth.uid()
        )
    );

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_manual_reminders_updated_at BEFORE UPDATE ON manual_reminders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
