import { GoogleGenAI } from '@google/genai';

/**
 * Gemini Service for generating structured mock interview questions.
 * Uses official @google/genai SDK with gemini-2.5-flash.
 */

// Fallback questions dictionary by track and difficulty
const FALLBACK_QUESTIONS = {
  DSA: {
    Easy: [
      {
        questionOrder: 1,
        questionText: 'Two Sum: Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`. You may assume that each input would have exactly one solution, and you may not use the same element twice.',
        questionType: 'coding',
        hints: ['Consider using a Hash Map to store numbers and their indices in O(N) time.', 'Can you solve it in a single pass?'],
        expectedTopics: ['Hash Map', 'Arrays', 'Time Complexity O(N)'],
      },
      {
        questionOrder: 2,
        questionText: 'Valid Palindrome: A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward. Write a function to verify if a string is a valid palindrome.',
        questionType: 'coding',
        hints: ['Two pointers starting from left and right can compare valid characters.', 'Skip punctuation and whitespace.'],
        expectedTopics: ['Two Pointers', 'String Manipulation'],
      },
    ],
    Medium: [
      {
        questionOrder: 1,
        questionText: 'Longest Substring Without Repeating Characters: Given a string `s`, find the length of the longest substring without duplicate characters. Analyze both time and space complexity.',
        questionType: 'coding',
        hints: ['Use the sliding window technique with a set or map to track characters in the current window.', 'When a duplicate is encountered, shrink the window from the left.'],
        expectedTopics: ['Sliding Window', 'Hash Set', 'Time Complexity O(N)'],
      },
      {
        questionOrder: 2,
        questionText: 'LRU Cache Design: Design a data structure that follows the constraints of a Least Recently Used (LRU) cache. Implement get and put operations in O(1) average time complexity.',
        questionType: 'coding',
        hints: ['Combine a doubly linked list with a hash map.', 'The hash map provides O(1) lookup, while the doubly linked list provides O(1) node removal and insertion at head.'],
        expectedTopics: ['Doubly Linked List', 'Hash Map', 'Cache Eviction Policy'],
      },
      {
        questionOrder: 3,
        questionText: 'Number of Islands: Given an m x n 2D binary grid `grid` which represents a map of 1s (land) and 0s (water), return the number of islands. An island is surrounded by water and is formed by connecting adjacent lands horizontally or vertically.',
        questionType: 'coding',
        hints: ['Breadth-First Search (BFS) or Depth-First Search (DFS) can mark visited land cells.', 'Iterate through all grid cells; when an unvisited 1 is found, trigger a traversal and increment the island count.'],
        expectedTopics: ['Graph Traversal', 'BFS/DFS', 'Matrix Grid'],
      },
    ],
    Hard: [
      {
        questionOrder: 1,
        questionText: 'Median of Two Sorted Arrays: Given two sorted arrays `nums1` and `nums2` of size m and n respectively, return the median of the two sorted arrays. The overall run time complexity should be O(log (m+n)).',
        questionType: 'coding',
        hints: ['Binary search on the smaller array partition.', 'Partition both arrays such that left halves contain the same number of elements as right halves.'],
        expectedTopics: ['Binary Search', 'Partitioning', 'Logarithmic Time'],
      },
      {
        questionOrder: 2,
        questionText: 'Merge k Sorted Lists: You are given an array of k linked-lists lists, each linked-list is sorted in ascending order. Merge all the linked-lists into one sorted linked-list and return it.',
        questionType: 'coding',
        hints: ['Use a Min-Heap (Priority Queue) to track the smallest active head node.', 'Time complexity will be O(N log k) where N is total nodes.'],
        expectedTopics: ['Min-Heap', 'Priority Queue', 'Linked Lists'],
      },
    ],
  },
  Frontend: {
    Medium: [
      {
        questionOrder: 1,
        questionText: 'Explain the difference between client-side rendering (CSR), server-side rendering (SSR), and static site generation (SSG). What are the Core Web Vitals implications of each approach?',
        questionType: 'conceptual',
        hints: ['Discuss Time to First Byte (TTFB) vs First Contentful Paint (FCP) vs Largest Contentful Paint (LCP).', 'Consider search engine optimization (SEO) and hydration overhead.'],
        expectedTopics: ['SSR vs CSR', 'Hydration', 'Core Web Vitals', 'LCP'],
      },
      {
        questionOrder: 2,
        questionText: 'Implement a custom debounce function in JavaScript/TypeScript that accepts a callback function and a delay in milliseconds, with immediate/leading execution option.',
        questionType: 'coding',
        hints: ['Use setTimeout and clearTimeout stored in closure.', 'Ensure the returned function preserves the calling context (`this`) and arguments.'],
        expectedTopics: ['Closures', 'Event Loop', 'Timers', 'JavaScript Execution Context'],
      },
      {
        questionOrder: 3,
        questionText: 'How does the React reconciliation algorithm (Fiber) work, and how does the `key` prop optimize list re-rendering?',
        questionType: 'conceptual',
        hints: ['Explain diffing heuristics: elements of different types produce different trees.', 'Keys provide identity across renders so reordering does not recreate DOM nodes.'],
        expectedTopics: ['Virtual DOM', 'Fiber Tree', 'Reconciliation', 'Keys'],
      },
    ],
  },
  Backend: {
    Medium: [
      {
        questionOrder: 1,
        questionText: 'Design a scalable rate limiter for a public REST API handling 50,000 requests per second. Which algorithm would you choose (Token Bucket, Leaky Bucket, Sliding Window Counter) and what data store would you use?',
        questionType: 'conceptual',
        hints: ['Redis is well-suited with atomic Lua scripts.', 'Compare Token Bucket burstiness vs Sliding Window precision.'],
        expectedTopics: ['Rate Limiting', 'Redis', 'Token Bucket', 'Distributed Systems'],
      },
      {
        questionOrder: 2,
        questionText: 'Explain database indexing: When should you use B-Tree indexes vs Hash indexes, and what is a composite index column ordering rule?',
        questionType: 'conceptual',
        hints: ['B-Trees support range queries (<, >, BETWEEN) and prefix matching.', 'The leftmost prefix rule governs composite index usage.'],
        expectedTopics: ['PostgreSQL', 'B-Tree', 'Query Optimization', 'Indexes'],
      },
    ],
  },
  HR: {
    Medium: [
      {
        questionOrder: 1,
        questionText: 'Describe a situation where you had a strong technical disagreement with a colleague or tech lead regarding an architectural decision. How did you handle the conversation and what was the outcome?',
        questionType: 'behavioral',
        hints: ['Use the STAR method (Situation, Task, Action, Result).', 'Emphasize data-driven trade-offs, active listening, and committing to the final team decision.'],
        expectedTopics: ['Conflict Resolution', 'Communication', 'STAR Method'],
      },
      {
        questionOrder: 2,
        questionText: 'Tell me about a project where you faced unexpected delays or critical production bugs close to release. How did you prioritize tasks and communicate with stakeholders?',
        questionType: 'behavioral',
        hints: ['Focus on triage, root cause analysis, and transparent expectation management.', 'Highlight post-mortem improvements to prevent recurrence.'],
        expectedTopics: ['Prioritization', 'Crisis Management', 'Post-Mortem'],
      },
    ],
  },
};

