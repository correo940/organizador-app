-- 1. Table for Debate Connection Codes
CREATE TABLE IF NOT EXISTS debate_connection_codes (
    code TEXT PRIMARY KEY,
    debate_id UUID REFERENCES debate_rooms(id) ON DELETE CASCADE NOT NULL,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + interval '15 minutes')
);

ALTER TABLE debate_connection_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view debate codes they created" ON debate_connection_codes
    FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can insert debate codes" ON debate_connection_codes
    FOR INSERT WITH CHECK (auth.uid() = created_by);

-- 2. RPC: Generate Debate Code
CREATE OR REPLACE FUNCTION generate_debate_code(p_debate_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code TEXT;
BEGIN
  -- Verify ownership (Creator only)
  IF NOT EXISTS (SELECT 1 FROM debate_rooms WHERE id = p_debate_id AND creator_id = auth.uid()) THEN
    RAISE EXCEPTION 'No tienes permiso para generar código para este debate';
  END IF;

  -- Generate 6-digit code
  v_code := floor(random() * (999999 - 100000 + 1) + 100000)::text;
  
  -- Clean up old codes for this debate by this user
  DELETE FROM debate_connection_codes WHERE debate_id = p_debate_id AND created_by = auth.uid();
  
  -- Insert
  INSERT INTO debate_connection_codes (code, debate_id, created_by) VALUES (v_code, p_debate_id, auth.uid());
  
  RETURN v_code;
END;
$$;

-- 3. RPC: Redeem Debate Code
-- This basically is "Join Debate" but secured via Code instead of just ID check?
-- Actually, the user requirement is: "si ese usuario es premium entra directamente sino, se registra con el codigo"
-- For now, we implement the "Redeem" to Join Mechanism.
CREATE OR REPLACE FUNCTION redeem_debate_code(p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_debate_id UUID;
  v_creator_id UUID;
  v_guest_id UUID;
BEGIN
  -- Find valid code
  SELECT debate_id, created_by INTO v_debate_id, v_creator_id
  FROM debate_connection_codes
  WHERE code = p_code
    AND expires_at > NOW();
    
  IF v_debate_id IS NULL THEN
    RAISE EXCEPTION 'Código inválido o expirado';
  END IF;
  
  IF v_creator_id = auth.uid() THEN
     RAISE EXCEPTION 'Ya eres el creador de este debate';
  END IF;

  -- Check if debate already has a guest
  SELECT guest_id INTO v_guest_id FROM debate_rooms WHERE id = v_debate_id;
  IF v_guest_id IS NOT NULL AND v_guest_id != auth.uid() THEN
     RAISE EXCEPTION 'Este debate ya tiene un oponente';
  END IF;

  -- Update room to set guest
  UPDATE debate_rooms
  SET guest_id = auth.uid(),
      status = 'active'
  WHERE id = v_debate_id;
  
  -- Delete used code
  DELETE FROM debate_connection_codes WHERE code = p_code;
  
  RETURN v_debate_id;
END;
$$;
