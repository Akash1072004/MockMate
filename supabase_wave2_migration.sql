-- ====================================================================
-- MOCKMATE IDEMPOTENT MIGRATION: WAVE 2 (PROFILES, STORAGE-BACKED RESUMES, QUESTION BANK MGMT)
-- File: supabase_wave2_migration.sql
-- 
-- PURPOSE:
-- Safely applies:
-- 1. Profile extensions: username, headline, avatar_url, leetcode, codeforces, codechef, experience
-- 2. Question soft-deletion flag: is_archived on public.questions
-- 3. Metadata-only public.resumes table (files stored in private Supabase Storage)
-- 4. Supabase Storage bucket 'resumes' with strict private RLS policies
-- 5. Question deletion/archival RPC with creator authorization
-- ====================================================================

-- 1. EXTEND PUBLIC.PROFILES WITH PROFESSIONAL & SOCIAL COLUMNS
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS username TEXT,
    ADD COLUMN IF NOT EXISTS headline TEXT,
    ADD COLUMN IF NOT EXISTS avatar_url TEXT,
    ADD COLUMN IF NOT EXISTS leetcode TEXT,
    ADD COLUMN IF NOT EXISTS codeforces TEXT,
    ADD COLUMN IF NOT EXISTS codechef TEXT,
    ADD COLUMN IF NOT EXISTS experience TEXT;

-- Ensure username is unique if populated
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_profiles_username'
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT uq_profiles_username UNIQUE (username);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Populate default username for existing profiles without one
UPDATE public.profiles 
SET username = LOWER(REGEXP_REPLACE(SPLIT_PART(email, '@', 1), '[^a-zA-Z0-9_]', '_', 'g')) || '_' || SUBSTRING(id::text, 1, 4)
WHERE username IS NULL;

-- 2. EXTEND PUBLIC.QUESTIONS WITH SOFT-DELETE FLAG
ALTER TABLE public.questions 
    ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- 3. CREATE SECURE METADATA-ONLY RESUMES TABLE (NO BASE64 FILE DATA)
CREATE TABLE IF NOT EXISTS public.resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL DEFAULT 'application/pdf',
    file_size INTEGER NOT NULL DEFAULT 0,
    storage_path TEXT NOT NULL,      -- Path in private 'resumes' storage bucket: <candidate_id>/<timestamp>_<filename>
    extracted_text TEXT,             -- Parsed plain text content for AI interview personalization
    skills_extracted TEXT[],         -- Candidate skills extracted from resume
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_candidate_resume UNIQUE (candidate_id)
);

-- Ensure columns exist if table was previously created
ALTER TABLE public.resumes 
    ADD COLUMN IF NOT EXISTS filename TEXT,
    ADD COLUMN IF NOT EXISTS file_type TEXT DEFAULT 'application/pdf',
    ADD COLUMN IF NOT EXISTS file_size INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS storage_path TEXT,
    ADD COLUMN IF NOT EXISTS extracted_text TEXT,
    ADD COLUMN IF NOT EXISTS skills_extracted TEXT[],
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;

-- 4. RLS POLICIES FOR PUBLIC.RESUMES TABLE
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'resumes' AND policyname = 'Candidates can view own resume') THEN
        CREATE POLICY "Candidates can view own resume" ON public.resumes
            FOR SELECT USING (auth.uid() = candidate_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'resumes' AND policyname = 'Candidates can insert own resume') THEN
        CREATE POLICY "Candidates can insert own resume" ON public.resumes
            FOR INSERT WITH CHECK (auth.uid() = candidate_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'resumes' AND policyname = 'Candidates can update own resume') THEN
        CREATE POLICY "Candidates can update own resume" ON public.resumes
            FOR UPDATE USING (auth.uid() = candidate_id) WITH CHECK (auth.uid() = candidate_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'resumes' AND policyname = 'Candidates can delete own resume') THEN
        CREATE POLICY "Candidates can delete own resume" ON public.resumes
            FOR DELETE USING (auth.uid() = candidate_id);
    END IF;
    -- Assigned interviewers can view candidate resume for their active/accepted interview or request
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'resumes' AND policyname = 'Assigned interviewers can view candidate resume') THEN
        CREATE POLICY "Assigned interviewers can view candidate resume" ON public.resumes
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.interviews i
                    WHERE i.candidate_id = resumes.candidate_id
                      AND i.interviewer_id = auth.uid()
                ) OR EXISTS (
                    SELECT 1 FROM public.interview_requests r
                    WHERE r.candidate_id = resumes.candidate_id
                      AND r.interviewer_id = auth.uid()
                      AND r.status IN ('pending', 'accepted')
                )
            );
    END IF;
