-- 1. Table for Expense Folder Members (Granular Access)
CREATE TABLE IF NOT EXISTS expense_folder_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_id UUID REFERENCES expense_folders(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('member', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(folder_id, user_id)
);

-- RLS
ALTER TABLE expense_folder_members ENABLE ROW LEVEL SECURITY;

-- Members can view other members of the same folder
CREATE POLICY "Members can view members of same folder" ON expense_folder_members
    FOR SELECT
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM expense_folder_members mine 
            WHERE mine.folder_id = expense_folder_members.folder_id 
            AND mine.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM expense_folders f
            WHERE f.id = expense_folder_members.folder_id
            AND f.created_by = auth.uid()
        )
    );

-- Creator can insert members (via RPC usually, but policy for safety)
CREATE POLICY "Creator or admins can insert members" ON expense_folder_members
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM expense_folders f
            WHERE f.id = folder_id AND f.created_by = auth.uid()
        )
    );

-- 2. Update Expense Folders Policy to include Members
-- Note: Existing policies might strictly look for partners. We need to OR this.
-- Easier to just ADD a new policy. Postgres allows multiple policies (OR logic).
CREATE POLICY "Folder members can view folder" ON expense_folders
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM expense_folder_members m
            WHERE m.folder_id = id AND m.user_id = auth.uid()
        )
    );

-- 3. Update Expenses Policy to include Folder Members
CREATE POLICY "Folder members can view expenses in folder" ON expenses
    FOR SELECT
    USING (
        folder_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM expense_folder_members m
            WHERE m.folder_id = expenses.folder_id AND m.user_id = auth.uid()
        )
    );

CREATE POLICY "Folder members can insert expenses in folder" ON expenses
    FOR INSERT
    WITH CHECK (
        folder_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM expense_folder_members m
            WHERE m.folder_id = folder_id AND m.user_id = auth.uid()
        )
    );

CREATE POLICY "Folder members can update expenses in folder" ON expenses
    FOR UPDATE
    USING (
        folder_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM expense_folder_members m
            WHERE m.folder_id = expenses.folder_id AND m.user_id = auth.uid()
        )
    );

CREATE POLICY "Folder members can delete expenses in folder" ON expenses
    FOR DELETE
    USING (
        folder_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM expense_folder_members m
            WHERE m.folder_id = expenses.folder_id AND m.user_id = auth.uid()
        )
    );

-- 4. Folder Connection Codes (for sharing specific folders)
CREATE TABLE IF NOT EXISTS folder_connection_codes (
    code TEXT PRIMARY KEY,
    folder_id UUID REFERENCES expense_folders(id) ON DELETE CASCADE NOT NULL,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + interval '15 minutes')
);

ALTER TABLE folder_connection_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view folder codes they created" ON folder_connection_codes
    FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can insert folder codes" ON folder_connection_codes
    FOR INSERT WITH CHECK (auth.uid() = created_by);

-- 5. RPC: Generate Folder Code
CREATE OR REPLACE FUNCTION generate_folder_code(p_folder_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code TEXT;
BEGIN
  -- Verify ownership or permission (Creator only for now)
  IF NOT EXISTS (SELECT 1 FROM expense_folders WHERE id = p_folder_id AND created_by = auth.uid()) THEN
    RAISE EXCEPTION 'No tienes permiso para compartir esta carpeta';
  END IF;

  -- Generate 6-digit code
  v_code := floor(random() * (999999 - 100000 + 1) + 100000)::text;
  
  -- Clean up old codes for this folder by this user
  DELETE FROM folder_connection_codes WHERE folder_id = p_folder_id AND created_by = auth.uid();
  
  -- Insert
  INSERT INTO folder_connection_codes (code, folder_id, created_by) VALUES (v_code, p_folder_id, auth.uid());
  
  RETURN v_code;
END;
$$;

-- 6. RPC: Redeem Folder Code
CREATE OR REPLACE FUNCTION redeem_folder_code(p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_folder_id UUID;
  v_creator_id UUID;
BEGIN
  -- Find valid code
  SELECT folder_id, created_by INTO v_folder_id, v_creator_id
  FROM folder_connection_codes
  WHERE code = p_code
    AND expires_at > NOW();
    
  IF v_folder_id IS NULL THEN
    RAISE EXCEPTION 'Código inválido o expirado';
  END IF;
  
  -- Note: We allow creator to redeem for testing? No, usually block. 
  -- But maybe they want to test. Let's block to prevent weird loop.
  IF v_creator_id = auth.uid() THEN
     RAISE EXCEPTION 'Ya eres el propietario de esta carpeta';
  END IF;

  -- Add to members
  INSERT INTO expense_folder_members (folder_id, user_id, role)
  VALUES (v_folder_id, auth.uid(), 'member')
  ON CONFLICT (folder_id, user_id) DO NOTHING;
  
  -- Delete used code
  DELETE FROM folder_connection_codes WHERE code = p_code;
  
  RETURN v_folder_id;
END;
$$;

-- 7. RPC: Get Folder Members (helper for UI)
CREATE OR REPLACE FUNCTION get_folder_members(p_folder_id UUID)
RETURNS TABLE (
  member_id UUID,
  nickname TEXT,
  email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check permission: Must be creator OR member
  IF NOT EXISTS (
      SELECT 1 FROM expense_folders WHERE id = p_folder_id AND created_by = auth.uid()
      UNION
      SELECT 1 FROM expense_folder_members WHERE folder_id = p_folder_id AND user_id = auth.uid()
  ) THEN
     -- Check if is partner of creator (Global Access fallback)
     IF NOT EXISTS (
         SELECT 1 FROM expense_folders f
         JOIN expense_partners ep ON (ep.user_id_1 = f.created_by OR ep.user_id_2 = f.created_by)
         WHERE f.id = p_folder_id 
         AND (ep.user_id_1 = auth.uid() OR ep.user_id_2 = auth.uid())
     ) THEN
         RAISE EXCEPTION 'Acceso denegado';
     END IF;
  END IF;

  RETURN QUERY
  SELECT 
    p.id as member_id,
    p.nickname,
    u.email::text -- Cast to text just in case (though auth.users email is text)
  FROM expense_folder_members m
  JOIN profiles p ON p.id = m.user_id
  LEFT JOIN auth.users u ON u.id = m.user_id
  WHERE m.folder_id = p_folder_id
  
  UNION
  
  -- Also return Creator
  SELECT 
    p.id as member_id,
    p.nickname,
    u.email::text
  FROM expense_folders f
  JOIN profiles p ON p.id = f.created_by
  LEFT JOIN auth.users u ON u.id = f.created_by
  WHERE f.id = p_folder_id;
END;
$$;
