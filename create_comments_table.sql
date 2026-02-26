-- Create comments table
CREATE TABLE IF NOT EXISTS public.comments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id uuid REFERENCES public.news(id) ON DELETE CASCADE,
    user_name text NOT NULL,
    content text NOT NULL,
    likes integer DEFAULT 0,
    dislikes integer DEFAULT 0,
    is_approved boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public Read Approved" ON public.comments
    FOR SELECT USING (is_approved = true);

CREATE POLICY "Public Insert" ON public.comments
    FOR INSERT WITH CHECK (true);

-- Admin Policy (Assuming service_role is used or add specific admin logic if needed)
CREATE POLICY "Admin All" ON public.comments
    FOR ALL USING (true) WITH CHECK (true);

-- RPC for updating comment reactions (supports increment/decrement via delta)
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
