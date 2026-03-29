-- 1. ADD COLUMN TO TRACK GLOBAL HARVEST
ALTER TABLE public.user_gamification 
ADD COLUMN IF NOT EXISTS last_stolen_at timestamptz DEFAULT '2000-01-01 00:00:00+00';

-- 2. CREATE SECURE HARVEST RPC
-- This function handles the "First Come, First Served" logic atomically.
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
        RETURN jsonb_build_object('success', false, 'error', 'Цього сусіда вже хтось обігнав! Ресурси зібрані нещодавно (менш як 4 год тому)');
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
