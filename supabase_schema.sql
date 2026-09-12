-- ====================================================================
-- MOCKMATE SUPABASE DATABASE SCHEMA
-- Production-Ready Secure Schema with Strict RLS, Triggers & Atomic RPCs
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUM TYPES
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('candidate', 'interviewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE request_status AS ENUM ('pending', 'accepted', 'declined', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE interview_status AS ENUM ('waiting', 'active', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE interview_type AS ENUM ('Technical', 'DSA', 'Frontend', 'Backend', 'Full Stack', 'HR', 'Behavioral');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE difficulty_level AS ENUM ('Easy', 'Medium', 'Hard');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'candidate',
    bio TEXT,
    skills TEXT[],
    github TEXT,
    linkedin TEXT,
    portfolio TEXT,
    experience TEXT,
    is_available BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. INTERVIEW REQUESTS TABLE (Created before interviews for bidirectional foreign key reference)
CREATE TABLE IF NOT EXISTS public.interview_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    interviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    candidate_name TEXT NOT NULL,
    candidate_email TEXT,
    candidate_socials JSONB DEFAULT '{}'::jsonb,
    status request_status NOT NULL DEFAULT 'pending',
    interview_id UUID, -- Foreign key constraint added below after interviews table
    join_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    responded_at TIMESTAMPTZ,
    CONSTRAINT chk_different_participants CHECK (candidate_id != interviewer_id)
);

-- 5. INTERVIEWS TABLE
CREATE TABLE IF NOT EXISTS public.interviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    interviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    candidate_name TEXT NOT NULL,
    interviewer_name TEXT,
    interview_type interview_type NOT NULL DEFAULT 'Technical',
    difficulty difficulty_level NOT NULL DEFAULT 'Medium',
    duration INTEGER NOT NULL DEFAULT 30, -- minutes
    status interview_status NOT NULL DEFAULT 'waiting',
    score NUMERIC(4, 1),
    code TEXT DEFAULT '',
    language TEXT DEFAULT 'python',
    join_code TEXT UNIQUE NOT NULL,
    is_ai BOOLEAN NOT NULL DEFAULT false,
    request_id UUID REFERENCES public.interview_requests(id) ON DELETE SET NULL,
    evaluation JSONB,
    start_time TIMESTAMPTZ,
    completion_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_ai_interview_no_peer CHECK (
        (is_ai = true AND interviewer_id IS NULL) OR
        (is_ai = false AND interviewer_id IS NOT NULL)
    )
);

-- Add foreign key from interview_requests to interviews if not already present
DO $$ BEGIN
    ALTER TABLE public.interview_requests 
        ADD CONSTRAINT fk_request_interview FOREIGN KEY (interview_id) 
        REFERENCES public.interviews(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 6. INTERVIEW QUESTIONS TABLE
CREATE TABLE IF NOT EXISTS public.interview_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
    question_order INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    question_type TEXT DEFAULT 'conceptual', -- 'conceptual', 'coding', 'behavioral'
    hints JSONB DEFAULT '[]'::jsonb,
    expected_topics JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. INTERVIEW ANSWERS TABLE
CREATE TABLE IF NOT EXISTS public.interview_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.interview_questions(id) ON DELETE CASCADE,
    candidate_answer TEXT,
    code_snapshot TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_interview_question_answer UNIQUE (interview_id, question_id)
);

-- 8. CODE SUBMISSIONS TABLE
CREATE TABLE IF NOT EXISTS public.code_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    language TEXT NOT NULL,
    verdict TEXT NOT NULL,
    passed_tests INTEGER DEFAULT 0,
    total_tests INTEGER DEFAULT 0,
    execution_time_ms INTEGER,
    output TEXT,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. REVIEWS TABLE
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    interviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_interview_review UNIQUE (interview_id)
);

-- 10. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_availability ON public.profiles(is_available) WHERE role = 'interviewer';
CREATE INDEX IF NOT EXISTS idx_requests_interviewer ON public.interview_requests(interviewer_id, status);
CREATE INDEX IF NOT EXISTS idx_requests_candidate ON public.interview_requests(candidate_id, status);
CREATE INDEX IF NOT EXISTS idx_interviews_candidate ON public.interviews(candidate_id);
CREATE INDEX IF NOT EXISTS idx_interviews_interviewer ON public.interviews(interviewer_id);
CREATE INDEX IF NOT EXISTS idx_interviews_join_code ON public.interviews(join_code);
CREATE INDEX IF NOT EXISTS idx_reviews_interviewer ON public.reviews(interviewer_id);

