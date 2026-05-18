-- Add date-based maintenance columns to vehicles table

ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS last_oil_change_date DATE,
ADD COLUMN IF NOT EXISTS last_tire_change_date DATE,
ADD COLUMN IF NOT EXISTS oil_change_interval_months INTEGER DEFAULT 12,
ADD COLUMN IF NOT EXISTS tire_change_interval_months INTEGER DEFAULT 48;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger if not exists (standard practice)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_vehicles_updated_at') THEN
        CREATE TRIGGER update_vehicles_updated_at
        BEFORE UPDATE ON vehicles
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END
$$;