END $$;

-- 5. CONFIGURE PRIVATE SUPABASE STORAGE BUCKET FOR RESUMES
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'resumes', 
    'resumes', 
    false, -- STRICTLY PRIVATE: no unauthenticated/public URL access
    10485760, -- 10 MB maximum file size limit
    ARRAY[
        'application/pdf', 
        'text/plain', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
        'application/msword'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760;

-- 6. STORAGE RLS POLICIES FOR 'resumes' BUCKET (storage.objects)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Candidates can upload own resume storage') THEN
        CREATE POLICY "Candidates can upload own resume storage" ON storage.objects
            FOR INSERT WITH CHECK (
                bucket_id = 'resumes' 
                AND auth.uid()::text = split_part(name, '/', 1)
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Candidates can read own resume storage') THEN
        CREATE POLICY "Candidates can read own resume storage" ON storage.objects
            FOR SELECT USING (
                bucket_id = 'resumes' 
                AND auth.uid()::text = split_part(name, '/', 1)
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Candidates can update own resume storage') THEN
        CREATE POLICY "Candidates can update own resume storage" ON storage.objects
            FOR UPDATE USING (
                bucket_id = 'resumes' 
                AND auth.uid()::text = split_part(name, '/', 1)
            ) WITH CHECK (
                bucket_id = 'resumes' 
                AND auth.uid()::text = split_part(name, '/', 1)
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Candidates can delete own resume storage') THEN
        CREATE POLICY "Candidates can delete own resume storage" ON storage.objects
            FOR DELETE USING (
                bucket_id = 'resumes' 
                AND auth.uid()::text = split_part(name, '/', 1)
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Assigned interviewers can read candidate resume storage') THEN
        CREATE POLICY "Assigned interviewers can read candidate resume storage" ON storage.objects
            FOR SELECT USING (
                bucket_id = 'resumes'
                AND (
                    EXISTS (
                        SELECT 1 FROM public.interviews i
                        WHERE i.candidate_id::text = split_part(name, '/', 1)
                          AND i.interviewer_id = auth.uid()
                    ) OR EXISTS (
                        SELECT 1 FROM public.interview_requests r
                        WHERE r.candidate_id::text = split_part(name, '/', 1)
                          AND r.interviewer_id = auth.uid()
                          AND r.status IN ('pending', 'accepted')
                    )
                )
            );
    END IF;
END $$;

-- 7. SECURE RPC: DELETE / ARCHIVE INTERVIEWER QUESTION
CREATE OR REPLACE FUNCTION public.delete_interviewer_question(p_question_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_creator UUID;
    v_user_role user_role;
    v_caller UUID := auth.uid();
BEGIN
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT role INTO v_user_role FROM public.profiles WHERE id = v_caller;
    IF v_user_role != 'interviewer' THEN
        RAISE EXCEPTION 'Only interviewers are authorized to delete questions.';
    END IF;

    SELECT created_by INTO v_creator FROM public.questions WHERE id = p_question_id;
    IF v_creator IS NULL OR v_creator != v_caller THEN
        RAISE EXCEPTION 'You are only authorized to delete questions that you created.';
    END IF;

    -- Soft-delete to preserve historical interview records
    UPDATE public.questions 
    SET is_archived = true, updated_at = now()
    WHERE id = p_question_id;

    RETURN jsonb_build_object('success', true, 'question_id', p_question_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_interviewer_question(UUID) TO authenticated;
