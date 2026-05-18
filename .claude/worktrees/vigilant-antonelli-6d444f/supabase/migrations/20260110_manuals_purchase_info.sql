-- Migration: Add purchase information to manuals
-- Created: 2026-01-10

-- Add purchase info columns to manuals table
ALTER TABLE manuals 
ADD COLUMN IF NOT EXISTS purchase_store TEXT,
ADD COLUMN IF NOT EXISTS purchase_date DATE,
ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS spare_parts_url TEXT,
ADD COLUMN IF NOT EXISTS warranty_expires DATE;

-- Create index for warranty expiration queries
CREATE INDEX IF NOT EXISTS idx_manuals_warranty_expires ON manuals(warranty_expires) 
WHERE warranty_expires IS NOT NULL;
