-- 1. Додаємо нові колонки реакцій та колонку конфігурації
ALTER TABLE news 
ADD COLUMN IF NOT EXISTS sad INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS angry INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS support INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS allowed_reactions TEXT[] DEFAULT '{"like", "fire", "wow"}';

-- 2. Оновлюємо Realtime (якщо ще не додано)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'news'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE news;
    END IF;
END $$;