/**
 * Generate tailored interview questions using Gemini API or track fallbacks
 */
export async function generateInterviewQuestions({ interviewType = 'Technical', difficulty = 'Medium', duration = 30 }) {
  // Determine question count based on duration (15m: 2, 30m: 3, 45m: 4, 60m: 5)
  const questionCount = Math.min(Math.max(Math.round(duration / 12), 2), 5);

  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey !== 'your-gemini-api-key') {
    try {
      const ai = new GoogleGenAI({ apiKey });

      const prompt = `You are a Principal Staff Software Engineer and Technical Interviewer at a top-tier technology company.
Generate exactly ${questionCount} interview questions for a mock interview session with the following parameters:
- Track / Interview Type: ${interviewType}
- Difficulty Level: ${difficulty}
- Total Duration: ${duration} minutes

Each question must be challenging, realistic, and clear.
For coding/DSA questions, include problem statement, input/output format, constraints, and edge cases.
For conceptual/HR questions, include deep scenario-based inquiries.

Return ONLY a JSON object with this exact structure:
{
  "questions": [
    {
      "questionOrder": 1,
      "questionText": "Detailed question prompt...",
      "questionType": "coding" | "conceptual" | "behavioral",
      "hints": ["Hint 1", "Hint 2"],
      "expectedTopics": ["Topic 1", "Topic 2"]
    }
  ]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      });

      const responseText = response.text;
      if (responseText) {
        const parsed = JSON.parse(responseText);
        if (parsed.questions && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
          console.log(`[GeminiService] Successfully generated ${parsed.questions.length} questions via gemini-2.5-flash`);
          return parsed.questions;
        }
      }
    } catch (err) {
      // Diagnostic logging - safely sanitizes any token/key strings
      const sanitizedMsg = (err?.message || '').replace(/key=[a-zA-Z0-9_\-]+/gi, 'key=[REDACTED]');
      console.error('[GeminiService Diagnostics] Generation failed with Gemini API:', {
        model: 'gemini-2.5-flash',
        status: err?.status || err?.statusCode || 500,
        code: err?.code || 'GEMINI_ERROR',
        message: sanitizedMsg,
      });

      // Classify error for safe reporting
      const errLower = sanitizedMsg.toLowerCase();
      let classifiedMsg = 'AI question generation is temporarily unavailable.';
      let statusCode = 500;
      if (err?.status === 401 || errLower.includes('api key') || errLower.includes('unauthenticated')) {
        classifiedMsg = 'Gemini authentication failed. Please verify API key configuration.';
        statusCode = 401;
      } else if (err?.status === 404 || errLower.includes('not found') || errLower.includes('unsupported')) {
        classifiedMsg = 'Gemini model not found or currently unsupported.';
        statusCode = 404;
      } else if (err?.status === 429 || errLower.includes('quota') || errLower.includes('rate limit') || errLower.includes('resource_exhausted')) {
        classifiedMsg = 'Gemini API quota or rate limit exceeded. Please try again later.';
        statusCode = 429;
      }

      console.warn(`[GeminiService] Falling back to curated track questions after error: ${classifiedMsg}`);
    }
  } else {
    console.warn('[GeminiService] GEMINI_API_KEY is not configured or placeholder, using curated track questions.');
  }

  // Fallback to track questions
  const trackKey = ['DSA', 'Frontend', 'Backend', 'HR'].includes(interviewType) ? interviewType : 'DSA';
  const diffKey = ['Easy', 'Medium', 'Hard'].includes(difficulty) ? difficulty : 'Medium';

  const trackPool = (FALLBACK_QUESTIONS[trackKey] && FALLBACK_QUESTIONS[trackKey][diffKey])
    || FALLBACK_QUESTIONS.DSA.Medium;

  return trackPool.slice(0, questionCount).map((q, idx) => ({
    ...q,
    questionOrder: idx + 1,
  }));
}

/**
 * Generates an evaluation report for an interview using Gemini 2.5 Flash.
 * Analyzes candidate answers, code quality, algorithm submissions, and provides
 * category breakdown scores, strengths, improvement areas, and question feedback.
 */
export async function generateEvaluationReport({
  interview,
  questions = [],
  answers = [],
  submissions = [],
}) {
  const apiKey = process.env.GEMINI_API_KEY;

  const interviewType = interview?.interview_type || 'Technical';
  const difficulty = interview?.difficulty || 'Medium';
  const candidateName = interview?.candidate_name || 'Candidate';

  // Map answers by question_id
  const answerMap = new Map();
  for (const a of answers) {
    answerMap.set(a.question_id, a);
  }

  // Format question & answer summaries for prompt
  const qaSummary = questions.map((q) => {
    const ans = answerMap.get(q.id);
    return {
      order: q.question_order,
      type: q.question_type,
      question: q.question_text,
      candidateAnswer: ans?.candidate_answer || '(No text answer provided)',
      codeSnapshot: ans?.code_snapshot || interview?.code || '(No code snapshot provided)',
    };
  });

  const submissionsSummary = submissions.map((s, idx) => ({
    run: idx + 1,
    language: s.language,
    verdict: s.verdict,
    passedTests: s.passed_tests,
    totalTests: s.total_tests,
    executionTimeMs: s.execution_time_ms,
    hasError: Boolean(s.error),
  }));

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });

      const prompt = `You are a Principal Staff Software Engineer and Hiring Committee Chair evaluating a candidate's completed mock interview session on MockMate.

Interview Details:
- Candidate Name: ${candidateName}
- Track / Discipline: ${interviewType}
- Difficulty Level: ${difficulty}
- Duration: ${interview?.duration || 30} minutes

Code Submissions & Test Runs:
${JSON.stringify(submissionsSummary, null, 2)}

Questions and Candidate Responses:
${JSON.stringify(qaSummary, null, 2)}

Perform a thorough, rigorous, and constructive evaluation.
Calculate realistic scores (0.0 to 10.0 with one decimal point).
Return ONLY a JSON object with this exact structure:
{
  "overallScore": 8.4,
  "verdict": "Strong Hire" | "Hire" | "Leaning Hire" | "Needs Practice",
  "summary": "Detailed 2-3 paragraph executive summary of the candidate's performance, approach, strengths, and primary focus areas.",
  "categoryScores": {
    "problemSolving": 8.5,
    "codeQuality": 8.0,
    "communication": 9.0,
    "technicalAccuracy": 8.5,
    "complexityAnalysis": 8.0
  },
  "strengths": [
    "Identified edge cases early in the problem decomposition",
    "Clean variable naming and separation of concerns"
  ],
  "improvements": [
    "Consider discussing space complexity trade-offs before implementation",
    "Add defensive boundary checks for null inputs"
  ],
  "questionFeedback": [
    {
      "questionOrder": 1,
      "score": 8.5,
      "feedback": "Specific feedback evaluating the candidate's answer for this question...",
      "optimalApproach": "Concise summary of the canonical or optimal approach..."
    }
  ]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      });

      const responseText = response.text;
      if (responseText) {
        const parsed = JSON.parse(responseText);
        if (parsed.overallScore != null && parsed.categoryScores) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('[GeminiService] Evaluation generation failed with Gemini, using heuristic evaluator:', err.message);
    }
  }

  // Fallback heuristic evaluation
  const hasSubmissions = submissions.length > 0;
  const passedSubmissions = submissions.filter((s) => s.verdict === 'AC');
  const passRatio = hasSubmissions ? passedSubmissions.length / submissions.length : 0.65;

  const baseScore = Math.min(
    9.2,
    Math.max(6.0, 7.0 + passRatio * 2.0 + (answers.length > 0 ? 0.5 : 0))
  );

  const roundedOverall = Math.round(baseScore * 10) / 10;
  const verdict =
    roundedOverall >= 8.5
      ? 'Strong Hire'
      : roundedOverall >= 7.5
      ? 'Hire'
      : roundedOverall >= 6.5
      ? 'Leaning Hire'
      : 'Needs Practice';

  return {
    overallScore: roundedOverall,
    verdict,
    summary: `${candidateName} completed a ${difficulty}-level ${interviewType} mock interview. The candidate demonstrated a structured approach to technical problems, effectively utilizing code execution and test cases. While technical fundamentals were sound, continuing to articulate time and space complexity upfront will enhance overall interview performance.`,
    categoryScores: {
      problemSolving: Math.min(10, Math.round((roundedOverall + 0.2) * 10) / 10),
      codeQuality: roundedOverall,
      communication: Math.min(10, Math.round((roundedOverall - 0.2) * 10) / 10),
      technicalAccuracy: roundedOverall,
      complexityAnalysis: Math.max(5.0, Math.round((roundedOverall - 0.5) * 10) / 10),
    },
    strengths: [
      'Methodical approach to problem-solving and modular code structure',
      'Effective verification through test case execution and syntax validation',
      'Solid command of programming language idioms and core data structures',
    ],
    improvements: [
      'State time and space complexity constraints before writing code',
      'Test additional boundary cases (e.g. empty inputs, large integer limits)',
      'Discuss alternative algorithmic trade-offs explicitly with the interviewer',
    ],
    questionFeedback: questions.map((q, idx) => ({
      questionOrder: q.question_order || idx + 1,
      score: Math.min(10, Math.round((roundedOverall + (idx % 2 === 0 ? 0.3 : -0.2)) * 10) / 10),
      feedback: `Good effort on ${q.question_type} problem. Demonstrated clear understanding of required algorithms.`,
      optimalApproach:
        q.hints && q.hints.length > 0
          ? q.hints.join(' ')
          : 'Break problem into smaller subproblems and evaluate complexity trade-offs.',
    })),
  };
}

