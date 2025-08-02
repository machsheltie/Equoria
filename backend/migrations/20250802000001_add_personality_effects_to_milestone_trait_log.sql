-- Migration: Add personality effect fields to milestone_trait_log table
-- Date: 2025-08-02
-- Description: Adds personality_match_score and personality_effect_applied fields 
--              to support groom personality-temperament compatibility tracking

-- Add personality_match_score field to track compatibility score
ALTER TABLE milestone_trait_logs 
ADD COLUMN personality_match_score INTEGER DEFAULT 0;

-- Add personality_effect_applied field to track if personality effects were applied
ALTER TABLE milestone_trait_logs 
ADD COLUMN personality_effect_applied BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN milestone_trait_logs.personality_match_score IS 'Compatibility score between groom personality and foal temperament (-1 to 2)';
COMMENT ON COLUMN milestone_trait_logs.personality_effect_applied IS 'Whether personality compatibility effects were applied during milestone evaluation';

-- Create index for performance on personality effect queries
CREATE INDEX idx_milestone_trait_logs_personality_effects 
ON milestone_trait_logs(personality_effect_applied, personality_match_score);
