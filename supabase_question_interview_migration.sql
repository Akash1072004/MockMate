-- ====================================================================
-- MOCKMATE IDEMPOTENT MIGRATION: QUESTION & INTERVIEW SYSTEM
-- File: supabase_question_interview_migration.sql
-- 
-- PURPOSE:
-- Safely applies ONLY the new database tables, columns, indexes, 
-- RLS policies, security triggers, RPCs, realtime publications, and seed problems 
-- required for the Coding Question & Live Interview system.
--
-- TARGET ENVIRONMENT:
-- Supabase project where the base supabase_schema.sql (profiles,
-- interview_requests, interviews, reviews, security RPCs) has 
-- ALREADY been executed.
--
-- ZERO DESTRUCTIVE OPERATIONS:
-- - NO DROP TABLE
-- - NO DROP VIEW
-- - NO DROP FUNCTION
-- - NO DROP TRIGGER
-- - NO DROP POLICY (policies created via idempotent pg_policies checks)
-- - NO "SELECT ... INTO <var>" patterns (prevents false-positive table warnings)
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. NEW TABLE: QUESTION BANK (public.questions)
-- --------------------------------------------------------------------
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

-- Explicitly enable Row Level Security immediately after creation
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- 2. NEW TABLE: QUESTION HIDDEN TESTS (public.question_hidden_tests)
-- Isolated execution data for server-side evaluation.
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.question_hidden_tests (
    question_id UUID PRIMARY KEY REFERENCES public.questions(id) ON DELETE CASCADE,
    hidden_test_cases JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of { input: string, expectedOutput: string }
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Explicitly enable Row Level Security immediately after creation
ALTER TABLE public.question_hidden_tests ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- 3. ALTER TABLE: public.interviews
-- Add active_question_id for real-time synchronization between participants.
-- --------------------------------------------------------------------
ALTER TABLE public.interviews 
    ADD COLUMN IF NOT EXISTS active_question_id UUID;

DO $$ BEGIN
    ALTER TABLE public.interviews 
        ADD CONSTRAINT fk_interview_active_question FOREIGN KEY (active_question_id) 
        REFERENCES public.questions(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- --------------------------------------------------------------------
-- 4. ALTER TABLE: public.interview_questions
-- Add question_id reference and problem snapshot metadata columns.
-- --------------------------------------------------------------------
ALTER TABLE public.interview_questions 
    ADD COLUMN IF NOT EXISTS question_id UUID,
    ADD COLUMN IF NOT EXISTS title TEXT,
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS difficulty TEXT,
    ADD COLUMN IF NOT EXISTS topic TEXT,
    ADD COLUMN IF NOT EXISTS input_description TEXT,
    ADD COLUMN IF NOT EXISTS output_description TEXT,
    ADD COLUMN IF NOT EXISTS constraints TEXT,
    ADD COLUMN IF NOT EXISTS examples JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS starter_code JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS test_cases JSONB DEFAULT '[]'::jsonb;

DO $$ BEGIN
    ALTER TABLE public.interview_questions 
        ADD CONSTRAINT fk_interview_questions_question FOREIGN KEY (question_id) 
        REFERENCES public.questions(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Explicitly enable Row Level Security on interview_questions
ALTER TABLE public.interview_questions ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- 5. INDEXES FOR PERFORMANCE
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON public.questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON public.questions(topic);
CREATE INDEX IF NOT EXISTS idx_interviews_active_question ON public.interviews(active_question_id);
CREATE INDEX IF NOT EXISTS idx_interview_questions_interview ON public.interview_questions(interview_id);
CREATE INDEX IF NOT EXISTS idx_interview_questions_question ON public.interview_questions(question_id);

-- --------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES (SAFE IDEMPOTENT CREATION)
-- Uses pg_policies check to eliminate destructive DROP POLICY statements.
-- --------------------------------------------------------------------

-- D1. Global Questions Policies (Question Bank)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'questions' AND policyname = 'Authenticated users can view question bank'
    ) THEN
        CREATE POLICY "Authenticated users can view question bank" ON public.questions
            FOR SELECT TO authenticated
            USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'questions' AND policyname = 'Interviewers can create questions'
    ) THEN
        CREATE POLICY "Interviewers can create questions" ON public.questions
            FOR INSERT TO authenticated
            WITH CHECK (
                auth.uid() = created_by 
                AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'interviewer')
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'questions' AND policyname = 'Creators can update questions'
    ) THEN
        CREATE POLICY "Creators can update questions" ON public.questions
            FOR UPDATE TO authenticated
            USING (auth.uid() = created_by)
            WITH CHECK (auth.uid() = created_by);
    END IF;
