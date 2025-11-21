-- Migration: Add Token Rotation Fields
-- Purpose: Add fields required for token rotation and reuse detection
-- Date: 2025-11-19

-- Add new columns to refresh_tokens table
ALTER TABLE refresh_tokens
ADD COLUMN family_id VARCHAR(64),
ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN is_invalidated BOOLEAN NOT NULL DEFAULT FALSE;

-- Create index for family_id for efficient family lookups
CREATE INDEX idx_refresh_tokens_family_id ON refresh_tokens(family_id);

-- Create index for active/invalidated status
CREATE INDEX idx_refresh_tokens_status ON refresh_tokens(is_active, is_invalidated);

-- Create composite index for family operations
CREATE INDEX idx_refresh_tokens_family_status ON refresh_tokens(family_id, is_active, is_invalidated);

-- Update comment to reflect new purpose
COMMENT ON TABLE refresh_tokens IS 'Stores refresh tokens with family tracking for token rotation and reuse detection';