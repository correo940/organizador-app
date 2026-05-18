-- Migration: Add Interaction Modes to Shareable Thoughts
-- Created: 2026-01-13
-- Description: Adds interaction_mode and unlock_at columns

-- Create enum for interaction modes if it implies structure, or check constraints
-- We'll use a check constraint for simplicity and flexibility with existing tools
-- Modes: 
-- 'conversation': Standard (default)
-- 'read_only': Recipient cannot reply
-- 'app_only': Recipient can reply but with warning to keep it in-app

ALTER TABLE shared_thoughts 
ADD COLUMN interaction_mode TEXT NOT NULL DEFAULT 'conversation' 
CHECK (interaction_mode IN ('conversation', 'read_only', 'app_only'));

ALTER TABLE shared_thoughts
ADD COLUMN unlock_at TIMESTAMPTZ; -- For Time Capsule feature. If null, unlocks immediately (or uses created_at)

-- Add comment
COMMENT ON COLUMN shared_thoughts.interaction_mode IS 'Controls how the recipient can interact: conversation, read_only, or app_only';
COMMENT ON COLUMN shared_thoughts.unlock_at IS 'When the thought becomes visible to the recipient (Time Capsule)';
