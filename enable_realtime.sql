-- Цей скрипт вмикає Realtime для таблиць news та comments.
-- Виконайте його в SQL Editor у вашому Supabase Dashboard.

-- 1. Додаємо таблицю news до публікації realtime
alter publication supabase_realtime add table news;

-- 2. Додаємо таблицю comments до публікації realtime
alter publication supabase_realtime add table comments;
