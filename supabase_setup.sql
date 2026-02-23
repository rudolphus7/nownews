-- Run this SQL in your Supabase SQL Editor to enable global reactions

-- 1. Add reaction columns to the news table
ALTER TABLE news 
ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS fire INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS wow INTEGER DEFAULT 0;

-- 2. Create an RPC function for atomic increments
-- This prevents race conditions when multiple users react at once
CREATE OR REPLACE FUNCTION increment_reaction(post_id UUID, reaction_type TEXT)
RETURNS void AS $$
BEGIN
  EXECUTE format('UPDATE news SET %I = COALESCE(%I, 0) + 1 WHERE id = %L', reaction_type, reaction_type, post_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
