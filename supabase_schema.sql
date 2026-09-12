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
    active_question_id UUID, -- References public.questions(id) below
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

-- 6. QUESTION BANK TABLE (LeetCode-Style Coding Problems)
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    difficulty difficulty_level NOT NULL DEFAULT 'Medium',
    topic TEXT NOT NULL DEFAULT 'Algorithms',
    input_description TEXT,
    output_description TEXT,
    constraints TEXT,
    examples JSONB DEFAULT '[]'::jsonb, -- Array of { input: string, output: string, explanation: string }
    starter_code JSONB DEFAULT '{}'::jsonb, -- { python: string, cpp: string, java: string }
    supported_languages TEXT[] DEFAULT ARRAY['python', 'cpp', 'java'],
    test_cases JSONB DEFAULT '[]'::jsonb, -- Array of { input: string, expectedOutput: string }
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6b. QUESTION HIDDEN TEST CASES (Isolated for Secure Backend Execution)
CREATE TABLE IF NOT EXISTS public.question_hidden_tests (
    question_id UUID PRIMARY KEY REFERENCES public.questions(id) ON DELETE CASCADE,
    hidden_test_cases JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of { input: string, expectedOutput: string }
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Add foreign key for active_question_id in interviews
DO $$ BEGIN
    ALTER TABLE public.interviews 
        ADD CONSTRAINT fk_interview_active_question FOREIGN KEY (active_question_id) 
        REFERENCES public.questions(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 6c. INTERVIEW QUESTIONS TABLE (Questions Associated with Specific Interview Sessions)
CREATE TABLE IF NOT EXISTS public.interview_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
    question_order INTEGER NOT NULL,
    question_text TEXT,
    title TEXT,
    description TEXT,
    difficulty TEXT,
    topic TEXT,
    input_description TEXT,
    output_description TEXT,
    constraints TEXT,
    examples JSONB DEFAULT '[]'::jsonb,
    starter_code JSONB DEFAULT '{}'::jsonb,
    test_cases JSONB DEFAULT '[]'::jsonb,
    question_type TEXT DEFAULT 'coding', -- 'coding', 'conceptual', 'behavioral'
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
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_hidden_tests ENABLE ROW LEVEL SECURITY;
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

DROP POLICY IF EXISTS "Authorized participants can delete interview questions" ON public.interview_questions;
CREATE POLICY "Authorized participants can delete interview questions" ON public.interview_questions
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.interviews i
            WHERE i.id = interview_id AND i.interviewer_id = auth.uid()
        )
    );

-- --------------------------------------------------------------------
-- D1. GLOBAL QUESTIONS POLICIES (QUESTION BANK)
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view question bank" ON public.questions;
CREATE POLICY "Authenticated users can view question bank" ON public.questions
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Interviewers can create questions" ON public.questions;
CREATE POLICY "Interviewers can create questions" ON public.questions
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = created_by 
        AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'interviewer')
    );

DROP POLICY IF EXISTS "Creators can update questions" ON public.questions;
CREATE POLICY "Creators can update questions" ON public.questions
    FOR UPDATE TO authenticated
    USING (auth.uid() = created_by)
    WITH CHECK (auth.uid() = created_by);

-- --------------------------------------------------------------------
-- D2. QUESTION HIDDEN TESTS POLICIES (ISOLATED EXECUTION DATA)
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Interviewers and service role can view hidden tests" ON public.question_hidden_tests;
CREATE POLICY "Interviewers and service role can view hidden tests" ON public.question_hidden_tests
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.questions q
            JOIN public.profiles p ON p.id = auth.uid()
            WHERE q.id = question_id AND (q.created_by = auth.uid() OR p.role = 'interviewer')
        )
    );

DROP POLICY IF EXISTS "Interviewers can insert hidden tests" ON public.question_hidden_tests;
CREATE POLICY "Interviewers can insert hidden tests" ON public.question_hidden_tests
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.questions q
            WHERE q.id = question_id AND q.created_by = auth.uid()
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

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'questions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.questions;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'interview_questions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.interview_questions;
    END IF;
END $$;

-- ====================================================================
-- 16. SEED INITIAL CODING QUESTIONS (LEETCODE-STYLE PROBLEM BANK)
-- ====================================================================
DO $$
DECLARE
    v_q1_id UUID := 'a1000000-0000-0000-0000-000000000001';
    v_q2_id UUID := 'a1000000-0000-0000-0000-000000000002';
    v_q3_id UUID := 'a1000000-0000-0000-0000-000000000003';
    v_q4_id UUID := 'a1000000-0000-0000-0000-000000000004';
    v_q5_id UUID := 'a1000000-0000-0000-0000-000000000005';