END $$;

-- D2. Question Hidden Tests Policies (STRICT ISOLATION)
-- Candidates CANNOT query hidden test cases directly.
-- Only interviewers / creator or backend service_role can access.
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'question_hidden_tests' AND policyname = 'Interviewers and service role can view hidden tests'
    ) THEN
        CREATE POLICY "Interviewers and service role can view hidden tests" ON public.question_hidden_tests
            FOR SELECT TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.questions q
                    JOIN public.profiles p ON p.id = auth.uid()
                    WHERE q.id = question_id AND (q.created_by = auth.uid() OR p.role = 'interviewer')
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'question_hidden_tests' AND policyname = 'Interviewers can insert hidden tests'
    ) THEN
        CREATE POLICY "Interviewers can insert hidden tests" ON public.question_hidden_tests
            FOR INSERT TO authenticated
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.questions q
                    WHERE q.id = question_id AND q.created_by = auth.uid()
                )
            );
    END IF;
END $$;

-- D3. Interview Questions Policies
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'interview_questions' AND policyname = 'Participants can view interview questions'
    ) THEN
        CREATE POLICY "Participants can view interview questions" ON public.interview_questions
            FOR SELECT TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.interviews i
                    WHERE i.id = interview_id AND (i.candidate_id = auth.uid() OR i.interviewer_id = auth.uid())
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'interview_questions' AND policyname = 'Authorized backend or creator can insert questions'
    ) THEN
        CREATE POLICY "Authorized backend or creator can insert questions" ON public.interview_questions
            FOR INSERT TO authenticated
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.interviews i
                    WHERE i.id = interview_id AND (i.candidate_id = auth.uid() OR i.interviewer_id = auth.uid())
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'interview_questions' AND policyname = 'Authorized participants can delete interview questions'
    ) THEN
        CREATE POLICY "Authorized participants can delete interview questions" ON public.interview_questions
            FOR DELETE TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.interviews i
                    WHERE i.id = interview_id AND i.interviewer_id = auth.uid()
                )
            );
    END IF;
END $$;

-- --------------------------------------------------------------------
-- 7. SECURITY TRIGGER: PREVENT CANDIDATE ARBITRARY ACTIVE_QUESTION_ID MODIFICATION
-- Enforces that candidates cannot change active_question_id via direct table UPDATE.
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_interview_field_security()
RETURNS trigger AS $$
BEGIN
    -- Only the assigned interviewer (or service_role) can change the active question
    IF NEW.active_question_id IS DISTINCT FROM OLD.active_question_id THEN
        IF auth.role() != 'service_role' AND auth.uid() != OLD.interviewer_id THEN
            RAISE EXCEPTION 'Security violation: Only the assigned interviewer can change the active question.';
        END IF;
    END IF;

    -- Participants cannot modify immutable ownership
    IF NEW.candidate_id != OLD.candidate_id OR NEW.interviewer_id IS DISTINCT FROM OLD.interviewer_id THEN
        IF auth.role() != 'service_role' THEN
            RAISE EXCEPTION 'Security violation: Interview participants cannot be modified.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trg_enforce_interview_field_security'
    ) THEN
        CREATE TRIGGER trg_enforce_interview_field_security
            BEFORE UPDATE ON public.interviews
            FOR EACH ROW
            EXECUTE FUNCTION public.enforce_interview_field_security();
    END IF;
END $$;

