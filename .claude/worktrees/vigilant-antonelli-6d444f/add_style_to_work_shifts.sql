-- Add style column to work_shifts table
ALTER TABLE work_shifts ADD COLUMN style text DEFAULT 'block';

-- Update existing records to have 'block' style (optional, as default covers new ones, but good for clarity)
UPDATE work_shifts SET style = 'block' WHERE style IS NULL;