BEGIN
    -- Question 1: Two Sum
    INSERT INTO public.questions (
        id, title, description, difficulty, topic, input_description, output_description, constraints,
        examples, starter_code, test_cases
    ) VALUES (
        v_q1_id,
        'Two Sum',
        'Given an array of integers nums and an integer target, return the indices of the two numbers such that they add up to target.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice. You can return the answer in any order.',
        'Easy',
        'Arrays & Hashing',
        'First line contains integers separated by spaces representing array nums. Second line contains target integer.',
        'Output two space-separated indices representing the answer.',
        '2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9\nOnly one valid answer exists.',
        '[{"input": "2 7 11 15\n9", "output": "0 1", "explanation": "nums[0] + nums[1] == 9, so we return 0 1."}, {"input": "3 2 4\n6", "output": "1 2", "explanation": "nums[1] + nums[2] == 6, so we return 1 2."}]'::jsonb,
        '{"python": "import sys\n\ndef two_sum(nums, target):\n    # Write your solution here\n    seen = {}\n    for i, num in enumerate(nums):\n        diff = target - num\n        if diff in seen:\n            return [seen[diff], i]\n        seen[num] = i\n    return []\n\nif __name__ == \"__main__\":\n    lines = [line.strip() for line in sys.stdin if line.strip()]\n    if len(lines) >= 2:\n        nums = list(map(int, lines[0].split()))\n        target = int(lines[1])\n        result = two_sum(nums, target)\n        print(\" \".join(map(str, sorted(result))))\n", "cpp": "#include <iostream>\n#include <vector>\n#include <unordered_map>\n#include <sstream>\n\nusing namespace std;\n\nint main() {\n    string line;\n    if (getline(cin, line)) {\n        stringstream ss(line);\n        vector<int> nums;\n        int n, target;\n        while (ss >> n) nums.push_back(n);\n        if (cin >> target) {\n            unordered_map<int, int> seen;\n            for (int i = 0; i < nums.size(); ++i) {\n                int diff = target - nums[i];\n                if (seen.count(diff)) {\n                    cout << seen[diff] << \" \" << i << endl;\n                    return 0;\n                }\n                seen[nums[i]] = i;\n            }\n        }\n    }\n    return 0;\n}\n", "java": "import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (!sc.hasNextLine()) return;\n        String[] parts = sc.nextLine().trim().split(\"\\\\s+\");\n        int[] nums = new int[parts.length];\n        for (int i = 0; i < parts.length; i++) nums[i] = Integer.parseInt(parts[i]);\n        if (!sc.hasNextInt()) return;\n        int target = sc.nextInt();\n        \n        Map<Integer, Integer> map = new HashMap<>();\n        for (int i = 0; i < nums.length; i++) {\n            int diff = target - nums[i];\n            if (map.containsKey(diff)) {\n                System.out.println(map.get(diff) + \" \" + i);\n                return;\n            }\n            map.put(nums[i], i);\n        }\n    }\n}\n"}'::jsonb,
        '[{"input": "2 7 11 15\n9", "expectedOutput": "0 1"}, {"input": "3 2 4\n6", "expectedOutput": "1 2"}]'::jsonb
    ) ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        difficulty = EXCLUDED.difficulty,
        topic = EXCLUDED.topic,
        starter_code = EXCLUDED.starter_code,
        test_cases = EXCLUDED.test_cases;

    -- Hidden test cases for Two Sum
    INSERT INTO public.question_hidden_tests (question_id, hidden_test_cases)
    VALUES (
        v_q1_id,
        '[{"input": "3 3\n6", "expectedOutput": "0 1"}, {"input": "1 5 3 7 9\n12", "expectedOutput": "1 3"}]'::jsonb
    ) ON CONFLICT (question_id) DO UPDATE SET hidden_test_cases = EXCLUDED.hidden_test_cases;

    -- Question 2: Valid Parentheses
    INSERT INTO public.questions (
        id, title, description, difficulty, topic, input_description, output_description, constraints,
        examples, starter_code, test_cases
    ) VALUES (
        v_q2_id,
        'Valid Parentheses',
        'Given a string s containing just the characters ''('', '')'', ''{'', ''}'', ''['' and '']'', determine if the input string is valid.\n\nAn input string is valid if:\n1. Open brackets must be closed by the same type of brackets.\n2. Open brackets must be closed in the correct order.\n3. Every close bracket has a corresponding open bracket of the same type.',
        'Easy',
        'Stacks & Strings',
        'Single line containing string s.',
        'Print true if string is valid, otherwise false.',
        '1 <= s.length <= 10^4\ns consists of parentheses only: ''()[]{}''.',
        '[{"input": "()", "output": "true", "explanation": "Single pair of matching parentheses."}, {"input": "()[]{}", "output": "true", "explanation": "All pairs matched in order."}, {"input": "(]", "output": "false", "explanation": "Mismatched bracket types."}]'::jsonb,
        '{"python": "import sys\n\ndef is_valid(s):\n    stack = []\n    mapping = {\")\": \"(\", \"}\": \"{\", \"]\": \"[\"}\n    for char in s:\n        if char in mapping:\n            top = stack.pop() if stack else \"#\"\n            if mapping[char] != top:\n                return False\n        else:\n            stack.append(char)\n    return not stack\n\nif __name__ == \"__main__\":\n    s = sys.stdin.read().strip()\n    print(\"true\" if is_valid(s) else \"false\")\n", "cpp": "#include <iostream>\n#include <stack>\n#include <string>\n\nusing namespace std;\n\nbool isValid(string s) {\n    stack<char> st;\n    for (char c : s) {\n        if (c == ''('' || c == ''{'' || c == ''['') st.push(c);\n        else {\n            if (st.empty()) return false;\n            if (c == '')'' && st.top() != ''('') return false;\n            if (c == ''}'' && st.top() != ''{'') return false;\n            if (c == '']'' && st.top() != ''['') return false;\n            st.pop();\n        }\n    }\n    return st.empty();\n}\n\nint main() {\n    string s;\n    if (cin >> s) {\n        cout << (isValid(s) ? \"true\" : \"false\") << endl;\n    }\n    return 0;\n}\n", "java": "import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (!sc.hasNext()) return;\n        String s = sc.next();\n        Stack<Character> st = new Stack<>();\n        boolean valid = true;\n        for (char c : s.toCharArray()) {\n            if (c == ''('' || c == ''{'' || c == ''['') st.push(c);\n            else {\n                if (st.isEmpty()) { valid = false; break; }\n                char top = st.pop();\n                if (c == '')'' && top != ''('') { valid = false; break; }\n                if (c == ''}'' && top != ''{'' ) { valid = false; break; }\n                if (c == '']'' && top != ''['') { valid = false; break; }\n            }\n        }\n        if (!st.isEmpty()) valid = false;\n        System.out.println(valid ? \"true\" : \"false\");\n    }\n}\n"}'::jsonb,
        '[{"input": "()", "expectedOutput": "true"}, {"input": "()[]{}", "expectedOutput": "true"}, {"input": "(]", "expectedOutput": "false"}]'::jsonb
    ) ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        difficulty = EXCLUDED.difficulty,
        topic = EXCLUDED.topic,
        starter_code = EXCLUDED.starter_code,
        test_cases = EXCLUDED.test_cases;

    -- Hidden test cases for Valid Parentheses
    INSERT INTO public.question_hidden_tests (question_id, hidden_test_cases)
    VALUES (
        v_q2_id,
        '[{"input": "{[]}", "expectedOutput": "true"}, {"input": "([)]", "expectedOutput": "false"}]'::jsonb
    ) ON CONFLICT (question_id) DO UPDATE SET hidden_test_cases = EXCLUDED.hidden_test_cases;

    -- Question 3: Binary Search
    INSERT INTO public.questions (
        id, title, description, difficulty, topic, input_description, output_description, constraints,
        examples, starter_code, test_cases
    ) VALUES (
        v_q3_id,
        'Binary Search',
        'Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums. If target exists, then return its index. Otherwise, return -1.\n\nYou must write an algorithm with O(log n) runtime complexity.',
        'Easy',
        'Binary Search',
        'First line contains sorted integers separated by space. Second line contains target integer.',
        'Output target index if present, or -1.',
        '1 <= nums.length <= 10^4\n-10^4 < nums[i], target < 10^4\nAll the integers in nums are unique.\nnums is sorted in ascending order.',
        '[{"input": "-1 0 3 5 9 12\n9", "output": "4", "explanation": "9 exists in nums and its index is 4."}, {"input": "-1 0 3 5 9 12\n2", "output": "-1", "explanation": "2 does not exist in nums so return -1."}]'::jsonb,
        '{"python": "import sys\n\ndef search(nums, target):\n    left, right = 0, len(nums) - 1\n    while left <= right:\n        mid = (left + right) // 2\n        if nums[mid] == target:\n            return mid\n        elif nums[mid] < target:\n            left = mid + 1\n        else:\n            right = mid - 1\n    return -1\n\nif __name__ == \"__main__\":\n    lines = [l.strip() for l in sys.stdin if l.strip()]\n    if len(lines) >= 2:\n        nums = list(map(int, lines[0].split()))\n        target = int(lines[1])\n        print(search(nums, target))\n", "cpp": "#include <iostream>\n#include <vector>\n#include <sstream>\n\nusing namespace std;\n\nint main() {\n    string line;\n    if (getline(cin, line)) {\n        stringstream ss(line);\n        vector<int> nums;\n        int n, target;\n        while (ss >> n) nums.push_back(n);\n        if (cin >> target) {\n            int l = 0, r = nums.size() - 1, ans = -1;\n            while (l <= r) {\n                int mid = l + (r - l) / 2;\n                if (nums[mid] == target) { ans = mid; break; }\n                else if (nums[mid] < target) l = mid + 1;\n                else r = mid - 1;\n            }\n            cout << ans << endl;\n        }\n    }\n    return 0;\n}\n", "java": "import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (!sc.hasNextLine()) return;\n        String[] parts = sc.nextLine().trim().split(\"\\\\s+\");\n        int[] nums = new int[parts.length];\n        for (int i = 0; i < parts.length; i++) nums[i] = Integer.parseInt(parts[i]);\n        if (!sc.hasNextInt()) return;\n        int target = sc.nextInt();\n        \n        int l = 0, r = nums.length - 1, ans = -1;\n        while (l <= r) {\n            int mid = l + (r - l) / 2;\n            if (nums[mid] == target) { ans = mid; break; }\n            else if (nums[mid] < target) l = mid + 1;\n            else r = mid - 1;\n        }\n        System.out.println(ans);\n    }\n}\n"}'::jsonb,
        '[{"input": "-1 0 3 5 9 12\n9", "expectedOutput": "4"}, {"input": "-1 0 3 5 9 12\n2", "expectedOutput": "-1"}]'::jsonb
    ) ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        difficulty = EXCLUDED.difficulty,
        topic = EXCLUDED.topic,
        starter_code = EXCLUDED.starter_code,
        test_cases = EXCLUDED.test_cases;

    -- Hidden test cases for Binary Search
    INSERT INTO public.question_hidden_tests (question_id, hidden_test_cases)
    VALUES (
        v_q3_id,
        '[{"input": "5\n5", "expectedOutput": "0"}, {"input": "1 3 5 7 9 11\n11", "expectedOutput": "5"}]'::jsonb
    ) ON CONFLICT (question_id) DO UPDATE SET hidden_test_cases = EXCLUDED.hidden_test_cases;

    -- Question 4: Maximum Subarray
    INSERT INTO public.questions (
        id, title, description, difficulty, topic, input_description, output_description, constraints,
        examples, starter_code, test_cases
    ) VALUES (
        v_q4_id,
        'Maximum Subarray (Kadane''s Algorithm)',
        'Given an integer array nums, find the subarray with the largest sum, and return its sum.',
        'Medium',
        'Dynamic Programming',
        'Single line of integers separated by space representing nums.',
        'Print the largest subarray sum.',
        '1 <= nums.length <= 10^5\n-10^4 <= nums[i] <= 10^4',
        '[{"input": "-2 1 -3 4 -1 2 1 -5 4", "output": "6", "explanation": "The subarray [4, -1, 2, 1] has the largest sum 6."}, {"input": "1", "output": "1", "explanation": "The subarray [1] has the largest sum 1."}, {"input": "5 4 -1 7 8", "output": "23", "explanation": "The subarray [5, 4, -1, 7, 8] has the largest sum 23."}]'::jsonb,
        '{"python": "import sys\n\ndef max_subarray(nums):\n    max_so_far = nums[0]\n    curr_max = nums[0]\n    for i in range(1, len(nums)):\n        curr_max = max(nums[i], curr_max + nums[i])\n        max_so_far = max(max_so_far, curr_max)\n    return max_so_far\n\nif __name__ == \"__main__\":\n    text = sys.stdin.read().strip()\n    if text:\n        nums = list(map(int, text.split()))\n        print(max_subarray(nums))\n", "cpp": "#include <iostream>\n#include <vector>\n#include <algorithm>\n\nusing namespace std;\n\nint main() {\n    vector<int> nums;\n    int val;\n    while (cin >> val) nums.push_back(val);\n    if (nums.empty()) return 0;\n    int max_so_far = nums[0], curr = nums[0];\n    for (size_t i = 1; i < nums.size(); ++i) {\n        curr = max(nums[i], curr + nums[i]);\n        max_so_far = max(max_so_far, curr);\n    }\n    cout << max_so_far << endl;\n    return 0;\n}\n", "java": "import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        List<Integer> list = new ArrayList<>();\n        while (sc.hasNextInt()) list.add(sc.nextInt());\n        if (list.isEmpty()) return;\n        int maxSoFar = list.get(0), curr = list.get(0);\n        for (int i = 1; i < list.size(); i++) {\n            curr = Math.max(list.get(i), curr + list.get(i));\n            maxSoFar = Math.max(maxSoFar, curr);\n        }\n        System.out.println(maxSoFar);\n    }\n}\n"}'::jsonb,
        '[{"input": "-2 1 -3 4 -1 2 1 -5 4", "expectedOutput": "6"}, {"input": "1", "expectedOutput": "1"}, {"input": "5 4 -1 7 8", "expectedOutput": "23"}]'::jsonb
    ) ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        difficulty = EXCLUDED.difficulty,
        topic = EXCLUDED.topic,
        starter_code = EXCLUDED.starter_code,
        test_cases = EXCLUDED.test_cases;

    -- Hidden test cases for Maximum Subarray
    INSERT INTO public.question_hidden_tests (question_id, hidden_test_cases)
    VALUES (
        v_q4_id,
        '[{"input": "-5 -2 -8 -1 -9", "expectedOutput": "-1"}, {"input": "10 20 -5 15", "expectedOutput": "40"}]'::jsonb
    ) ON CONFLICT (question_id) DO UPDATE SET hidden_test_cases = EXCLUDED.hidden_test_cases;

    -- Question 5: Reverse String / Palindrome Check
    INSERT INTO public.questions (
        id, title, description, difficulty, topic, input_description, output_description, constraints,
        examples, starter_code, test_cases
    ) VALUES (
        v_q5_id,
        'Valid Palindrome',
        'A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward. Alphanumeric characters include letters and numbers.\n\nGiven a string s, return true if it is a palindrome, or false otherwise.',
        'Easy',
        'Strings',
        'Single line of text string s.',
        'Print true if palindrome, otherwise false.',
        '1 <= s.length <= 2 * 10^5\ns consists only of printable ASCII characters.',
        '[{"input": "A man, a plan, a canal: Panama", "output": "true", "explanation": "\"amanaplanacanalpanama\" is a palindrome."}, {"input": "race a car", "output": "false", "explanation": "\"raceacar\" is not a palindrome."}]'::jsonb,
        '{"python": "import sys\n\ndef is_palindrome(s):\n    filtered = [c.lower() for c in s if c.isalnum()]\n    return filtered == filtered[::-1]\n\nif __name__ == \"__main__\":\n    text = sys.stdin.read().strip()\n    print(\"true\" if is_palindrome(text) else \"false\")\n", "cpp": "#include <iostream>\n#include <string>\n#include <cctype>\n\nusing namespace std;\n\nint main() {\n    string s, clean = \"\";\n    getline(cin, s);\n    for (char c : s) {\n        if (isalnum(c)) clean += tolower(c);\n    }\n    int l = 0, r = (int)clean.size() - 1;\n    bool ok = true;\n    while (l < r) {\n        if (clean[l] != clean[r]) { ok = false; break; }\n        l++; r--;\n    }\n    cout << (ok ? \"true\" : \"false\") << endl;\n    return 0;\n}\n", "java": "import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (!sc.hasNextLine()) return;\n        String s = sc.nextLine();\n        StringBuilder sb = new StringBuilder();\n        for (char c : s.toCharArray()) {\n            if (Character.isLetterOrDigit(c)) sb.append(Character.toLowerCase(c));\n        }\n        String clean = sb.toString();\n        String rev = sb.reverse().toString();\n        System.out.println(clean.equals(rev) ? \"true\" : \"false\");\n    }\n}\n"}'::jsonb,
        '[{"input": "A man, a plan, a canal: Panama", "expectedOutput": "true"}, {"input": "race a car", "expectedOutput": "false"}]'::jsonb
    ) ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        difficulty = EXCLUDED.difficulty,
        topic = EXCLUDED.topic,
        starter_code = EXCLUDED.starter_code,
        test_cases = EXCLUDED.test_cases;

    -- Hidden test cases for Valid Palindrome
    INSERT INTO public.question_hidden_tests (question_id, hidden_test_cases)
    VALUES (
        v_q5_id,
        '[{"input": " ", "expectedOutput": "true"}, {"input": "0P", "expectedOutput": "false"}]'::jsonb
    ) ON CONFLICT (question_id) DO UPDATE SET hidden_test_cases = EXCLUDED.hidden_test_cases;
END $$;
