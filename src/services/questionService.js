import { supabase, isSupabaseConfigured } from '../lib/supabase';

// High quality fallback questions if Supabase is offline or table is empty
export const DEFAULT_SEED_QUESTIONS = [
  {
    id: 'a1000000-0000-0000-0000-000000000001',
    title: 'Two Sum',
    difficulty: 'Easy',
    topic: 'Arrays & Hashing',
    description: 'Given an array of integers nums and an integer target, return the indices of the two numbers such that they add up to target.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice. You can return the answer in any order.',
    input_description: 'First line contains integers separated by spaces representing array nums. Second line contains target integer.',
    output_description: 'Output two space-separated indices representing the answer.',
    constraints: '2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9\nOnly one valid answer exists.',
    examples: [
      { input: '2 7 11 15\n9', output: '0 1', explanation: 'nums[0] + nums[1] == 9, so we return 0 1.' },
      { input: '3 2 4\n6', output: '1 2', explanation: 'nums[1] + nums[2] == 6, so we return 1 2.' }
    ],
    starter_code: {
      python: `import sys\n\ndef two_sum(nums, target):\n    # Write your solution here\n    seen = {}\n    for i, num in enumerate(nums):\n        diff = target - num\n        if diff in seen:\n            return [seen[diff], i]\n        seen[num] = i\n    return []\n\nif __name__ == "__main__":\n    lines = [line.strip() for line in sys.stdin if line.strip()]\n    if len(lines) >= 2:\n        nums = list(map(int, lines[0].split()))\n        target = int(lines[1])\n        result = two_sum(nums, target)\n        print(" ".join(map(str, sorted(result))))\n`,
      cpp: `#include <iostream>\n#include <vector>\n#include <unordered_map>\n#include <sstream>\n\nusing namespace std;\n\nint main() {\n    string line;\n    if (getline(cin, line)) {\n        stringstream ss(line);\n        vector<int> nums;\n        int n, target;\n        while (ss >> n) nums.push_back(n);\n        if (cin >> target) {\n            unordered_map<int, int> seen;\n            for (size_t i = 0; i < nums.size(); ++i) {\n                int diff = target - nums[i];\n                if (seen.count(diff)) {\n                    cout << seen[diff] << " " << i << endl;\n                    return 0;\n                }\n                seen[nums[i]] = i;\n            }\n        }\n    }\n    return 0;\n}\n`,
      java: `import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (!sc.hasNextLine()) return;\n        String[] parts = sc.nextLine().trim().split("\\\\s+");\n        int[] nums = new int[parts.length];\n        for (int i = 0; i < parts.length; i++) nums[i] = Integer.parseInt(parts[i]);\n        if (!sc.hasNextInt()) return;\n        int target = sc.nextInt();\n        \n        Map<Integer, Integer> map = new HashMap<>();\n        for (int i = 0; i < nums.length; i++) {\n            int diff = target - nums[i];\n            if (map.containsKey(diff)) {\n                System.out.println(map.get(diff) + " " + i);\n                return;\n            }\n            map.put(nums[i], i);\n        }\n    }\n}\n`
    },
    test_cases: [
      { input: '2 7 11 15\n9', expectedOutput: '0 1' },
      { input: '3 2 4\n6', expectedOutput: '1 2' }
    ]
  },
  {
    id: 'a1000000-0000-0000-0000-000000000002',
    title: 'Valid Parentheses',
    difficulty: 'Easy',
    topic: 'Stacks & Strings',
    description: 'Given a string s containing just the characters \'(\', \')\', \'{\', \'}\', \'[\' and \']\', determine if the input string is valid.\n\nAn input string is valid if:\n1. Open brackets must be closed by the same type of brackets.\n2. Open brackets must be closed in the correct order.\n3. Every close bracket has a corresponding open bracket of the same type.',
    input_description: 'Single line containing string s.',
    output_description: 'Print true if string is valid, otherwise false.',
    constraints: '1 <= s.length <= 10^4\ns consists of parentheses only: \'()[]{}\'.',
    examples: [
      { input: '()', output: 'true', explanation: 'Single matching pair.' },
      { input: '()[]{}', output: 'true', explanation: 'All pairs matched in order.' },
      { input: '(]', output: 'false', explanation: 'Mismatched brackets.' }
    ],
    starter_code: {
      python: `import sys\n\ndef is_valid(s):\n    stack = []\n    mapping = {")": "(", "}": "{", "]": "["}\n    for char in s:\n        if char in mapping:\n            top = stack.pop() if stack else "#"\n            if mapping[char] != top:\n                return False\n        else:\n            stack.append(char)\n    return not stack\n\nif __name__ == "__main__":\n    s = sys.stdin.read().strip()\n    print("true" if is_valid(s) else "false")\n`,
      cpp: `#include <iostream>\n#include <stack>\n#include <string>\n\nusing namespace std;\n\nbool isValid(string s) {\n    stack<char> st;\n    for (char c : s) {\n        if (c == '(' || c == '{' || c == '[') st.push(c);\n        else {\n            if (st.empty()) return false;\n            if (c == ')' && st.top() != '(') return false;\n            if (c == '}' && st.top() != '{') return false;\n            if (c == ']' && st.top() != '[') return false;\n            st.pop();\n        }\n    }\n    return st.empty();\n}\n\nint main() {\n    string s;\n    if (cin >> s) {\n        cout << (isValid(s) ? "true" : "false") << endl;\n    }\n    return 0;\n}\n`,
      java: `import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (!sc.hasNext()) return;\n        String s = sc.next();\n        Stack<Character> st = new Stack<>();\n        boolean valid = true;\n        for (char c : s.toCharArray()) {\n            if (c == '(' || c == '{' || c == '[') st.push(c);\n            else {\n                if (st.isEmpty()) { valid = false; break; }\n                char top = st.pop();\n                if (c == ')' && top != '(') { valid = false; break; }\n                if (c == '}' && top != '{') { valid = false; break; }\n                if (c == ']') && top != '[') { valid = false; break; }\n            }\n        }\n        if (!st.isEmpty()) valid = false;\n        System.out.println(valid ? "true" : "false");\n    }\n}\n`
    },
    test_cases: [
      { input: '()', expectedOutput: 'true' },
      { input: '()[]{}', expectedOutput: 'true' },
      { input: '(]', expectedOutput: 'false' }
    ]
  },
  {
    id: 'a1000000-0000-0000-0000-000000000003',
    title: 'Binary Search',
    difficulty: 'Easy',
    topic: 'Binary Search',
    description: 'Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums. If target exists, then return its index. Otherwise, return -1.\n\nYou must write an algorithm with O(log n) runtime complexity.',
    input_description: 'First line contains sorted integers separated by space. Second line contains target integer.',
    output_description: 'Output target index if present, or -1.',
    constraints: '1 <= nums.length <= 10^4\n-10^4 < nums[i], target < 10^4\nAll integers in nums are unique and sorted.',
    examples: [
      { input: '-1 0 3 5 9 12\n9', output: '4', explanation: '9 exists in nums and its index is 4.' },
      { input: '-1 0 3 5 9 12\n2', output: '-1', explanation: '2 does not exist in nums so return -1.' }
    ],
    starter_code: {
      python: `import sys\n\ndef search(nums, target):\n    left, right = 0, len(nums) - 1\n    while left <= right:\n        mid = (left + right) // 2\n        if nums[mid] == target:\n            return mid\n        elif nums[mid] < target:\n            left = mid + 1\n        else:\n            right = mid - 1\n    return -1\n\nif __name__ == "__main__":\n    lines = [l.strip() for l in sys.stdin if l.strip()]\n    if len(lines) >= 2:\n        nums = list(map(int, lines[0].split()))\n        target = int(lines[1])\n        print(search(nums, target))\n`,
      cpp: `#include <iostream>\n#include <vector>\n#include <sstream>\n\nusing namespace std;\n\nint main() {\n    string line;\n    if (getline(cin, line)) {\n        stringstream ss(line);\n        vector<int> nums;\n        int n, target;\n        while (ss >> n) nums.push_back(n);\n        if (cin >> target) {\n            int l = 0, r = nums.size() - 1, ans = -1;\n            while (l <= r) {\n                int mid = l + (r - l) / 2;\n                if (nums[mid] == target) { ans = mid; break; }\n                else if (nums[mid] < target) l = mid + 1;\n                else r = mid - 1;\n            }\n            cout << ans << endl;\n        }\n    }\n    return 0;\n}\n`,
      java: `import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (!sc.hasNextLine()) return;\n        String[] parts = sc.nextLine().trim().split("\\\\s+");\n        int[] nums = new int[parts.length];\n        for (int i = 0; i < parts.length; i++) nums[i] = Integer.parseInt(parts[i]);\n        if (!sc.hasNextInt()) return;\n        int target = sc.nextInt();\n        \n        int l = 0, r = nums.length - 1, ans = -1;\n        while (l <= r) {\n            int mid = l + (r - l) / 2;\n            if (nums[mid] == target) { ans = mid; break; }\n            else if (nums[mid] < target) l = mid + 1;\n            else r = mid - 1;\n        }\n        System.out.println(ans);\n    }\n}\n`
    },
    test_cases: [
      { input: '-1 0 3 5 9 12\n9', expectedOutput: '4' },
      { input: '-1 0 3 5 9 12\n2', expectedOutput: '-1' }
    ]
  },
  {
    id: 'a1000000-0000-0000-0000-000000000004',
    title: 'Maximum Subarray (Kadane\'s Algorithm)',
    difficulty: 'Medium',
    topic: 'Dynamic Programming',
    description: 'Given an integer array nums, find the subarray with the largest sum, and return its sum.',
    input_description: 'Single line of integers separated by space representing nums.',
    output_description: 'Print the largest subarray sum.',
    constraints: '1 <= nums.length <= 10^5\n-10^4 <= nums[i] <= 10^4',
    examples: [
      { input: '-2 1 -3 4 -1 2 1 -5 4', output: '6', explanation: 'The subarray [4, -1, 2, 1] has the largest sum 6.' },
      { input: '5 4 -1 7 8', output: '23', explanation: 'The subarray [5, 4, -1, 7, 8] has the largest sum 23.' }
    ],
    starter_code: {
      python: `import sys\n\ndef max_subarray(nums):\n    max_so_far = nums[0]\n    curr_max = nums[0]\n    for i in range(1, len(nums)):\n        curr_max = max(nums[i], curr_max + nums[i])\n        max_so_far = max(max_so_far, curr_max)\n    return max_so_far\n\nif __name__ == "__main__":\n    text = sys.stdin.read().strip()\n    if text:\n        nums = list(map(int, text.split()))\n        print(max_subarray(nums))\n`,
      cpp: `#include <iostream>\n#include <vector>\n#include <algorithm>\n\nusing namespace std;\n\nint main() {\n    vector<int> nums;\n    int val;\n    while (cin >> val) nums.push_back(val);\n    if (nums.empty()) return 0;\n    int max_so_far = nums[0], curr = nums[0];\n    for (size_t i = 1; i < nums.size(); ++i) {\n        curr = max(nums[i], curr + nums[i]);\n        max_so_far = max(max_so_far, curr);\n    }\n    cout << max_so_far << endl;\n    return 0;\n}\n`,
      java: `import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        List<Integer> list = new ArrayList<>();\n        while (sc.hasNextInt()) list.add(sc.nextInt());\n        if (list.isEmpty()) return;\n        int maxSoFar = list.get(0), curr = list.get(0);\n        for (int i = 1; i < list.size(); i++) {\n            curr = Math.max(list.get(i), curr + list.get(i));\n            maxSoFar = Math.max(maxSoFar, curr);\n        }\n        System.out.println(maxSoFar);\n    }\n}\n`
    },
    test_cases: [
      { input: '-2 1 -3 4 -1 2 1 -5 4', expectedOutput: '6' },
      { input: '5 4 -1 7 8', expectedOutput: '23' }
    ]
  },
  {
    id: 'a1000000-0000-0000-0000-000000000005',
    title: 'Valid Palindrome',
    difficulty: 'Easy',
    topic: 'Strings',
    description: 'A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward. Alphanumeric characters include letters and numbers.\n\nGiven a string s, return true if it is a palindrome, or false otherwise.',
    input_description: 'Single line of text string s.',
    output_description: 'Print true if palindrome, otherwise false.',
    constraints: '1 <= s.length <= 2 * 10^5\ns consists only of printable ASCII characters.',
    examples: [
      { input: 'A man, a plan, a canal: Panama', output: 'true', explanation: '"amanaplanacanalpanama" is a palindrome.' },
      { input: 'race a car', output: 'false', explanation: '"raceacar" is not a palindrome.' }
    ],
    starter_code: {
      python: `import sys\n\ndef is_palindrome(s):\n    filtered = [c.lower() for c in s if c.isalnum()]\n    return filtered == filtered[::-1]\n\nif __name__ == "__main__":\n    text = sys.stdin.read().strip()\n    print("true" if is_palindrome(text) else "false")\n`,
      cpp: `#include <iostream>\n#include <string>\n#include <cctype>\n\nusing namespace std;\n\nint main() {\n    string s, clean = "";\n    getline(cin, s);\n    for (char c : s) {\n        if (isalnum(c)) clean += tolower(c);\n    }\n    int l = 0, r = (int)clean.size() - 1;\n    bool ok = true;\n    while (l < r) {\n        if (clean[l] != clean[r]) { ok = false; break; }\n        l++; r--;\n    }\n    cout << (ok ? "true" : "false") << endl;\n    return 0;\n}\n`,
      java: `import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (!sc.hasNextLine()) return;\n        String s = sc.nextLine();\n        StringBuilder sb = new StringBuilder();\n        for (char c : s.toCharArray()) {\n            if (Character.isLetterOrDigit(c)) sb.append(Character.toLowerCase(c));\n        }\n        String clean = sb.toString();\n        String rev = sb.reverse().toString();\n        System.out.println(clean.equals(rev) ? "true" : "false");\n    }\n}\n`
    },
    test_cases: [
      { input: 'A man, a plan, a canal: Panama', expectedOutput: 'true' },
      { input: 'race a car', expectedOutput: 'false' }
    ]
  }
];