-- Prevent duplicate peer interviews for the same interview request
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_peer_interview_request 
    ON public.interviews(request_id) 
    WHERE request_id IS NOT NULL;

-- ====================================================================
-- 11. SECURITY TRIGGERS (DATA INTEGRITY & FIELD ENFORCEMENT)
-- ====================================================================

-- Trigger 1: Prevent users from changing their own role after profile creation
CREATE OR REPLACE FUNCTION public.prevent_profile_role_change()
RETURNS trigger AS $$
BEGIN
    IF NEW.role != OLD.role AND auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Security violation: User role cannot be changed after account creation.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_profile_role_change ON public.profiles;
CREATE TRIGGER trg_prevent_profile_role_change
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_profile_role_change();

-- Trigger 2: Enforce interview request state transitions & immutable participants
CREATE OR REPLACE FUNCTION public.enforce_interview_request_security()
RETURNS trigger AS $$
DECLARE
    v_cand_role public.user_role;
    v_int_role public.user_role;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Verify candidate_id != interviewer_id
        IF NEW.candidate_id = NEW.interviewer_id THEN
            RAISE EXCEPTION 'Candidate and interviewer must be different users.';
        END IF;

        -- Verify roles from profiles table
        SELECT role INTO v_cand_role FROM public.profiles WHERE id = NEW.candidate_id;
        IF v_cand_role IS NULL OR v_cand_role != 'candidate' THEN
            RAISE EXCEPTION 'Only users with role candidate can create interview requests.';
        END IF;

        SELECT role INTO v_int_role FROM public.profiles WHERE id = NEW.interviewer_id;
        IF v_int_role IS NULL OR v_int_role != 'interviewer' THEN
            RAISE EXCEPTION 'Target user must have role interviewer.';
        END IF;

        -- Candidate must not be able to pre-set accepted, interview_id, join_code
        NEW.status := 'pending';
        NEW.interview_id := NULL;
        NEW.join_code := NULL;
        NEW.responded_at := NULL;
        RETURN NEW;
    END IF;

    -- TG_OP = 'UPDATE'
    -- Participants are immutable
    NEW.candidate_id := OLD.candidate_id;
    NEW.interviewer_id := OLD.interviewer_id;

    -- Direct client updates to accepted/declined/cancelled are blocked
    -- (Must be executed via secure SECURITY DEFINER RPCs)
    IF auth.role() != 'service_role' THEN
        IF auth.uid() = OLD.candidate_id THEN
            IF OLD.status != 'pending' OR NEW.status != 'cancelled' THEN
                RAISE EXCEPTION 'Candidates can only cancel their own pending requests via cancel_interview_request RPC.';
            END IF;
        ELSIF auth.uid() = OLD.interviewer_id THEN
            IF OLD.status != 'pending' THEN
                RAISE EXCEPTION 'Cannot modify request: already resolved with status %', OLD.status;
            END IF;
            IF NEW.status NOT IN ('accepted', 'declined') THEN
                RAISE EXCEPTION 'Interviewers can only accept or decline requests via designated RPCs.';
            END IF;
        ELSE
            RAISE EXCEPTION 'Unauthorized: You are not a participant in this request.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_interview_request_security ON public.interview_requests;
CREATE TRIGGER trg_enforce_interview_request_security
    BEFORE INSERT OR UPDATE ON public.interview_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_interview_request_security();

