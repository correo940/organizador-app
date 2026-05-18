-- Create expense_folders table
CREATE TABLE IF NOT EXISTS expense_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    name TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived'))
);

-- Add folder_id to expenses
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'folder_id') THEN 
        ALTER TABLE expenses ADD COLUMN folder_id UUID REFERENCES expense_folders(id) ON DELETE CASCADE;
    END IF; 
END $$;

-- Add folder_id to settlements
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settlements' AND column_name = 'folder_id') THEN 
        ALTER TABLE settlements ADD COLUMN folder_id UUID REFERENCES expense_folders(id) ON DELETE CASCADE;
    END IF; 
END $$;

-- Enable RLS
ALTER TABLE expense_folders ENABLE ROW LEVEL SECURITY;

-- Policies for expense_folders using expense_partners logic
-- (Anyone linked to the creator can see/edit the folder, similar to expenses)

-- SELECT: Show folders created by me OR by my partners
CREATE POLICY "Users can view folders of partners" ON expense_folders
    FOR SELECT
    USING (
        auth.uid() = created_by OR
        EXISTS (
            SELECT 1 FROM expense_partners ep
            WHERE (ep.user_id_1 = auth.uid() AND ep.user_id_2 = expense_folders.created_by)
               OR (ep.user_id_2 = auth.uid() AND ep.user_id_1 = expense_folders.created_by)
        )
    );

-- INSERT: Authenticated users can create folders
CREATE POLICY "Users can create folders" ON expense_folders
    FOR INSERT
    WITH CHECK (auth.uid() = created_by);

-- UPDATE/DELETE: Only creator (for now) or maybe partners too? 
-- Let's stick to Creator or Partners for simplicity in a shared household.
CREATE POLICY "Users can edit folders of partners" ON expense_folders
    FOR UPDATE
    USING (
        auth.uid() = created_by OR
        EXISTS (
            SELECT 1 FROM expense_partners ep
            WHERE (ep.user_id_1 = auth.uid() AND ep.user_id_2 = expense_folders.created_by)
               OR (ep.user_id_2 = auth.uid() AND ep.user_id_1 = expense_folders.created_by)
        )
    );

CREATE POLICY "Users can delete folders of partners" ON expense_folders
    FOR DELETE
    USING (
        auth.uid() = created_by OR
        EXISTS (
            SELECT 1 FROM expense_partners ep
            WHERE (ep.user_id_1 = auth.uid() AND ep.user_id_2 = expense_folders.created_by)
               OR (ep.user_id_2 = auth.uid() AND ep.user_id_1 = expense_folders.created_by)
        )
    );
