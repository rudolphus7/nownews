-- 1. Add parent_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='comments' AND column_name='parent_id') THEN
        ALTER TABLE public.comments ADD COLUMN parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 2. Enable RLS (idempotent)
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- 3. Update Policies (Drop and recreate to avoid "already exists" errors)
DROP POLICY IF EXISTS "Public Read Approved" ON public.comments;
CREATE POLICY "Public Read Approved" ON public.comments
    FOR SELECT USING (is_approved = true);

DROP POLICY IF EXISTS "Public Insert" ON public.comments;
CREATE POLICY "Public Insert" ON public.comments
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admin All" ON public.comments;
CREATE POLICY "Admin All" ON public.comments
    FOR ALL USING (true) WITH CHECK (true);

-- 4. RPC for updating comment reactions (already uses CREATE OR REPLACE)
CREATE OR REPLACE FUNCTION update_comment_reaction(comment_id UUID, reaction_type TEXT, delta INTEGER)
RETURNS void AS $$
BEGIN
    IF reaction_type = 'likes' THEN
        UPDATE public.comments SET likes = GREATEST(0, likes + delta) WHERE id = comment_id;
    ELSIF reaction_type = 'dislikes' THEN
        UPDATE public.comments SET dislikes = GREATEST(0, dislikes + delta) WHERE id = comment_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
