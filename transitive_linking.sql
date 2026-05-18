CREATE OR REPLACE FUNCTION redeem_connection_code(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_owner_id uuid;
    v_partner_record record;
BEGIN
    -- 1. Find the code
    SELECT created_by INTO v_owner_id
    FROM connection_codes
    WHERE code = p_code
      AND expires_at > now();

    IF v_owner_id IS NULL THEN
        RAISE EXCEPTION 'Código inválido o expirado';
    END IF;

    IF v_owner_id = auth.uid() THEN
        RAISE EXCEPTION 'No puedes canjear tu propio código';
    END IF;

    -- 2. Link with the Owner (Direct Link)
    -- We use ON CONFLICT DO NOTHING just in case they are already linked
    INSERT INTO expense_partners (user_id_1, user_id_2)
    VALUES (
        LEAST(auth.uid(), v_owner_id),
        GREATEST(auth.uid(), v_owner_id)
    )
    ON CONFLICT DO NOTHING;

    -- 3. Transitive Linking (The Magic)
    -- Connect "Me" (auth.uid()) with ALL existing partners of the "Owner" (v_owner_id).
    -- This ensures that if A invites B, and A already has C, then B gets linked to C automatically.
    
    FOR v_partner_record IN 
        SELECT 
            CASE 
                WHEN user_id_1 = v_owner_id THEN user_id_2 
                ELSE user_id_1 
            END as other_id
        FROM expense_partners
        WHERE user_id_1 = v_owner_id OR user_id_2 = v_owner_id
    LOOP
        -- Don't link to myself or the owner (already done)
        IF v_partner_record.other_id != auth.uid() AND v_partner_record.other_id != v_owner_id THEN
            INSERT INTO expense_partners (user_id_1, user_id_2)
            VALUES (
                LEAST(auth.uid(), v_partner_record.other_id),
                GREATEST(auth.uid(), v_partner_record.other_id)
            )
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;

    -- 4. Delete the code (One-time use? Or keep it? The prompt implies reusable codes might differ, 
    -- but usually safety implies delete. However, for "Group Share" usually one code is passed around.
    -- Let's KEEP user original logic (delete if single use, or keep if generating user wants to share multiple times).
    -- The current implementation deletes it? Let's check previous file. 
    -- 'link_via_code_migration.sql' said: delete from connection_codes where code = p_code;
    -- BUT if user wants to invite 3 people with same code?
    -- Let's DELETE it for security (Standard). User can generate another for the next person 
    -- OR we change it to allow multiple uses. 
    -- Given the "Group" context, deleting forces re-generation which is annoying.
    -- I will DELETE it to be safe and consistent with previous behavior.
    
    DELETE FROM connection_codes WHERE code = p_code;

    RETURN true;
END;
$$;
