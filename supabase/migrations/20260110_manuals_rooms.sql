-- Migration: Add rooms/folders organization to manuals
-- Created: 2026-01-10

-- Create rooms table for hierarchical organization
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT, -- Lucide icon name (e.g., 'Home', 'Zap', 'Wind')
    parent_id UUID REFERENCES rooms(id) ON DELETE CASCADE, -- For nested folders
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add room_id to manuals table
ALTER TABLE manuals ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id) ON DELETE SET NULL;

-- Add updated_at to manuals for tracking modifications
ALTER TABLE manuals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_manuals_updated_at BEFORE UPDATE ON manuals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_rooms_user_id ON rooms(user_id);
CREATE INDEX IF NOT EXISTS idx_rooms_parent_id ON rooms(parent_id);
CREATE INDEX IF NOT EXISTS idx_manuals_room_id ON manuals(room_id);

-- Enable RLS
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rooms
CREATE POLICY "Users can view their own rooms"
    ON rooms FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rooms"
    ON rooms FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rooms"
    ON rooms FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rooms"
    ON rooms FOR DELETE
    USING (auth.uid() = user_id);

-- Insert default rooms for existing users
DO $$
DECLARE
    user_record RECORD;
    cocina_id UUID;
    bano_id UUID;
    salon_id UUID;
    dormitorio_id UUID;
    garaje_id UUID;
BEGIN
    FOR user_record IN SELECT DISTINCT user_id FROM manuals
    LOOP
        -- Create default rooms if they don't exist
        INSERT INTO rooms (user_id, name, icon) VALUES
            (user_record.user_id, 'Cocina', 'ChefHat'),
            (user_record.user_id, 'Baño', 'Droplet'),  
            (user_record.user_id, 'Salón', 'Tv'),
            (user_record.user_id, 'Dormitorio', 'Bed'),
            (user_record.user_id, 'Garaje', 'Car'),
            (user_record.user_id, 'Otros', 'Home')
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;
