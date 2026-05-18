CREATE OR REPLACE FUNCTION remove_partner(p_partner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM expense_partners
    WHERE (user_id_1 = auth.uid() AND user_id_2 = p_partner_id)
       OR (user_id_1 = p_partner_id AND user_id_2 = auth.uid());
END;
$$;
