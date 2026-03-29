-- ==========================================
-- BUKVA NEWS: COMPLETE GAMIFICATION SETUP
-- 100% Logic Sync (Neighbor Visit + Referrals + Game Engine)
-- ==========================================

-- 1. TABLE STRUCTURE (user_gamification)
-- Ensures all columns exist for all mechanics.
CREATE TABLE IF NOT EXISTS public.user_gamification (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,                       -- External ID (Auth or Guest 'u...')
    tree_name TEXT DEFAULT 'Мій Дуб',
    tree_height INTEGER DEFAULT 0,
    tree_watered INTEGER DEFAULT 0,
    tree_fertilized INTEGER DEFAULT 0,
    aqua_data INTEGER DEFAULT 50,                       -- Resources (Water)
    solar_insight INTEGER DEFAULT 30,                   -- Resources (Sun)
    last_active TIMESTAMPTZ DEFAULT NOW(),
    last_stolen_at TIMESTAMPTZ DEFAULT '2000-01-01',    -- Neighbor Visit Lock
    last_wheel TIMESTAMPTZ DEFAULT '2000-01-01',        -- Wheel of Fortune Lock
    referrer_id TEXT,                                   -- Who invited this user
    garden_state JSONB DEFAULT '{"read_ids":[], "reads":0, "reward_claimed":false}'::JSONB,
    quests_state JSONB DEFAULT '{"p":{}, "d":{}, "l":""}'::JSONB,
    steal_log JSONB DEFAULT '{}'::JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    weekly_height_start INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all columns exist visually (if table already exists)
ALTER TABLE public.user_gamification 
ADD COLUMN IF NOT EXISTS last_stolen_at TIMESTAMPTZ DEFAULT '2000-01-01',
ADD COLUMN IF NOT EXISTS referrer_id TEXT,
ADD COLUMN IF NOT EXISTS garden_state JSONB DEFAULT '{"read_ids":[], "reads":0, "reward_claimed":false}'::JSONB,
ADD COLUMN IF NOT EXISTS quests_state JSONB DEFAULT '{"p":{}, "d":{}, "l":""}'::JSONB,
ADD COLUMN IF NOT EXISTS weekly_height_start INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_wheel TIMESTAMPTZ DEFAULT '2000-01-01';


-- 2. ACCESS POLICIES (RLS)
-- Crucial for GUEST modes to work (UIDs that aren't in auth.users)
ALTER TABLE public.user_gamification ENABLE ROW LEVEL SECURITY;

-- Allow Public READ (Leaderboards, Visiting Neighbors)
DROP POLICY IF EXISTS "Gamification Public Select" ON public.user_gamification;
CREATE POLICY "Gamification Public Select" ON public.user_gamification FOR SELECT USING (true);

-- Allow Public UPSERT (Saving local guest progress)
DROP POLICY IF EXISTS "Gamification Public All" ON public.user_gamification;
CREATE POLICY "Gamification Public All" ON public.user_gamification FOR ALL USING (true) WITH CHECK (true);


-- 3. MECHANIC: SECURE HARVEST TREE (Visiting Neighbors)
-- Atomically handles gathering resources from inactive neighbors.
DROP FUNCTION IF EXISTS secure_harvest_tree(TEXT, TEXT);
CREATE OR REPLACE FUNCTION secure_harvest_tree(p_visitor_id TEXT, p_target_id TEXT)
RETURNS jsonb AS $$
DECLARE
    v_target_last_active timestamptz;
    v_target_last_stolen timestamptz;
    v_reward_w integer := 10;
    v_reward_s integer := 5;
BEGIN
    -- Get target status
    SELECT last_active, last_stolen_at 
    INTO v_target_last_active, v_target_last_stolen
    FROM public.user_gamification 
    WHERE user_id = p_target_id;

    -- 1. Verify target is offline for at least 4 hours
    IF v_target_last_active > (now() - interval '4 hours') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Сусід був у мережі менш як 4 години тому');
    END IF;

    -- 2. Verify target hasn't been harvested in the last 4 hours (Global Lock)
    IF v_target_last_stolen > (now() - interval '4 hours') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Цього сусіда вже хтось обігнав! Ресурси зібрані нещодавно');
    END IF;

    -- 3. Atomically update target's last_stolen_at to lock it
    UPDATE public.user_gamification 
    SET last_stolen_at = now() 
    WHERE user_id = p_target_id;

    -- 4. Atomically award visitor
    UPDATE public.user_gamification 
    SET aqua_data = aqua_data + v_reward_w,
        solar_insight = solar_insight + v_reward_s
    WHERE user_id = p_visitor_id;

    RETURN jsonb_build_object(
        'success', true, 
        'reward_w', v_reward_w, 
        'reward_s', v_reward_s,
        'msg', 'Хто перший, той і встиг! Ви отримали ' || v_reward_w || ' 💧 та ' || v_reward_s || ' ☀️.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. MECHANIC: REFERRAL REWARDS (claim_referral_rewards)
-- Claims rewards for friends invited via referral links.
DROP FUNCTION IF EXISTS claim_referral_rewards(TEXT);
CREATE OR REPLACE FUNCTION claim_referral_rewards(p_user_id TEXT)
RETURNS jsonb AS $$
DECLARE
    v_total_rewarded INTEGER;
    v_water_reward INTEGER := 50; 
BEGIN
    -- 1. Count unrewarded referrals (friends who entered the game via p_user_id's link)
    SELECT count(*) INTO v_total_rewarded
    FROM public.user_gamification
    WHERE referrer_id = p_user_id AND (garden_state->>'reward_claimed')::boolean IS NOT TRUE;

    IF v_total_rewarded > 0 THEN
        -- 2. Mark them as rewarded to this referrer
        UPDATE public.user_gamification
        SET garden_state = jsonb_set(COALESCE(garden_state, '{}'::jsonb), '{reward_claimed}', 'true'::jsonb)
        WHERE referrer_id = p_user_id AND (garden_state->>'reward_claimed')::boolean IS NOT TRUE;

        -- 3. Award the referrer
        UPDATE public.user_gamification
        SET aqua_data = aqua_data + (v_total_rewarded * v_water_reward)
        WHERE user_id = p_user_id;
    END IF;

    RETURN jsonb_build_object(
        'rewarded', v_total_rewarded,
        'water_added', (v_total_rewarded * v_water_reward)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_ug_height ON public.user_gamification (tree_height DESC);
CREATE INDEX IF NOT EXISTS idx_ug_user_id ON public.user_gamification (user_id);

-- DONE