-- --------------------------------------------------------------------
-- 8. SECURE RPC: SET ACTIVE INTERVIEW QUESTION
-- Rewritten using scalar assignments to avoid false-positive "SELECT ... INTO" table creation warnings.
-- Validates authentication, interviewer identity, interview status, and question validity.
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_active_interview_question(
    p_interview_id UUID, 
    p_question_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_interviewer_id UUID;
    v_status public.interview_status;
    v_is_ai BOOLEAN;
    v_question_exists BOOLEAN;
BEGIN
    -- Verify caller is authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    -- Query interview metadata using scalar assignment (no SELECT * INTO table_name)
    v_interviewer_id := (SELECT i.interviewer_id FROM public.interviews i WHERE i.id = p_interview_id);
    v_status := (SELECT i.status FROM public.interviews i WHERE i.id = p_interview_id);
    v_is_ai := (SELECT i.is_ai FROM public.interviews i WHERE i.id = p_interview_id);

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Interview session not found.';
    END IF;

    -- Enforce that only the assigned interviewer (or service_role) can switch active questions
    IF auth.role() != 'service_role' AND auth.uid() != v_interviewer_id THEN
        RAISE EXCEPTION 'Unauthorized: Only the assigned interviewer can change the active question.';
    END IF;

    -- Enforce active/waiting status
    IF v_status NOT IN ('waiting', 'active') THEN
        RAISE EXCEPTION 'Active question cannot be changed in % status.', v_status;
    END IF;

    -- Verify question exists either in interview_questions or in public.questions
    v_question_exists := EXISTS (
        SELECT 1 FROM public.interview_questions iq
        WHERE iq.interview_id = p_interview_id 
          AND (iq.question_id = p_question_id OR iq.id = p_question_id)
    ) OR EXISTS (
        SELECT 1 FROM public.questions q
        WHERE q.id = p_question_id
    );

    IF NOT v_question_exists THEN
        RAISE EXCEPTION 'Question is not valid or associated with this interview.';
    END IF;

    -- Atomically update interviews.active_question_id
    UPDATE public.interviews
    SET active_question_id = p_question_id,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_interview_id;

    RETURN jsonb_build_object(
        'success', true, 
        'interview_id', p_interview_id,
        'active_question_id', p_question_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.set_active_interview_question(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_active_interview_question(UUID, UUID) TO authenticated;

-- --------------------------------------------------------------------
-- 9. REALTIME PUBLICATION ADDITIONS (IDEMPOTENT)
-- --------------------------------------------------------------------
DO $$ 
BEGIN
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

-- --------------------------------------------------------------------
-- 10. SEED INITIAL CODING QUESTIONS (IDEMPOTENT VIA ON CONFLICT)
-- --------------------------------------------------------------------
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
        '{"python": "import sys\n\ndef two_sum(nums, target):\n    # Write your solution here\n    seen = {}\n    for i, num in enumerate(nums):\n        diff = target - num\n        if diff in seen:\n            return [seen[diff], i]\n        seen[num] = i\n    return []\n\nif __name__ == \"__main__\":\n    lines = [line.strip() for line in sys.stdin if line.strip()]\n    if len(lines) >= 2:\n        nums = list(map(int, lines[0].split()))\n        target = int(lines[1])\n        result = two_sum(nums, target)\n        print(\" \".join(map(str, sorted(result))))\n", "cpp": "#include <iostream>\n#include <vector>\n#include <unordered_map>\n#include <sstream>\n\nusing namespace std;\n\nint main() {\n    string line;\n    if (getline(cin, line)) {\n        stringstream ss(line);\n        vector<int> nums;\n        int n, target;\n        while (ss >> n) nums.push_back(n);\n        if (cin >> target) {\n            unordered_map<int, int> seen;\n            for (size_t i = 0; i < nums.size(); ++i) {\n                int diff = target - nums[i];\n                if (seen.count(diff)) {\n                    cout << seen[diff] << \" \" << i << endl;\n                    return 0;\n                }\n                seen[nums[i]] = i;\n            }\n        }\n    }\n    return 0;\n}\n", "java": "import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (!sc.hasNextLine()) return;\n        String[] parts = sc.nextLine().trim().split(\"\\\\s+\");\n        int[] nums = new int[parts.length];\n        for (int i = 0; i < parts.length; i++) nums[i] = Integer.parseInt(parts[i]);\n        if (!sc.hasNextInt()) return;\n        int target = sc.nextInt();\n        \n        Map<Integer, Integer> map = new HashMap<>();\n        for (int i = 0; i < nums.length; i++) {\n            int diff = target - nums[i];\n            if (map.containsKey(diff)) {\n                System.out.println(map.get(diff) + \" \" + i);\n                return;\n            }\n            map.put(nums[i], i);\n        }\n    }\n}\n"}'::jsonb,
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