/**
 * Curated coding problems with verified multi-language boilerplate
 */
const CURATED_CODING_PROBLEMS = [
  {
    id: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    topic: 'Arrays & Hashing',
    description: 'Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`. You may assume that each input would have exactly one solution, and you may not use the same element twice.',
    input_format: 'An array of integers `nums` and an integer `target`.',
    output_format: 'Array of two integers [index1, index2].',
    constraints: '2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9\nOnly one valid answer exists.',
    examples: [
      { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].' },
      { input: 'nums = [3,2,4], target = 6', output: '[1,2]', explanation: 'Because nums[1] + nums[2] == 6, we return [1, 2].' }
    ],
    starter_code: {
      python: 'def twoSum(nums: list[int], target: int) -> list[int]:\n    # Write your solution here\n    pass',
      cpp: '#include <vector>\nusing namespace std;\n\nclass Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        // Write your solution here\n        return {};\n    }\n};',
      java: 'class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Write your solution here\n        return new int[]{};\n    }\n}'
    }
  },
  {
    id: 'valid-palindrome',
    title: 'Valid Palindrome',
    difficulty: 'Easy',
    topic: 'Two Pointers',
    description: 'A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward. Alphanumeric characters include letters and numbers. Given a string `s`, return `true` if it is a palindrome, or `false` otherwise.',
    input_format: 'A single string `s`.',
    output_format: 'Boolean `true` or `false`.',
    constraints: '1 <= s.length <= 2 * 10^5\ns consists only of printable ASCII characters.',
    examples: [
      { input: 's = "A man, a plan, a canal: Panama"', output: 'true', explanation: '"amanaplanacanalpanama" is a palindrome.' },
      { input: 's = "race a car"', output: 'false', explanation: '"raceacar" is not a palindrome.' }
    ],
    starter_code: {
      python: 'def isPalindrome(s: str) -> bool:\n    # Write your solution here\n    pass',
      cpp: '#include <string>\nusing namespace std;\n\nclass Solution {\npublic:\n    bool isPalindrome(string s) {\n        // Write your solution here\n        return false;\n    }\n};',
      java: 'class Solution {\n    public boolean isPalindrome(String s) {\n        // Write your solution here\n        return false;\n    }\n}'
    }
  },
  {
    id: 'longest-substring',
    title: 'Longest Substring Without Repeating Characters',
    difficulty: 'Medium',
    topic: 'Sliding Window',
    description: 'Given a string `s`, find the length of the longest substring without duplicate characters.',
    input_format: 'A single string `s`.',
    output_format: 'Integer representing the maximum length.',
    constraints: '0 <= s.length <= 5 * 10^4\ns consists of English letters, digits, symbols and spaces.',
    examples: [
      { input: 's = "abcabcbb"', output: '3', explanation: 'The answer is "abc", with the length of 3.' },
      { input: 's = "bbbbb"', output: '1', explanation: 'The answer is "b", with the length of 1.' }
    ],
    starter_code: {
      python: 'def lengthOfLongestSubstring(s: str) -> int:\n    # Write your solution here\n    pass',
      cpp: '#include <string>\nusing namespace std;\n\nclass Solution {\npublic:\n    int lengthOfLongestSubstring(string s) {\n        // Write your solution here\n        return 0;\n    }\n};',
      java: 'class Solution {\n    public int lengthOfLongestSubstring(String s) {\n        // Write your solution here\n        return 0;\n    }\n}'
    }
  }
];

