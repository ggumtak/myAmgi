-- myAmgi Supabase Initial Schema Migration (Idempotent)
-- Safe to run multiple times in Supabase SQL Editor.

-- 1. User settings (1 row per user)
CREATE TABLE IF NOT EXISTS public.amgi_user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    two_button_mode BOOLEAN NOT NULL DEFAULT true,
    night_mode TEXT NOT NULL DEFAULT 'auto',
    settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Full collection snapshot metadata (1 row per user)
CREATE TABLE IF NOT EXISTS public.amgi_collections (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    snapshot_path TEXT,
    snapshot_sha256 TEXT,
    snapshot_size BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    device_name TEXT
);

-- 3. Incremental sync items (LWW per item across devices)
CREATE TABLE IF NOT EXISTS public.amgi_sync_items (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('deck', 'notetype', 'note', 'card', 'revlog')),
    item_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    deleted BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, kind, item_id)
);

-- 4. Media manifest (references files stored in private bucket 'amgi-media')
CREATE TABLE IF NOT EXISTS public.amgi_media_manifest (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
    deleted BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, filename)
);

-- Helpful indexes for incremental delta queries
CREATE INDEX IF NOT EXISTS idx_amgi_user_settings_user_updated
    ON public.amgi_user_settings (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_amgi_collections_user_updated
    ON public.amgi_collections (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_amgi_sync_items_user_updated
    ON public.amgi_sync_items (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_amgi_media_manifest_user_updated
    ON public.amgi_media_manifest (user_id, updated_at DESC);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.amgi_user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amgi_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amgi_sync_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amgi_media_manifest ENABLE ROW LEVEL SECURITY;

-- Owner-only RLS policies: public.amgi_user_settings
DROP POLICY IF EXISTS "amgi_user_settings_select_own" ON public.amgi_user_settings;
CREATE POLICY "amgi_user_settings_select_own"
    ON public.amgi_user_settings
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "amgi_user_settings_insert_own" ON public.amgi_user_settings;
CREATE POLICY "amgi_user_settings_insert_own"
    ON public.amgi_user_settings
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "amgi_user_settings_update_own" ON public.amgi_user_settings;
CREATE POLICY "amgi_user_settings_update_own"
    ON public.amgi_user_settings
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "amgi_user_settings_delete_own" ON public.amgi_user_settings;
CREATE POLICY "amgi_user_settings_delete_own"
    ON public.amgi_user_settings
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Owner-only RLS policies: public.amgi_collections
DROP POLICY IF EXISTS "amgi_collections_select_own" ON public.amgi_collections;
CREATE POLICY "amgi_collections_select_own"
    ON public.amgi_collections
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "amgi_collections_insert_own" ON public.amgi_collections;
CREATE POLICY "amgi_collections_insert_own"
    ON public.amgi_collections
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "amgi_collections_update_own" ON public.amgi_collections;
CREATE POLICY "amgi_collections_update_own"
    ON public.amgi_collections
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "amgi_collections_delete_own" ON public.amgi_collections;
CREATE POLICY "amgi_collections_delete_own"
    ON public.amgi_collections
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Owner-only RLS policies: public.amgi_sync_items
DROP POLICY IF EXISTS "amgi_sync_items_select_own" ON public.amgi_sync_items;
CREATE POLICY "amgi_sync_items_select_own"
    ON public.amgi_sync_items
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "amgi_sync_items_insert_own" ON public.amgi_sync_items;
CREATE POLICY "amgi_sync_items_insert_own"
    ON public.amgi_sync_items
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "amgi_sync_items_update_own" ON public.amgi_sync_items;
CREATE POLICY "amgi_sync_items_update_own"
    ON public.amgi_sync_items
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "amgi_sync_items_delete_own" ON public.amgi_sync_items;
CREATE POLICY "amgi_sync_items_delete_own"
    ON public.amgi_sync_items
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Owner-only RLS policies: public.amgi_media_manifest
DROP POLICY IF EXISTS "amgi_media_manifest_select_own" ON public.amgi_media_manifest;
CREATE POLICY "amgi_media_manifest_select_own"
    ON public.amgi_media_manifest
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "amgi_media_manifest_insert_own" ON public.amgi_media_manifest;
CREATE POLICY "amgi_media_manifest_insert_own"
    ON public.amgi_media_manifest
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "amgi_media_manifest_update_own" ON public.amgi_media_manifest;
CREATE POLICY "amgi_media_manifest_update_own"
    ON public.amgi_media_manifest
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "amgi_media_manifest_delete_own" ON public.amgi_media_manifest;
CREATE POLICY "amgi_media_manifest_delete_own"
    ON public.amgi_media_manifest
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Private Storage bucket for media & collection snapshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('amgi-media', 'amgi-media', false)
ON CONFLICT (id) DO NOTHING;

-- Owner-only RLS policies on storage.objects for 'amgi-media'
-- Objects must be stored under '<auth.uid()>/...'
DROP POLICY IF EXISTS "amgi_media_storage_select_own" ON storage.objects;
CREATE POLICY "amgi_media_storage_select_own"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'amgi-media'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "amgi_media_storage_insert_own" ON storage.objects;
CREATE POLICY "amgi_media_storage_insert_own"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'amgi-media'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "amgi_media_storage_update_own" ON storage.objects;
CREATE POLICY "amgi_media_storage_update_own"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'amgi-media'
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'amgi-media'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "amgi_media_storage_delete_own" ON storage.objects;
CREATE POLICY "amgi_media_storage_delete_own"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'amgi-media'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
