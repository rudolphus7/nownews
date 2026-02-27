-- ============================================================
-- TTS Audio Caching Setup
-- Run this ONCE in Supabase SQL Editor
-- ============================================================

-- 1. Add tts_audio_url column to news table
ALTER TABLE news ADD COLUMN IF NOT EXISTS tts_audio_url TEXT;

-- ============================================================
-- 2. Create the tts_audio storage bucket (if not exists via Dashboard)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('tts_audio', 'tts_audio', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ============================================================
-- 3. Storage RLS Policies for tts_audio bucket
-- ============================================================

-- Allow anyone to READ files (public bucket)
CREATE POLICY "tts_audio_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'tts_audio');

-- Allow anyone (anon) to UPLOAD audio files
-- (server-side upload happens via browser Supabase client)
CREATE POLICY "tts_audio_anon_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'tts_audio');

-- Allow anyone to UPDATE/UPSERT files (needed for upsert: true)
CREATE POLICY "tts_audio_anon_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'tts_audio');

-- ============================================================
-- 4. Allow updating tts_audio_url in the news table
-- ============================================================
-- (This assumes your existing RLS on news table allows updates,
--  or news is publicly updatable. Adjust if you have restrictions.)
