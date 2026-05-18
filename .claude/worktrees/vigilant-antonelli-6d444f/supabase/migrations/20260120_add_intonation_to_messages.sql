-- Add intonation column to thought_messages
ALTER TABLE thought_messages
ADD COLUMN intonation TEXT;

-- Comment for documentation
COMMENT ON COLUMN thought_messages.intonation IS 'Emoji or short text representing the intonation/emotion of the message (e.g. 😠, 😊, 🤪)';