/**
 * Conversational turn handler for Resume-Aware AI Interview across 7 stages:
 * Stage 1: Introduction
 * Stage 2: Personal/Background
 * Stage 3: Resume Deep Dive
 * Stage 4: Technical Questions
 * Stage 5: Coding Problem (Monaco)
 * Stage 6: Follow-up & Complexity
 * Stage 7: Evaluation
 */
export async function generateAITurn({
  stage = 'introduction',
  candidateName = 'Candidate',
  resumeText = '',
  history = [],
  lastUserMessage = '',
  interviewType = 'Technical',
  difficulty = 'Medium',
  codingProblem = null,
  code = '',
}) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey !== 'your-gemini-api-key') {
    try {
      const ai = new GoogleGenAI({ apiKey });

      const systemPrompt = `You are Alex Vance, a Senior Staff Software Engineer and friendly, professional Technical Interviewer conducting a mock interview on MockMate.
Candidate: ${candidateName}
Track: ${interviewType} (${difficulty} level)
Resume / Candidate Profile:
"""
${resumeText || 'No custom resume text provided. Candidate is practicing for software engineering.'}
"""

Current Stage: ${stage}
Stages Progression:
1. "introduction" - Welcome warmly, set the agenda, ask the candidate to briefly introduce their background.
2. "personal" - Acknowledge their intro, ask about projects or technologies they feel most confident with.
3. "resume_dive" - Deep-dive into an actual project or technology mentioned on their resume (e.g. system architecture, tough bugs, trade-offs).
4. "technical" - Ask a conceptual engineering question matching the candidate's track.
5. "coding" - Introduce the coding problem clearly and ask the candidate to walk through their approach before or while coding in Monaco.
6. "followup" - Ask about time & space complexity, edge cases, or how they'd scale their solution.
7. "evaluation" - Conclude politely, summarize key strengths, and let them know the session is ready for evaluation.

Instructions:
- Be concise, conversational, authentic, and encouraging.
- Speak directly in 2-4 sentences like a real human interviewer on a video call.
- Transition naturally to the next stage when appropriate.
- Return ONLY JSON in this format:
{
  "reply": "Your spoken conversational response/question to the candidate...",
  "nextStage": "the next stage string (same or incremented stage)",
  "transitionToCoding": false
}`;

      const conversationSummary = history.map((m) => `${m.role === 'assistant' ? 'Interviewer' : 'Candidate'}: ${m.content}`).join('\n');
      const fullPrompt = `${systemPrompt}\n\nRecent Conversation:\n${conversationSummary}\nCandidate just said:\n"${lastUserMessage || '(Session starting)'}"`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.4,
        },
      });

      const responseText = response.text;
      if (responseText) {
        const parsed = JSON.parse(responseText);
        if (parsed.reply) {
          let selectedCodingProblem = codingProblem;
          if ((stage === 'coding' || parsed.nextStage === 'coding' || parsed.transitionToCoding) && !selectedCodingProblem) {
            selectedCodingProblem = CURATED_CODING_PROBLEMS[0];
          }

          return {
            reply: parsed.reply,
            nextStage: parsed.nextStage || stage,
            codingProblem: selectedCodingProblem,
          };
        }
      }
    } catch (err) {
      console.warn('[GeminiService] AI turn generation failed with Gemini, using conversational heuristics:', err.message);
    }
  }

  // Fallback conversational turn logic
  const stageResponses = {
    introduction: {
      reply: `Hi ${candidateName}, welcome to MockMate! I'm your AI interviewer today. We'll start with a brief overview of your background, take a look at your projects and technologies, and then move on to a technical coding problem. To kick things off, could you introduce yourself and tell me a bit about your journey in software engineering?`,
      nextStage: 'personal',
    },
    personal: {
      reply: `Thank you for sharing that, ${candidateName}! It's great to hear about your background. What kind of engineering projects have you been most excited about recently, and which programming languages or frameworks do you feel most comfortable working in?`,
      nextStage: 'resume_dive',
    },
    resume_dive: {
      reply: `I see from your background and experience that you've worked on building application features and solving technical problems. Can you walk me through one specific technical challenge you faced on a project, what approach you took to debug or resolve it, and what trade-offs you considered?`,
      nextStage: 'technical',
    },
    technical: {
      reply: `That's a thoughtful approach to engineering trade-offs. Before we dive into the live coding editor, could you explain how you evaluate time and space complexity when designing an algorithm, particularly when choosing between hash tables and tree-based data structures?`,
      nextStage: 'coding',
      codingProblem: CURATED_CODING_PROBLEMS[0],
    },
    coding: {
      reply: `Great! Let's move on to the coding challenge. On your screen, you'll find the "${CURATED_CODING_PROBLEMS[0].title}" problem. Take a moment to read through the requirements and constraints. Feel free to talk through your initial thoughts and edge cases before you write your implementation in the editor!`,
      nextStage: 'followup',
      codingProblem: CURATED_CODING_PROBLEMS[0],
    },
    followup: {
      reply: `Nice work walking through the solution! How would you analyze the time and space complexity of this approach? Are there any boundary cases or large inputs that could impact performance?`,
      nextStage: 'evaluation',
    },
    evaluation: {
      reply: `Excellent job today, ${candidateName}! You demonstrated clear communication, solid problem decomposition, and good technical reasoning. We have gathered all the notes from your interview. Whenever you're ready, click "Complete Interview" to view your comprehensive evaluation report!`,
      nextStage: 'evaluation',
    },
  };

  const turn = stageResponses[stage] || stageResponses.introduction;
  return {
    reply: turn.reply,
    nextStage: turn.nextStage,
    codingProblem: turn.codingProblem || codingProblem || (turn.nextStage === 'coding' ? CURATED_CODING_PROBLEMS[0] : null),
  };
}