-- Trigger 3: Protect sensitive fields on interviews (candidate_id, interviewer_id, join_code, scores)
CREATE OR REPLACE FUNCTION public.enforce_interview_update_security()
RETURNS trigger AS $$
BEGIN
    -- Core ownership fields and join codes are strictly immutable
    NEW.candidate_id := OLD.candidate_id;
    NEW.interviewer_id := OLD.interviewer_id;
    NEW.join_code := OLD.join_code;
    NEW.is_ai := OLD.is_ai;
    NEW.request_id := OLD.request_id;

    -- Candidates cannot arbitrarily modify score or evaluation
    IF auth.uid() = OLD.candidate_id AND (OLD.interviewer_id IS NULL OR auth.uid() != OLD.interviewer_id) AND auth.role() != 'service_role' THEN
        NEW.score := OLD.score;
        NEW.evaluation := OLD.evaluation;
        
        -- In peer interviews, candidate cannot unilaterally mark interview as completed
        IF OLD.is_ai = false AND NEW.status = 'completed' AND OLD.status != 'completed' THEN
            RAISE EXCEPTION 'Only the interviewer can conclude and finalize a peer interview session.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_interview_update_security ON public.interviews;
CREATE TRIGGER trg_enforce_interview_update_security
    BEFORE UPDATE ON public.interviews
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_interview_update_security();

-- ====================================================================
-- 12. SECURE DATABASE RPCs (ATOMIC OPERATIONS)
-- ====================================================================

