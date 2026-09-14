-- ====================================================================
-- MIGRATION: Live Sessions Metadata Access Policy
-- Purpose: Allows authenticated users to view read-only metadata of genuinely
-- active live interviews in the platform "LIVE NOW" section, while preserving
-- all existing strict RLS policies (only participants can update/delete/execute code).
-- Non-destructive: No DROP TABLE or DROP COLUMN statements.
-- ====================================================================

-- 1. Additive SELECT policy for active interviews metadata
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'interviews' 
        AND policyname = 'Authenticated users can view active live session metadata'
    ) THEN
        CREATE POLICY "Authenticated users can view active live session metadata"
        ON public.interviews
        FOR SELECT TO authenticated
        USING (status = 'active');
    END IF;
END $$;

-- 2. Secure helper function to get active live sessions
CREATE OR REPLACE FUNCTION public.get_active_live_sessions()
RETURNS TABLE (
    id UUID,
    interviewer_id UUID,
    interviewer_name TEXT,
    candidate_id UUID,
    candidate_name TEXT,
    interview_type TEXT,
    difficulty TEXT,
    start_time TIMESTAMPTZ,
    duration INTEGER,
    status TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        i.id,
        i.interviewer_id,
        COALESCE(p_int.full_name, i.interviewer_name, 'Interviewer') AS interviewer_name,
        i.candidate_id,
        COALESCE(p_cand.full_name, i.candidate_name, 'Candidate') AS candidate_name,
        i.interview_type,
        i.difficulty::text,
        i.start_time,
        i.duration,
        i.status
    FROM public.interviews i
    LEFT JOIN public.profiles p_int ON p_int.id = i.interviewer_id
    LEFT JOIN public.profiles p_cand ON p_cand.id = i.candidate_id
    WHERE i.status = 'active'
    ORDER BY i.start_time DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_live_sessions() TO authenticated, anon;
