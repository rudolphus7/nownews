-- 1. ENSURE ALL COLUMNS EXIST (Games & Enginge Synchronization)
-- Add any missing columns that the new Oak Gamification system uses.
ALTER TABLE public.user_gamification 
ADD COLUMN IF NOT EXISTS tree_height INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tree_watered INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tree_fertilized INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tree_name TEXT DEFAULT 'Мій Дуб',
ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS garden_state JSONB DEFAULT '{"reads":0, "ms":{}, "read_ids":[]}'::JSONB,
ADD COLUMN IF NOT EXISTS quests_state JSONB DEFAULT '{"p":{}, "d":{}, "l":""}'::JSONB,
ADD COLUMN IF NOT EXISTS steal_log JSONB DEFAULT '{}'::JSONB,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS last_wheel TIMESTAMPTZ DEFAULT '2000-01-01'::TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS weekly_height_start INTEGER DEFAULT 0;

-- 2. ENSURE RLS POLICIES FOR GUESTS
-- Since UIDs starting with 'u' are NOT in auth.users, we need to allow public upsert.
-- This is inherently insecure, but required for "Local Guest" mode without a traditional backend.
ALTER TABLE public.user_gamification ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read leaderboard and other users' trees
DROP POLICY IF EXISTS "Public Select Gamification" ON public.user_gamification;
CREATE POLICY "Public Select Gamification" ON public.user_gamification FOR SELECT USING (true);

-- Allow upsert for everyone (Matches user_id based on the provided uid from client)
-- This allows both 'u...' (guests) and Supabase Auth IDs.
DROP POLICY IF EXISTS "Public All Gamification" ON public.user_gamification;
CREATE POLICY "Public All Gamification" ON public.user_gamification FOR ALL USING (true) WITH CHECK (true);

-- 3. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_ug_height ON public.user_gamification (tree_height DESC);
CREATE INDEX IF NOT EXISTS idx_ug_user_id ON public.user_gamification (user_id);