/**
 * Fetch questions with optional search, difficulty, and topic filters.
 */
export async function getQuestions({ difficulty = 'All', topic = 'All', search = '' } = {}) {
  if (!isSupabaseConfigured || !supabase) {
    return filterLocalQuestions(DEFAULT_SEED_QUESTIONS, { difficulty, topic, search });
  }

  try {
    let query = supabase
      .from('questions')
      .select(`
        id,
        title,
        description,
        difficulty,
        topic,
        input_description,
        output_description,
        constraints,
        examples,
        starter_code,
        supported_languages,
        test_cases,
        created_by,
        created_at
      `)
      .order('created_at', { ascending: false });

    if (difficulty && difficulty !== 'All') {
      query = query.eq('difficulty', difficulty);
    }

    if (topic && topic !== 'All') {
      query = query.ilike('topic', `%${topic}%`);
    }

    if (search && search.trim()) {
      query = query.ilike('title', `%${search.trim()}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('[questionService] Error fetching questions from Supabase, using defaults:', error.message);
      return filterLocalQuestions(DEFAULT_SEED_QUESTIONS, { difficulty, topic, search });
    }

    if (!data || data.length === 0) {
      return filterLocalQuestions(DEFAULT_SEED_QUESTIONS, { difficulty, topic, search });
    }

    return data.filter(q => q.is_archived !== true);
  } catch (err) {
    console.error('[questionService] getQuestions error:', err);
    return filterLocalQuestions(DEFAULT_SEED_QUESTIONS, { difficulty, topic, search });
  }
}

/**
 * Fetch a single question by its ID.
 */
export async function getQuestionById(questionId) {
  if (!questionId) return null;

  const localMatch = DEFAULT_SEED_QUESTIONS.find(q => q.id === questionId);

  if (!isSupabaseConfigured || !supabase) {
    return localMatch || null;
  }

  try {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('id', questionId)
      .maybeSingle();

    if (error || !data) {
      return localMatch || null;
    }

    return data;
  } catch (err) {
    console.error('[questionService] getQuestionById error:', err);
    return localMatch || null;
  }
}

/**
 * Create a new question and its hidden test cases in Supabase.
 */
export async function createQuestion({
  title,
  description,
  difficulty = 'Medium',
  topic = 'Algorithms',
  inputDescription = '',
  outputDescription = '',
  constraints = '',
  examples = [],
  starterCode = {},
  supportedLanguages = ['python', 'cpp', 'java'],
  testCases = [],
  hiddenTestCases = [],
  userId,
}) {
  if (!supabase) throw new Error('Supabase is not configured.');
  if (!title?.trim()) throw new Error('Title is required.');
  if (!description?.trim()) throw new Error('Description is required.');

  const questionPayload = {
    title: title.trim(),
    description: description.trim(),
    difficulty: difficulty || 'Medium',
    topic: topic?.trim() || 'Algorithms',
    input_description: inputDescription.trim() || null,
    output_description: outputDescription.trim() || null,
    constraints: constraints.trim() || null,
    examples: Array.isArray(examples) ? examples : [],
    starter_code: starterCode || {},
    supported_languages: supportedLanguages || ['python', 'cpp', 'java'],
    test_cases: Array.isArray(testCases) ? testCases : [],
    created_by: userId || null,
    created_at: new Date().toISOString(),
  };

  const { data: createdQuestion, error: qError } = await supabase
    .from('questions')
    .insert(questionPayload)
    .select()
    .single();

  if (qError) {
    console.error('[questionService] Error creating question:', qError);
    throw new Error(qError.message || 'Failed to create question.');
  }

  // Insert hidden test cases into isolated table
  if (Array.isArray(hiddenTestCases) && hiddenTestCases.length > 0 && createdQuestion?.id) {
    const { error: hiddenError } = await supabase
      .from('question_hidden_tests')
      .insert({
        question_id: createdQuestion.id,
        hidden_test_cases: hiddenTestCases,
      });

    if (hiddenError) {
      console.warn('[questionService] Warning saving hidden test cases:', hiddenError.message);
    }
  }

  return createdQuestion;
}

/**
 * Update an existing question and its hidden test cases.
 * Enforces creator authorization (created_by === userId).
 */
export async function updateQuestion(questionId, {
  title,
  description,
  difficulty = 'Medium',
  topic = 'Algorithms',
  inputDescription = '',
  outputDescription = '',
  constraints = '',
  examples = [],
  starterCode = {},
  supportedLanguages = ['python', 'cpp', 'java'],
  testCases = [],
  hiddenTestCases = [],
  userId,
}) {
  if (!supabase || !questionId) throw new Error('Question ID is required.');
  if (!title?.trim()) throw new Error('Title is required.');
  if (!description?.trim()) throw new Error('Description is required.');

  const updatePayload = {
    title: title.trim(),
    description: description.trim(),
    difficulty: difficulty || 'Medium',
    topic: topic?.trim() || 'Algorithms',
    input_description: inputDescription?.trim() || null,
    output_description: outputDescription?.trim() || null,
    constraints: constraints?.trim() || null,
    examples: Array.isArray(examples) ? examples : [],
    starter_code: starterCode || {},
    supported_languages: supportedLanguages || ['python', 'cpp', 'java'],
    test_cases: Array.isArray(testCases) ? testCases : [],
    updated_at: new Date().toISOString(),
  };

  let query = supabase
    .from('questions')
    .update(updatePayload)
    .eq('id', questionId);

  // If userId is provided, ensure creator check
  if (userId) {
    query = query.eq('created_by', userId);
  }

  const { data: updatedQuestion, error: updateError } = await query
    .select()
    .single();

  if (updateError) {
    console.error('[questionService] Error updating question:', updateError);
    throw new Error(updateError.message || 'Failed to update question.');
  }

  // Update hidden test cases if provided
  if (Array.isArray(hiddenTestCases) && hiddenTestCases.length > 0) {
    const { error: hiddenError } = await supabase
      .from('question_hidden_tests')
      .upsert({
        question_id: questionId,
        hidden_test_cases: hiddenTestCases,
      });

    if (hiddenError) {
      console.warn('[questionService] Warning saving hidden test cases:', hiddenError.message);
    }
  }

  return updatedQuestion;
}

/**
 * Delete / Archive a question.
 * Uses soft-deletion so historical interview records referencing this question are preserved.
 * Strictly verifies that only the creator or authorized interviewer can delete.
 */
export async function deleteQuestion(questionId, userId) {
  if (!supabase || !questionId) throw new Error('Question ID is required.');

  // 1. Try secure RPC delete_interviewer_question
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('delete_interviewer_question', {
      p_question_id: questionId,
    });
    if (!rpcError && rpcData?.success) {
      return { success: true };
    }
  } catch (rpcErr) {
    // Proceed to direct soft delete fallback
  }

  // 2. Direct scoped soft-delete enforcing created_by match
  let query = supabase
    .from('questions')
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq('id', questionId);

  if (userId) {
    query = query.eq('created_by', userId);
  }

  const { error } = await query;
  if (error) {
    console.error('[questionService] Error deleting question:', error);
    throw new Error(error.message || 'Failed to delete question.');
  }

  return { success: true };
}

/**
 * Fetch all questions attached to a specific interview session.
 */
export async function getInterviewQuestions(interviewId) {
  if (!interviewId || !supabase) return [];

  try {
    const { data, error } = await supabase
      .from('interview_questions')
      .select(`
        id,
        interview_id,
        question_id,
        question_order,
        question_text,
        title,
        description,
        difficulty,
        topic,
        input_description,
        output_description,
        constraints,
        examples,
        starter_code,
        test_cases,
        created_at,
        question:question_id (
          id,
          title,
          description,
          difficulty,
          topic,
          input_description,
          output_description,
          constraints,
          examples,
          starter_code,
          test_cases
        )
      `)
      .eq('interview_id', interviewId)
      .order('question_order', { ascending: true });

    if (error) {
      console.warn('[questionService] Error fetching interview questions:', error.message);
      return [];
    }

    // Normalize result objects
    return (data || []).map(row => {
      const q = row.question || {};
      return {
        id: row.id,
        interview_id: row.interview_id,
        question_id: row.question_id || q.id,
        question_order: row.question_order,
        title: row.title || q.title || row.question_text || 'Interview Problem',
        description: row.description || q.description || '',
        difficulty: row.difficulty || q.difficulty || 'Medium',
        topic: row.topic || q.topic || 'Algorithms',
        input_description: row.input_description || q.input_description || '',
        output_description: row.output_description || q.output_description || '',
        constraints: row.constraints || q.constraints || '',
        examples: row.examples?.length ? row.examples : (q.examples || []),
        starter_code: row.starter_code && Object.keys(row.starter_code).length ? row.starter_code : (q.starter_code || {}),
        test_cases: row.test_cases?.length ? row.test_cases : (q.test_cases || []),
      };
    });
  } catch (err) {
    console.error('[questionService] getInterviewQuestions error:', err);
    return [];
  }
}

/**
 * Attach a question to an interview session.
 */
export async function addQuestionToInterview(interviewId, question, order = 1) {
  if (!interviewId || !supabase || !question) throw new Error('Missing interview ID or question');

  const payload = {
    interview_id: interviewId,
    question_id: question.id || null,
    question_order: order,
    question_text: question.description || question.title || 'Coding Problem',
    title: question.title,
    description: question.description,
    difficulty: question.difficulty,
    topic: question.topic,
    input_description: question.input_description || null,
    output_description: question.output_description || null,
    constraints: question.constraints || null,
    examples: question.examples || [],
    starter_code: question.starter_code || {},
    test_cases: question.test_cases || [],
    question_type: 'coding',
  };

  const { data, error } = await supabase
    .from('interview_questions')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('[questionService] addQuestionToInterview error:', error);
    throw error;
  }

  return data;
}

/**
 * Remove an attached question from an interview session.
 */
export async function removeQuestionFromInterview(interviewQuestionId) {
  if (!interviewQuestionId || !supabase) return;

  const { error } = await supabase
    .from('interview_questions')
    .delete()
    .eq('id', interviewQuestionId);

  if (error) {
    console.error('[questionService] removeQuestionFromInterview error:', error);
    throw error;
  }
}

/**
 * Update the active question in the interview session table for realtime sync.
 */
export async function setActiveInterviewQuestion(interviewId, questionId) {
  if (!interviewId || !supabase) return;

  const { data, error } = await supabase.rpc('set_active_interview_question', {
    p_interview_id: interviewId,
    p_question_id: questionId,
  });

  if (error) {
    console.error('[questionService] setActiveInterviewQuestion RPC error:', error);
    throw error;
  }

  return data;
}


function filterLocalQuestions(list, { difficulty, topic, search }) {
  return list.filter(q => {
    if (difficulty && difficulty !== 'All' && q.difficulty !== difficulty) return false;
    if (topic && topic !== 'All' && !q.topic.toLowerCase().includes(topic.toLowerCase())) return false;
    if (search && search.trim() && !q.title.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });
}
