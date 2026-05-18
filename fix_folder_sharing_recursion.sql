-- FIX: Infinite Recursion in RLS Policies
-- We need to break the cycle between expense_folders and expense_folder_members policies.
-- We will use SECURITY DEFINER functions to handle the checks without triggering RLS recursively.

-- 1. Create Helper Functions (SECURITY DEFINER to bypass RLS)

CREATE OR REPLACE FUNCTION is_folder_creator(_folder_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM expense_folders
    WHERE id = _folder_id AND created_by = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION is_folder_member(_folder_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM expense_folder_members
    WHERE folder_id = _folder_id AND user_id = auth.uid()
  );
END;
$$;

-- 2. Drop Problematic Policies

-- Drop expense_folder_members policies
DROP POLICY IF EXISTS "Members can view members of same folder" ON expense_folder_members;
DROP POLICY IF EXISTS "Creator or admins can insert members" ON expense_folder_members; -- Re-creating just in case
DROP POLICY IF EXISTS "Creator can manage members" ON expense_folder_members; -- Potential name variant

-- Drop expense_folders policies
DROP POLICY IF EXISTS "Folder members can view folder" ON expense_folders;

-- Drop expenses policies (they were also recursive potentially)
DROP POLICY IF EXISTS "Folder members can view expenses in folder" ON expenses;
DROP POLICY IF EXISTS "Folder members can insert expenses in folder" ON expenses;
DROP POLICY IF EXISTS "Folder members can update expenses in folder" ON expenses;
DROP POLICY IF EXISTS "Folder members can delete expenses in folder" ON expenses;


-- 3. Re-create Policies using Helper Functions

-- expense_folders: Members can view
CREATE POLICY "Folder members can view folder" ON expense_folders
    FOR SELECT
    USING (
        is_folder_member(id)
    );

-- expense_folder_members: Visibility
-- Users can see rows IF:
-- 1. The row is about them (user_id = auth.uid())
-- 2. They are a member of the folder the row belongs to (is_folder_member(folder_id))
-- 3. They are the creator of the folder (is_folder_creator(folder_id))
CREATE POLICY "Visibility of folder members" ON expense_folder_members
    FOR SELECT
    USING (
        user_id = auth.uid() OR
        is_folder_member(folder_id) OR
        is_folder_creator(folder_id)
    );

-- expense_folder_members: Management (Insert/Delete) by Creator
-- Only creator can add/remove members (for now)
CREATE POLICY "Creator can manage members" ON expense_folder_members
    FOR ALL
    USING (
        is_folder_creator(folder_id)
    );

-- expenses: Folder Members access
-- Note: 'is_folder_member' handles the check securely.
CREATE POLICY "Folder members can view expenses in folder" ON expenses
    FOR SELECT
    USING (
        folder_id IS NOT NULL AND is_folder_member(folder_id)
    );

CREATE POLICY "Folder members can insert expenses in folder" ON expenses
    FOR INSERT
    WITH CHECK (
        folder_id IS NOT NULL AND is_folder_member(folder_id)
    );

CREATE POLICY "Folder members can update expenses in folder" ON expenses
    FOR UPDATE
    USING (
        folder_id IS NOT NULL AND is_folder_member(folder_id)
    );

CREATE POLICY "Folder members can delete expenses in folder" ON expenses
    FOR DELETE
    USING (
        folder_id IS NOT NULL AND is_folder_member(folder_id)
    );

-- 4. Ensure RPCs are also using the secure logic (or at least valid)
-- Currently generate_folder_code and redeem_folder_code in previous migration were SECURITY DEFINER, so they should be fine.
-- But let's make sure 'get_folder_members' RPC doesn't break if it was relying on simple selects.
-- It was SECURITY DEFINER, so it bypasses RLS, so it should be fine.

