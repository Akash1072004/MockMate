-- ============================================================================
-- MOCKMATE: AVATARS STORAGE BUCKET & SECURITY POLICIES
-- ============================================================================

-- 1. Create public avatars bucket if it does not already exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars', 
    'avatars', 
    true, -- Publicly readable so avatars can display across dashboards & peer rooms
    5242880, -- 5 MB maximum file size limit
    ARRAY[
        'image/jpeg', 
        'image/png', 
        'image/webp', 
        'image/jpg', 
        'image/gif'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880;

-- 2. Storage Row-Level Security Policies for 'avatars'
DO $$
BEGIN
    -- Allow authenticated users to upload their own avatar
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload own avatar storage') THEN
        CREATE POLICY "Users can upload own avatar storage" ON storage.objects
            FOR INSERT WITH CHECK (
                bucket_id = 'avatars' 
                AND auth.uid()::text = split_part(name, '/', 1)
            );
    END IF;

    -- Allow anyone (authenticated or public) to read avatars
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public can read avatars storage') THEN
        CREATE POLICY "Public can read avatars storage" ON storage.objects
            FOR SELECT USING (
                bucket_id = 'avatars'
            );
    END IF;

    -- Allow authenticated users to update their own avatar
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update own avatar storage') THEN
        CREATE POLICY "Users can update own avatar storage" ON storage.objects
            FOR UPDATE USING (
                bucket_id = 'avatars' 
                AND auth.uid()::text = split_part(name, '/', 1)
            ) WITH CHECK (
                bucket_id = 'avatars' 
                AND auth.uid()::text = split_part(name, '/', 1)
            );
    END IF;

    -- Allow authenticated users to delete their own avatar
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete own avatar storage') THEN
        CREATE POLICY "Users can delete own avatar storage" ON storage.objects
            FOR DELETE USING (
                bucket_id = 'avatars' 
                AND auth.uid()::text = split_part(name, '/', 1)
            );
    END IF;
END $$;
