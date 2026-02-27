-- Migration to enable TTS Audio Caching
-- This script adds a column to store the URL of the generated audio file

ALTER TABLE news ADD COLUMN IF NOT EXISTS tts_audio_url TEXT;

-- Note: You should also create a public storage bucket named 'tts_audio' in Supabase Dashboard
-- with public access enabled for reading files.
