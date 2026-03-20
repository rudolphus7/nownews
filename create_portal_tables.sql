-- 1. PORTAL SETTINGS (City-specific configurations)
CREATE TABLE IF NOT EXISTS public.portal_settings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    city_slug text UNIQUE NOT NULL, -- e.g., 'kalush'
    portal_name text NOT NULL, -- e.g., 'Калуш ПОРТАЛ'
    logo_url text,
    header_config jsonb DEFAULT '{"bgColor": "#ffffff", "textColor": "#0f172a", "nav": []}'::jsonb,
    features jsonb DEFAULT '{"news": true, "places": true, "ads": true}'::jsonb,
    contact_info jsonb DEFAULT '{"telegram": "", "email": "", "phone": ""}'::jsonb,
    seo_config jsonb DEFAULT '{"title": "", "description": ""}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. PLACES (Establishment Directory)
CREATE TABLE IF NOT EXISTS public.places (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    city_slug text NOT NULL,
    name text NOT NULL,
    category_slug text NOT NULL, -- e.g., 'restaurants', 'services'
    category_name text NOT NULL, -- e.g., 'Ресторани', 'Сервіси'
    address text,
    phone text,
    image_url text,
    description text,
    is_featured boolean DEFAULT false, -- Show at the top of portal
    rating decimal DEFAULT 0, -- 1-5 stars
    order_index integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- 3. CLASSIFIEDS (Private & Commercial Ads)
CREATE TABLE IF NOT EXISTS public.classifieds (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    city_slug text NOT NULL,
    title text NOT NULL,
    category text DEFAULT 'Загальне',
    price text,
    description text,
    contact_phone text,
    image_url text,
    is_published boolean DEFAULT true,
    is_featured boolean DEFAULT false,
    gallery jsonb DEFAULT '[]'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS for all new tables
ALTER TABLE public.portal_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classifieds ENABLE ROW LEVEL SECURITY;

-- Default Public Read Access (ALL can read)
DROP POLICY IF EXISTS "Public Read Access portal_settings" ON public.portal_settings;
CREATE POLICY "Public Read Access portal_settings" ON public.portal_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Read Access places" ON public.places;
CREATE POLICY "Public Read Access places" ON public.places FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Read Access classifieds" ON public.classifieds;
CREATE POLICY "Public Read Access classifieds" ON public.classifieds FOR SELECT USING (true);

-- Insert Initial Kalush Data (Basic Placeholder)
INSERT INTO public.portal_settings (city_slug, portal_name, logo_url, seo_config)
VALUES ('kalush', 'КАЛУШ NEWS', '/logo.png', '{"title": "Портал міста Калуш | Новини, заклади, оголошення", "description": "Всі події громади Калуша в одному місці."}')
ON CONFLICT (city_slug) DO NOTHING;
