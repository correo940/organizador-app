ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS notify_km_before INTEGER DEFAULT 1000,
ADD COLUMN IF NOT EXISTS notify_days_before INTEGER DEFAULT 30;

-- Update existing rows to have defaults
UPDATE vehicles SET notify_km_before = 1000 WHERE notify_km_before IS NULL;
UPDATE vehicles SET notify_days_before = 30 WHERE notify_days_before IS NULL;
