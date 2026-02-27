-- ============================================================
-- TTS Audio Caching Setup
-- Run in Supabase SQL Editor (safe to re-run multiple times)
-- ============================================================

-- 1. Add tts_audio_url column to news table
ALTER TABLE news ADD COLUMN IF NOT EXISTS tts_audio_url TEXT;

-- ============================================================
-- 2. Create the tts_audio storage bucket (if not exists)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('tts_audio', 'tts_audio', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ============================================================
-- 3. Storage RLS Policies — drop first so re-running is safe
-- ============================================================
DROP POLICY IF EXISTS "tts_audio_public_read" ON storage.objects;
DROP POLICY IF EXISTS "tts_audio_anon_insert" ON storage.objects;
DROP POLICY IF EXISTS "tts_audio_anon_update" ON storage.objects;

-- Allow anyone to READ files
CREATE POLICY "tts_audio_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'tts_audio');

-- Allow anyone (anon) to UPLOAD audio files
CREATE POLICY "tts_audio_anon_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'tts_audio');

-- Allow anyone to UPDATE/UPSERT files
CREATE POLICY "tts_audio_anon_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'tts_audio');