-- RPC 1: Atomically accept an interview request and create exactly one peer interview
CREATE OR REPLACE FUNCTION public.accept_interview_request(p_request_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_req public.interview_requests%ROWTYPE;
    v_interview public.interviews%ROWTYPE;
    v_candidate public.profiles%ROWTYPE;
    v_interviewer public.profiles%ROWTYPE;
    v_join_code TEXT;
    v_collision BOOLEAN;
BEGIN
    -- 1. Fetch and lock request row
    SELECT * INTO v_req 
    FROM public.interview_requests 
    WHERE id = p_request_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Interview request with ID % not found.', p_request_id;
    END IF;

    -- 2. Verify caller is the designated interviewer
    IF auth.uid() != v_req.interviewer_id AND auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: Only the designated interviewer can accept this request.';
    END IF;

    -- 3. Verify request is still pending
    IF v_req.status != 'pending' THEN
        RAISE EXCEPTION 'Cannot accept request: Current status is %', v_req.status;
    END IF;

    -- 4. Fetch candidate and interviewer profiles and verify active roles
    SELECT * INTO v_candidate FROM public.profiles WHERE id = v_req.candidate_id;
    IF NOT FOUND OR v_candidate.role != 'candidate' THEN
        RAISE EXCEPTION 'Candidate account not found or no longer has candidate role.';
    END IF;

    SELECT * INTO v_interviewer FROM public.profiles WHERE id = v_req.interviewer_id;
    IF NOT FOUND OR v_interviewer.role != 'interviewer' THEN
        RAISE EXCEPTION 'Interviewer account not found or no longer has interviewer role.';
    END IF;

    -- 5. Generate unique 6-character alphanumeric join code
    LOOP
        v_join_code := 'MM-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
        SELECT EXISTS(SELECT 1 FROM public.interviews WHERE join_code = v_join_code) INTO v_collision;
        EXIT WHEN NOT v_collision;
    END LOOP;

    -- 6. Insert new peer interview
    INSERT INTO public.interviews (
        candidate_id,
        interviewer_id,
        candidate_name,
        interviewer_name,
        interview_type,
        difficulty,
        duration,
        status,
        join_code,
        is_ai,
        request_id
    ) VALUES (
        v_req.candidate_id,
        v_req.interviewer_id,
        COALESCE(v_candidate.full_name, v_req.candidate_name, 'Candidate'),
        COALESCE(v_interviewer.full_name, 'Interviewer'),
        'Technical',
        'Medium',
        45,
        'waiting',
        v_join_code,
        false,
        v_req.id
    ) RETURNING * INTO v_interview;

    -- 7. Update request atomically
    UPDATE public.interview_requests
    SET 
        status = 'accepted',
        interview_id = v_interview.id,
        join_code = v_join_code,
        responded_at = now()
    WHERE id = p_request_id
    RETURNING * INTO v_req;

    RETURN jsonb_build_object(
        'success', true,
        'interview', to_jsonb(v_interview),
        'request', to_jsonb(v_req)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- RPC 2: Atomically decline an interview request
CREATE OR REPLACE FUNCTION public.decline_interview_request(p_request_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_req public.interview_requests%ROWTYPE;
BEGIN
    SELECT * INTO v_req 
    FROM public.interview_requests 
    WHERE id = p_request_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Interview request not found.';
    END IF;

    IF auth.uid() != v_req.interviewer_id AND auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: Only the designated interviewer can decline this request.';
    END IF;

    IF v_req.status != 'pending' THEN
        RAISE EXCEPTION 'Cannot decline request: Current status is %', v_req.status;
    END IF;

    UPDATE public.interview_requests
    SET 
        status = 'declined',
        responded_at = now()
    WHERE id = p_request_id
    RETURNING * INTO v_req;

    RETURN jsonb_build_object('success', true, 'request', to_jsonb(v_req));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- RPC 3: Atomically cancel own pending interview request
CREATE OR REPLACE FUNCTION public.cancel_interview_request(p_request_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_req public.interview_requests%ROWTYPE;
BEGIN
    SELECT * INTO v_req 
    FROM public.interview_requests 
    WHERE id = p_request_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Interview request not found.';
    END IF;

    IF auth.uid() != v_req.candidate_id AND auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: You can only cancel your own interview requests.';
    END IF;

    IF v_req.status != 'pending' THEN
        RAISE EXCEPTION 'Cannot cancel request: Current status is %', v_req.status;
    END IF;

    UPDATE public.interview_requests
    SET 
        status = 'cancelled',
        responded_at = now()
    WHERE id = p_request_id
    RETURNING * INTO v_req;

    RETURN jsonb_build_object('success', true, 'request', to_jsonb(v_req));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- RPC 4: Securely join an interview session by Join Code with participant authorization
CREATE OR REPLACE FUNCTION public.join_interview_by_code(p_join_code TEXT)
RETURNS JSONB AS $$
DECLARE
    v_interview public.interviews%ROWTYPE;
    v_user_role TEXT;
    v_req_status public.request_status;
BEGIN
    IF p_join_code IS NULL OR trim(p_join_code) = '' THEN
        RAISE EXCEPTION 'Join code cannot be empty.';
    END IF;

    -- Lookup interview
    SELECT * INTO v_interview 
    FROM public.interviews 
    WHERE join_code = upper(trim(p_join_code));

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid join code: No interview session exists for this code.';
    END IF;

    -- Verify active or waiting status
    IF v_interview.status NOT IN ('waiting', 'active') THEN
        RAISE EXCEPTION 'Interview session is no longer joinable (Current status: %).', v_interview.status;
    END IF;

    -- Verify participant relationship
    IF v_interview.candidate_id = auth.uid() THEN
        v_user_role := 'candidate';
    ELSIF v_interview.interviewer_id = auth.uid() THEN
        v_user_role := 'interviewer';
    ELSE
        RAISE EXCEPTION 'Access Denied: You are not an authorized participant in this interview session.';
    END IF;

    -- For peer interviews with an associated request, verify that the request is in accepted state
    IF v_interview.is_ai = false AND v_interview.request_id IS NOT NULL THEN
        SELECT status INTO v_req_status
        FROM public.interview_requests
        WHERE id = v_interview.request_id;

        IF v_req_status IS NOT NULL AND v_req_status != 'accepted' THEN
            RAISE EXCEPTION 'Access Denied: The associated interview request is not in accepted status (Status: %).', v_req_status;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'interview', to_jsonb(v_interview),
        'userRole', v_user_role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Explicitly revoke execution from PUBLIC and grant strictly to authenticated users
REVOKE EXECUTE ON FUNCTION public.accept_interview_request(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_interview_request(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.decline_interview_request(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decline_interview_request(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.cancel_interview_request(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_interview_request(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.join_interview_by_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_interview_by_code(TEXT) TO authenticated;

-- ====================================================================
-- 13. ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- A. PROFILES POLICIES
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Public profiles can be viewed" ON public.profiles;
CREATE POLICY "Public profiles can be viewed" ON public.profiles
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- --------------------------------------------------------------------
-- B. INTERVIEW REQUESTS POLICIES
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Candidates can view own requests" ON public.interview_requests;
CREATE POLICY "Candidates can view own requests" ON public.interview_requests
    FOR SELECT TO authenticated
    USING (auth.uid() = candidate_id);

DROP POLICY IF EXISTS "Interviewers can view requests sent to them" ON public.interview_requests;
CREATE POLICY "Interviewers can view requests sent to them" ON public.interview_requests
    FOR SELECT TO authenticated
    USING (auth.uid() = interviewer_id);

DROP POLICY IF EXISTS "Candidates can create requests" ON public.interview_requests;
CREATE POLICY "Candidates can create requests" ON public.interview_requests
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = candidate_id 
        AND status = 'pending'
        AND interview_id IS NULL
        AND join_code IS NULL
        AND responded_at IS NULL
        AND candidate_id != interviewer_id
        AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'candidate')
        AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = interviewer_id AND p.role = 'interviewer')
    );

-- NOTE: Direct client UPDATE on interview_requests is strictly prohibited.
-- All state transitions (accepted, declined, cancelled) must be performed
-- exclusively via the atomic SECURITY DEFINER RPCs:
-- accept_interview_request(), decline_interview_request(), cancel_interview_request().
DROP POLICY IF EXISTS "Authorized users can update request" ON public.interview_requests;
DROP POLICY IF EXISTS "Authenticated users can update requests" ON public.interview_requests;
DROP POLICY IF EXISTS "Users can update requests" ON public.interview_requests;

-- --------------------------------------------------------------------
-- C. INTERVIEWS POLICIES
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Participants can view their interviews" ON public.interviews;
CREATE POLICY "Participants can view their interviews" ON public.interviews
    FOR SELECT TO authenticated
    USING (auth.uid() = candidate_id OR auth.uid() = interviewer_id);

-- Candidates may directly insert AI mock interviews only.
-- Peer interviews can NEVER be inserted directly by normal authenticated clients;
-- they are created exclusively via the atomic accept_interview_request() RPC.
DROP POLICY IF EXISTS "Candidates can create AI or peer interviews" ON public.interviews;
DROP POLICY IF EXISTS "Candidates can create AI interviews" ON public.interviews;
DROP POLICY IF EXISTS "Authorized users can create interviews" ON public.interviews;
CREATE POLICY "Candidates can create AI interviews" ON public.interviews
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = candidate_id 
        AND is_ai = true 
        AND interviewer_id IS NULL
    );

DROP POLICY IF EXISTS "Participants can update their interviews" ON public.interviews;
CREATE POLICY "Participants can update their interviews" ON public.interviews
    FOR UPDATE TO authenticated
    USING (auth.uid() = candidate_id OR auth.uid() = interviewer_id)
    WITH CHECK (auth.uid() = candidate_id OR auth.uid() = interviewer_id);

-- --------------------------------------------------------------------
-- D. INTERVIEW QUESTIONS POLICIES
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Participants can view interview questions" ON public.interview_questions;
CREATE POLICY "Participants can view interview questions" ON public.interview_questions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.interviews i
            WHERE i.id = interview_id AND (i.candidate_id = auth.uid() OR i.interviewer_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Authorized backend or creator can insert questions" ON public.interview_questions;
CREATE POLICY "Authorized backend or creator can insert questions" ON public.interview_questions
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.interviews i
            WHERE i.id = interview_id AND (i.candidate_id = auth.uid() OR i.interviewer_id = auth.uid())
        )
    );

-- --------------------------------------------------------------------
-- E. INTERVIEW ANSWERS POLICIES (SEPARATE SELECT / INSERT / UPDATE)
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Participants can view interview answers" ON public.interview_answers;
CREATE POLICY "Participants can view interview answers" ON public.interview_answers
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.interviews i
            WHERE i.id = interview_id AND (i.candidate_id = auth.uid() OR i.interviewer_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Candidates can insert or update answers" ON public.interview_answers;
DROP POLICY IF EXISTS "Candidates can insert their answers" ON public.interview_answers;
CREATE POLICY "Candidates can insert their answers" ON public.interview_answers
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.interviews i
            WHERE i.id = interview_id AND i.candidate_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Candidates can update their answers" ON public.interview_answers;
CREATE POLICY "Candidates can update their answers" ON public.interview_answers
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.interviews i
            WHERE i.id = interview_id AND i.candidate_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.interviews i
            WHERE i.id = interview_id AND i.candidate_id = auth.uid()
        )
    );

-- --------------------------------------------------------------------
-- F. CODE SUBMISSIONS POLICIES
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Participants can view code submissions" ON public.code_submissions;
CREATE POLICY "Participants can view code submissions" ON public.code_submissions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.interviews i
            WHERE i.id = interview_id AND (i.candidate_id = auth.uid() OR i.interviewer_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Participants can insert code submissions" ON public.code_submissions;
DROP POLICY IF EXISTS "Candidates can insert code submissions" ON public.code_submissions;
CREATE POLICY "Candidates can insert code submissions" ON public.code_submissions
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.interviews i
            WHERE i.id = interview_id AND i.candidate_id = auth.uid()
        )
    );

-- --------------------------------------------------------------------
-- G. REVIEWS POLICIES
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone authenticated can view reviews" ON public.reviews;
DROP POLICY IF EXISTS "Public reviews can be viewed by authenticated users" ON public.reviews;
CREATE POLICY "Public reviews can be viewed by authenticated users" ON public.reviews
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Candidates can insert review for completed interview" ON public.reviews;
DROP POLICY IF EXISTS "Candidates can insert review for completed peer interview" ON public.reviews;
CREATE POLICY "Candidates can insert review for completed peer interview" ON public.reviews
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = candidate_id AND
        EXISTS (
            SELECT 1 FROM public.interviews i
            WHERE i.id = interview_id 
              AND i.candidate_id = auth.uid() 
              AND i.interviewer_id = public.reviews.interviewer_id 
              AND i.interviewer_id IS NOT NULL
              AND i.is_ai = false
              AND i.status = 'completed'
        )
    );

-- Reviews are strictly immutable: no UPDATE or DELETE permitted
DROP POLICY IF EXISTS "Users can update reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can delete reviews" ON public.reviews;
DROP POLICY IF EXISTS "Candidates can update reviews" ON public.reviews;
DROP POLICY IF EXISTS "Candidates can delete reviews" ON public.reviews;

-- ====================================================================
-- 14. LEADERBOARD VIEW & RPC (GLOBAL VISIBILITY)
-- ====================================================================
-- security_invoker = false ensures aggregation sees all completed interviews
-- regardless of caller's individual table RLS filters.
CREATE OR REPLACE VIEW public.candidate_leaderboard WITH (security_invoker = false) AS
SELECT 
    p.id AS candidate_id,
    p.full_name AS candidate_name,
    p.github,
    COUNT(i.id) AS interview_count,
    ROUND(AVG(i.score), 1) AS average_score,
    DENSE_RANK() OVER (ORDER BY ROUND(AVG(i.score), 1) DESC, COUNT(i.id) DESC) AS rank
FROM public.profiles p
JOIN public.interviews i ON p.id = i.candidate_id
WHERE i.status = 'completed' AND i.score IS NOT NULL
GROUP BY p.id, p.full_name, p.github;

GRANT SELECT ON public.candidate_leaderboard TO authenticated;

-- Canonical RPC to query global leaderboard without RLS table truncation
CREATE OR REPLACE FUNCTION public.get_candidate_leaderboard()
RETURNS TABLE (
    candidate_id UUID,
    candidate_name TEXT,
    github TEXT,
    interview_count BIGINT,
    average_score NUMERIC,
    rank BIGINT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql AS $$
    SELECT 
        p.id AS candidate_id,
        p.full_name AS candidate_name,
        p.github,
        COUNT(i.id) AS interview_count,
        ROUND(AVG(i.score), 1) AS average_score,
        DENSE_RANK() OVER (ORDER BY ROUND(AVG(i.score), 1) DESC, COUNT(i.id) DESC) AS rank
    FROM public.profiles p
    JOIN public.interviews i ON p.id = i.candidate_id
    WHERE i.status = 'completed' AND i.score IS NOT NULL
    GROUP BY p.id, p.full_name, p.github;
$$;

REVOKE EXECUTE ON FUNCTION public.get_candidate_leaderboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_candidate_leaderboard() TO authenticated;

-- ====================================================================
-- 15. SAFE REALTIME PUBLICATION SETUP (IDEMPOTENT)
-- ====================================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'interview_requests'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.interview_requests;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'interviews'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.interviews;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    END IF;
END $$;
