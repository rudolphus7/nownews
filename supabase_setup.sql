-- Run this SQL in your Supabase SQL Editor to enable global reactions

-- 1. Add reaction columns to the news table
ALTER TABLE news 
ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS fire INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS wow INTEGER DEFAULT 0;

-- 2. Create an RPC function for atomic updates (increment/decrement)
CREATE OR REPLACE FUNCTION update_reaction(post_id UUID, reaction_type TEXT, delta INTEGER)
RETURNS void AS $$
BEGIN
  EXECUTE format('UPDATE news SET %I = GREATEST(0, COALESCE(%I, 0) + %L) WHERE id = %L', reaction_type, reaction_type, delta, post_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RSS SOURCES TABLE (Global for CMS)
CREATE TABLE IF NOT EXISTS public.rss_sources (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    url text UNIQUE NOT NULL,
    is_active boolean DEFAULT true,
    last_status text DEFAULT 'unknown',
    last_fetch timestamptz,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rss_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access" ON public.rss_sources;
CREATE POLICY "Public Access" ON public.rss_sources FOR ALL USING (true) WITH CHECK (true);

-- 4. RSS ARTICLES TABLE (Staging area for fetched news)
CREATE TABLE IF NOT EXISTS public.rss_articles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    link text UNIQUE NOT NULL,
    description text,
    full_content text,
    image_url text,
    pub_date timestamptz,
    source_name text,
    is_dismissed boolean DEFAULT false,
    is_imported boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rss_articles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access" ON public.rss_articles;
CREATE POLICY "Public Access" ON public.rss_articles FOR ALL USING (true) WITH CHECK (true);

-- 5. POPUPS TABLE (Management system)
CREATE TABLE IF NOT EXISTS public.popups (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    is_active boolean DEFAULT false,
    content_html text,
    image_url text,
    config jsonb DEFAULT '{"buttons": [], "triggers": {"type": "timer", "value": 5000}, "position": {"desktop": "center", "mobile": "center"}, "frequency": "session", "targeting": {"cities": [], "categories": []}}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.popups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access" ON public.popups;
CREATE POLICY "Public Access" ON public.popups FOR ALL USING (true) WITH CHECK (true);
