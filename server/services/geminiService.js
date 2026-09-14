import { GoogleGenAI } from '@google/genai';

/**
 * Robust helper to call Gemini models using a prioritized model cascade.
 * Active primary: gemini-3.1-flash-lite (fast, active quota)
 * Secondary fallback: gemini-3.5-flash-lite
 * Tertiary fallback: gemini-2.5-flash
 */
const CANDIDATE_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
];

async function callGeminiCascade(apiKey, prompt, config = {}) {
  if (!apiKey || apiKey === 'your-gemini-api-key') {
    throw new Error('No valid Gemini API key configured.');
  }

  const ai = new GoogleGenAI({ apiKey });
  let lastErr = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Gemini model ${model} timed out after 12s`)), 12000)
      );

      const response = await Promise.race([
        ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            temperature: 0.2,
            ...config,
          },
        }),
        timeoutPromise,
      ]);

      if (response && response.text) {
        return { text: response.text, model };
      }
    } catch (err) {
      lastErr = err;
      const errMsg = err?.message || '';
      console.warn(`[GeminiService] Model ${model} call failed: ${errMsg.slice(0, 100)}`);
      // If 429 quota or 404/503 unavailable, try next model in cascade
      continue;
    }
  }

  throw lastErr || new Error('All models in Gemini cascade failed.');
}

/**
 * Fallback questions by track and difficulty
 */
const FALLBACK_QUESTIONS = {
  DSA: {
    Easy: [
      {
        questionText: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. What is the optimal time and space complexity of your approach?',
        questionType: 'coding',
        hints: ['Consider using a hash table to track complements.', 'Think about whether single-pass is achievable.'],
        expectedTopics: ['Arrays', 'Hash Maps', 'Time Complexity'],
      },
      {
        questionText: 'Explain how a Stack differs from a Queue in both interface and common use cases. Give an example problem where a stack is the ideal data structure.',
        questionType: 'conceptual',
        hints: ['LIFO vs FIFO properties', 'Consider parenthesis matching or recursion call stacks.'],
        expectedTopics: ['Data Structures', 'Stacks', 'Queues'],
      },
    ],
    Medium: [
      {
        questionText: 'Given a string s, find the length of the longest substring without duplicate characters. Explain how the sliding window technique optimizes this from O(n^2) to O(n).',
        questionType: 'coding',
        hints: ['Use two pointers to maintain a valid window.', 'Use a hash set or array to store character frequencies.'],
        expectedTopics: ['Sliding Window', 'Two Pointers', 'Hash Sets'],
      },
      {
        questionText: 'Describe how a Binary Search Tree maintains its invariant during insertion. What is the worst-case time complexity of search in an unbalanced BST vs an AVL or Red-Black tree?',
        questionType: 'conceptual',
        hints: ['Left child < root < right child', 'Degenerate tree resembles linked list: O(n) vs O(log n).'],
        expectedTopics: ['Trees', 'BST', 'Tree Balancing'],
      },
    ],
    Hard: [
      {
        questionText: 'Explain how Dijkstra\'s algorithm finds the shortest path in a weighted graph with non-negative edges. Why does it fail when negative edge weights are introduced?',
        questionType: 'conceptual',
        hints: ['Greedy choice property', 'Bellman-Ford handles negative weights'],
        expectedTopics: ['Graphs', 'Dijkstra', 'Shortest Path'],
      },
    ],
  },
  Technical: {
    Medium: [
      {
        questionText: 'Explain the difference between process-level concurrency and thread-level concurrency. How does memory sharing work between threads within the same process versus between distinct processes?',
        questionType: 'conceptual',
        hints: ['Shared virtual address space vs IPC', 'Context switching overhead differences'],
        expectedTopics: ['Operating Systems', 'Concurrency', 'Memory Management'],
      },
      {
        questionText: 'How does database indexing using B-Trees improve read query performance? What is the trade-off with respect to write (INSERT/UPDATE) throughput and storage overhead?',
        questionType: 'conceptual',
        hints: ['Logarithmic page lookup', 'Write amplification on index maintenance'],
        expectedTopics: ['Databases', 'Indexing', 'B-Trees'],
      },
    ],
  },
  Frontend: {
    Medium: [
      {
        questionText: 'Explain the browser event loop, specifically the distinction between macrotasks (e.g. setTimeout) and microtasks (e.g. Promise.then, queueMicrotask). In what order do they execute?',
        questionType: 'conceptual',
        hints: ['Call stack empty -> microtask queue drained -> rendering -> macrotask'],
        expectedTopics: ['JavaScript', 'Event Loop', 'Asynchronous Execution'],
      },
    ],
  },
  Backend: {
    Medium: [
      {
        questionText: 'Compare horizontal scaling vs vertical scaling for stateful backend services. How does consistent hashing help distribute cache loads when nodes are added or removed dynamically?',
        questionType: 'conceptual',
        hints: ['Hash ring with virtual nodes', 'Minimizing cache eviction and remapping during scaling'],
        expectedTopics: ['System Design', 'Consistent Hashing', 'Scalability'],
      },
    ],
  },
  HR: {
    Medium: [
      {
        questionText: 'Describe a situation where you had a strong technical disagreement with a teammate or lead regarding architecture or code style. How did you resolve it constructively?',
        questionType: 'behavioral',
        hints: ['Focus on data-driven trade-offs, proof of concept, and team alignment'],
        expectedTopics: ['Communication', 'Conflict Resolution', 'Collaboration'],
      },
    ],
  },
};

import { CURATED_CODING_PROBLEMS, selectCodingProblem, DEFAULT_CODING_PROBLEM } from '../../src/utils/codingProblems.js';
export { CURATED_CODING_PROBLEMS, selectCodingProblem, DEFAULT_CODING_PROBLEM };

/**
 * Generates interview questions for a mock interview session
 */
export async function generateInterviewQuestions({
  interviewType = 'Technical',
  difficulty = 'Medium',
  duration = 30,
  questionCount = 3,
}) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey !== 'your-gemini-api-key') {
    try {
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

      const result = await callGeminiCascade(apiKey, prompt, {
        responseMimeType: 'application/json',
      });

      if (result.text) {
        const parsed = JSON.parse(result.text);
        if (parsed.questions && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
          console.log(`[GeminiService] Successfully generated ${parsed.questions.length} questions via ${result.model}`);
          return parsed.questions;
        }
      }
    } catch (err) {
      console.warn('[GeminiService] Question generation fell back to curated bank:', err.message);
    }
  }

  // Fallback to track questions
  const trackKey = ['DSA', 'Frontend', 'Backend', 'HR'].includes(interviewType) ? interviewType : 'DSA';
  const diffKey = ['Easy', 'Medium', 'Hard'].includes(difficulty) ? difficulty : 'Medium';
  const trackPool = (FALLBACK_QUESTIONS[trackKey] && FALLBACK_QUESTIONS[trackKey][diffKey]) || FALLBACK_QUESTIONS.DSA.Medium;

  return trackPool.slice(0, questionCount).map((q, idx) => ({
    ...q,
    questionOrder: idx + 1,
  }));
}

/**
 * Deterministic Answer Classifier for Conversational & Follow-up Logic
 */
function classifyCandidateAnswer(text) {
  if (!text || typeof text !== 'string') return 'dont_know';
  const clean = text.trim().toLowerCase();

  // "Don't know", inability to solve, or refusal
  if (
    clean === "i don't know" ||
    clean === "dont know" ||
    clean === "no idea" ||
    clean === "i do not know" ||
    clean === "pass" ||
    clean === "skip" ||
    clean.length < 5 ||
    /(can'?t|cannot|unable to|not able to)\s+(solve|figure|code|do|complete)|i'?m stuck|give up|skip (this|the)?\s*(problem|question|coding)|move on|don'?t know how to (solve|approach|do)/i.test(clean)
  ) {
    return 'dont_know';
  }

  return 'answered';
}

/**
 * Conversational turn handler for Resume-Aware AI Interview across 7 stages.
 * Supports adaptive intelligent follow-ups grounded directly in candidate's response.
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
  intent = 'ask_stage_question',
  followUpCount = 0,
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  const activeCodingProb = codingProblem || CURATED_CODING_PROBLEMS[0];
  const candidateStatus = classifyCandidateAnswer(lastUserMessage);

  if (apiKey && apiKey !== 'your-gemini-api-key') {
    try {
      const systemPrompt = `You are Alex Vance, a Principal Staff Software Engineer and Senior Technical Interviewer conducting a mock interview on MockMate.
Candidate: ${candidateName}
Track: ${interviewType} (${difficulty} difficulty)
Current Stage: ${stage.toUpperCase()}
Intent: ${intent} (Current follow-up count in this stage: ${followUpCount})

Candidate Profile / Resume:
"""
${resumeText || 'Candidate practicing software engineering.'}
"""

CRITICAL INTERACTION RULES:
1. LISTEN AND GROUND YOUR REPLY: Always address what the candidate actually said in their last message.
2. DO NOT BLINDLY PRAISE WRONG OR INCOMPLETE ANSWERS:
   - If the candidate's answer is factually incorrect (e.g. saying binary search is O(n), or threads do not share memory), do NOT say "Great answer!" or "Awesome!". Tactfully challenge the misconception: point out the discrepancy or ask a probing question to guide them.
   - If the candidate says "I don't know" or "No idea", do NOT repeat the question or praise them. Acknowledge cleanly and either provide a brief senior hint or transition.
   - If the candidate gives a strong answer, acknowledge the specific concepts they mentioned and ask a deeper application or edge-case question.
3. CONVERSATIONAL MEMORY: Never ask a question the candidate already answered. Build upon previous dialogue.
4. STAGE ADHERENCE: You are strictly in ${stage.toUpperCase()}. Do not jump to other interview stages.
5. KEEP IT REALISTIC & CONCISE: 2-4 sentences max, sounding like an authentic senior interviewer on a video call.

Return ONLY a JSON object with this structure:
{
  "reply": "Your spoken conversational response...",
  "answerAssessment": "correct" | "partially_correct" | "incorrect" | "incomplete" | "dont_know",
  "shouldFollowUp": boolean
}`;

      const dialogueSlice = history.slice(-6).map((m) => `${m.role === 'assistant' ? 'Interviewer' : 'Candidate'}: ${m.content}`).join('\n');
      const prompt = `${systemPrompt}\n\nRecent Dialogue:\n${dialogueSlice}\n\nCandidate's latest input:\n"${lastUserMessage || '(Session starting)'}"\nCandidate current code snapshot (if in coding):\n"${code || '(None)'}"`;

      const result = await callGeminiCascade(apiKey, prompt, {
        responseMimeType: 'application/json',
      });

      if (result.text) {
        const parsed = JSON.parse(result.text);
        if (parsed.reply) {
          return {
            reply: parsed.reply,
            stage,
            codingProblem: (stage === 'coding' || codingProblem) ? activeCodingProb : null,
            answerAssessment: parsed.answerAssessment || (candidateStatus === 'dont_know' ? 'dont_know' : 'partially_correct'),
            shouldFollowUp: Boolean(parsed.shouldFollowUp),
          };
        }
      }
    } catch (err) {
      console.warn('[GeminiService] AI turn generation failed with Gemini, using adaptive fallback:', err.message);
    }
  }

  // Realistic Adaptive Heuristic Fallback
  if (candidateStatus === 'dont_know' || intent === 'skip_coding') {
    if (stage === 'coding' || intent === 'skip_coding') {
      return {
        reply: `That's completely okay! Algorithmic problems under time constraints are tough. Let's move on and discuss the general approach, time complexity, and data structures you considered.`,
        stage,
        codingProblem: activeCodingProb,
        answerAssessment: 'dont_know',
        shouldFollowUp: false,
      };
    }
    return {
      reply: `No problem at all, ${candidateName}. It's completely fine not to have that off the top of your head. Let's move forward and explore another aspect of your experience.`,
      stage,
      codingProblem: (stage === 'coding' || codingProblem) ? activeCodingProb : null,
      answerAssessment: 'dont_know',
      shouldFollowUp: false,
    };
  }

  // Content-aware fallback based on stage and input
  const stageFallbacks = {
    introduction: {
      reply: `Hi ${candidateName}, welcome to MockMate! I'm Alex Vance, your interviewer today. Over the next session, we'll discuss your background, review projects from your resume, dive into technical concepts, and work through a live coding challenge. To kick things off, could you introduce yourself and tell me a bit about your journey in software development?`,
      answerAssessment: 'correct',
      shouldFollowUp: false,
    },
    personal: {
      reply: `Thank you for sharing that! You mentioned working across development stacks. What kind of engineering projects or technical domains have you been most passionate about recently, and which languages do you feel most productive with?`,
      answerAssessment: 'correct',
      shouldFollowUp: false,
    },
    resume_dive: {
      reply: `I see from your background that you've built and delivered application features. Could you walk me through one specific technical challenge or architectural trade-off you tackled in a recent project, how you diagnosed it, and what alternatives you considered?`,
      answerAssessment: 'partially_correct',
      shouldFollowUp: false,
    },
    technical: {
      reply: `That's a thoughtful technical explanation. Looking closer at data structures and algorithms, when designing systems under strict latency constraints, how do you evaluate time and space complexity trade-offs, particularly between hash tables and balanced tree structures?`,
      answerAssessment: 'partially_correct',
      shouldFollowUp: false,
    },
    coding: intent === 'clarify_coding'
      ? {
          reply: `That is an important consideration. Look closely at your loop bounds and data lookups. Can you store complements in a lookup table to reduce time complexity to O(n)?`,
          answerAssessment: 'partially_correct',
          shouldFollowUp: false,
        }
      : {
          reply: `Great! Let's move into our live coding stage. On your screen, you'll see the "${activeCodingProb.title}" problem with full constraints and an interactive Monaco editor. Take a moment to read through it, and walk me through your initial thoughts before you write code!`,
          answerAssessment: 'correct',
          shouldFollowUp: false,
        },
    followup: {
      reply: `Nice job walking through the code implementation. Looking at your solution, how would you analyze its exact time and space complexity? Are there any boundary cases or large inputs that could impact performance?`,
      answerAssessment: 'partially_correct',
      shouldFollowUp: false,
    },
    evaluation: {
      reply: `Fantastic effort throughout this interview, ${candidateName}! You demonstrated engagement across our technical and coding challenges. All your answers and code have been recorded. Whenever you're ready, click "Complete Interview" to view your detailed evaluation report!`,
      answerAssessment: 'correct',
      shouldFollowUp: false,
    },
  };

  const chosen = stageFallbacks[stage] || stageFallbacks.introduction;
  return {
    reply: chosen.reply,
    stage,
    codingProblem: (stage === 'coding' || codingProblem) ? activeCodingProb : null,
    answerAssessment: chosen.answerAssessment,
    shouldFollowUp: chosen.shouldFollowUp,
  };
}

/**
 * Heuristic Evidence-Based Evaluator
 * Strictly scores actual candidate answers without flattering defaults.
 */
function evaluateAnswersStrictHeuristic({
  candidateName,
  difficulty,
  interviewType,
  qaSummary = [],
  codeSnapshot = '',
  submissions = [],
}) {
  const scoredQuestions = qaSummary.map((q, idx) => {
    const ans = (q.candidateAnswer || '').trim();
    const ansLower = ans.toLowerCase();
    let score = 0;
    let feedback = '';
    let optimalApproach = 'Demonstrate clear domain reasoning, analyze edge cases, and state time/space complexity.';

    const isSkippedCoding = (q.stage === 'coding' && (q.codingOutcome === 'skipped' || ansLower.includes('[skipped]') || ansLower.includes('unable to solve') || ansLower.includes('cannot solve') || ansLower.includes('could not solve')));
    if (isSkippedCoding) {
      score = 1.0;
      feedback = 'Candidate could not solve or skipped the live coding problem. Minimal technical credit awarded.';
      optimalApproach = 'Break the problem down into brute force first, then optimize with appropriate data structures.';
    } else if (!ans || ans === '(No text answer provided)' || ans.length < 5) {
      score = 1.0;
      feedback = 'No substantive answer was provided by the candidate for this stage.';
    } else if (
      ansLower.includes("don't know") ||
      ansLower.includes("dont know") ||
      ansLower.includes("no idea") ||
      ansLower.includes("do not know")
    ) {
      score = 2.0;
      feedback = 'Candidate candidly stated they did not know the concept. Minimal technical credit awarded.';
    } else if (
      (q.question.toLowerCase().includes('binary search') && ansLower.includes('o(n)')) ||
      (q.question.toLowerCase().includes('thread') && ansLower.includes('separate memory'))
    ) {
      // Direct factual error detection
      score = 3.0;
      feedback = `Candidate gave an incorrect explanation: "${ans.slice(0, 100)}...". Core algorithmic/system invariants were violated.`;
      optimalApproach = 'Binary search requires O(log n) time by halving the search space. Threads share the process address space.';
    } else if (ans.length < 40) {
      score = 4.5;
      feedback = 'Brief or superficial answer. Demonstrated basic awareness but missed essential depth, trade-offs, and constraints.';
    } else {
      score = Math.min(8.5, 6.0 + Math.min(2.0, ans.length / 150));
      feedback = 'Solid response addressing key aspects of the inquiry with reasonable technical clarity.';
    }

    return {
      questionOrder: q.order || idx + 1,
      score: Math.round(score * 10) / 10,
      feedback,
      optimalApproach,
    };
  });

  // Code evaluation
  const hasSkippedCoding = qaSummary.some(q => q.stage === 'coding' && (q.codingOutcome === 'skipped' || (q.candidateAnswer && (q.candidateAnswer.includes('[SKIPPED]') || q.candidateAnswer.toLowerCase().includes('unable to solve')))));
  let codeScore = 4.0;
  if (hasSkippedCoding) {
    codeScore = 1.5; // Minimal credit for skipping coding
  } else if (codeSnapshot && codeSnapshot.length > 30) {
    if (codeSnapshot.includes('for ') && codeSnapshot.includes('range(')) {
      const loopCount = (codeSnapshot.match(/for /g) || []).length;
      if (loopCount >= 2) {
        codeScore = 6.0; // Brute force O(n^2)
      } else {
        codeScore = 8.5; // Single loop / map
      }
    } else {
      codeScore = 6.5;
    }
  }

  // Calculate average of questions
  const qAvg = scoredQuestions.length > 0
    ? scoredQuestions.reduce((acc, q) => acc + q.score, 0) / scoredQuestions.length
    : 4.0;

  const rawOverall = (qAvg * 0.7) + (codeScore * 0.3);
  const roundedOverall = Math.round(Math.max(1.5, Math.min(9.5, rawOverall)) * 10) / 10;

  const verdict =
    roundedOverall >= 8.0
      ? 'Strong Hire'
      : roundedOverall >= 6.8
      ? 'Hire'
      : roundedOverall >= 5.0
      ? 'Leaning Hire'
      : 'Needs Practice';

  return {
    overallScore: roundedOverall,
    verdict,
    summary: `${candidateName} completed a ${difficulty}-level ${interviewType} mock interview. Based on the actual submitted answers and code artifacts, the candidate achieved an overall score of ${roundedOverall}/10. Performance reflected ${verdict === 'Needs Practice' ? 'significant conceptual gaps and areas requiring practice' : 'demonstrated competency with specific opportunities for depth'}.`,
    categoryScores: {
      problemSolving: Math.round(Math.min(10, Math.max(2.0, qAvg)) * 10) / 10,
      codeQuality: Math.round(codeScore * 10) / 10,
      communication: Math.round(Math.min(10, Math.max(3.0, (qAvg + 1.0))) * 10) / 10,
      technicalAccuracy: Math.round(Math.min(10, Math.max(2.0, qAvg)) * 10) / 10,
      complexityAnalysis: Math.round(Math.min(10, Math.max(2.0, (codeScore - 0.5))) * 10) / 10,
    },
    strengths: roundedOverall >= 6.0
      ? ['Structured decomposition of core problem areas', 'Willingness to explain architectural rationale']
      : ['Attempted to engage with the interview format and answered available prompts'],
    improvements: [
      'Review fundamental time and space complexity metrics before implementing solutions',
      'Provide deeper, concrete technical trade-offs instead of high-level or speculative assertions',
      'Refine edge case handling in live code implementations',
    ],
    questionFeedback: scoredQuestions,
  };
}

/**
 * Generates an evidence-based evaluation report for an interview using Gemini
 * with prioritized cascade and strict evidence-grounded rubric.
 */
export async function generateEvaluationReport({
  interview,
  questions = [],
  answers = [],
  submissions = [],
  transcript = [],
  qaHistory = [],
  codeSnapshot = '',
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
  let qaSummary = [];
  if (qaHistory && qaHistory.length > 0) {
    qaSummary = qaHistory.map((item, idx) => ({
      order: idx + 1,
      stage: item.stage || `Stage ${idx + 1}`,
      question: item.question || item.questionText || '',
      candidateAnswer: item.answer || item.candidateAnswer || '(No text answer provided)',
      codeSnapshot: item.codeSnapshot || codeSnapshot || interview?.code || '',
    }));
  } else if (questions && questions.length > 0) {
    qaSummary = questions.map((q) => {
      const ans = answerMap.get(q.id);
      return {
        order: q.question_order,
        type: q.question_type,
        question: q.question_text,
        candidateAnswer: ans?.candidate_answer || '(No text answer provided)',
        codeSnapshot: ans?.code_snapshot || codeSnapshot || interview?.code || '(No code snapshot provided)',
      };
    });
  }

  const submissionsSummary = submissions.map((s, idx) => ({
    run: idx + 1,
    language: s.language,
    verdict: s.verdict,
    passedTests: s.passed_tests,
    totalTests: s.total_tests,
    executionTimeMs: s.execution_time_ms,
    hasError: Boolean(s.error),
  }));

  const transcriptSummary = (transcript || []).map((m) => `[${m.role === 'assistant' ? 'Interviewer' : 'Candidate'}]: ${m.content}`).join('\n');

  if (apiKey && apiKey !== 'your-gemini-api-key') {
    try {
      const prompt = `You are a Principal Staff Software Engineer and Hiring Committee Chair evaluating a candidate's completed mock interview session on MockMate.

RUBRIC GUIDELINES (0.0 to 10.0 scale):
- 9.0 - 10.0 (Exceptional): Flawless, canonical answers, deep reasoning, optimal complexity, comprehensive edge cases.
- 7.5 - 8.9 (Strong): Good, mostly correct with minor omissions, clear communication.
- 5.5 - 7.4 (Competent): Basic understanding, noticeable gaps, brute-force solutions, or missed edge cases.
- 3.5 - 5.4 (Weak): Partial understanding, significant misconceptions, or incomplete code.
- 0.0 - 3.4 (Poor): Incorrect answers (e.g. claiming binary search is O(n)), "I don't know", irrelevant answers, or failing code.

STRICT EVIDENCE RULES:
1. Ground every single score strictly on the actual questions and candidate answers provided below.
2. DO NOT FLATTER OR ASSUME KNOWLEDGE: If the candidate gave an incorrect answer, says "I don't know", or gave an empty response, you MUST assign a low score (0 to 3.5) for that question. NEVER award high scores for non-existent or wrong answers.
3. CRITICAL FOR CODING STAGE: If the candidate skipped or indicated inability to solve the live coding stage (marked as [SKIPPED] or codingOutcome: "skipped"), you MUST award a score between 0.0 and 2.0 for coding and problem-solving. Do NOT award coding credit for a skipped problem.
4. If the candidate used an O(n^2) brute force solution when an O(n) hash table solution is standard, penalize complexityAnalysis appropriately.
5. Calculate overallScore as the true weighted average of the individual question scores and code quality. Do not inflate.

Interview Details:
- Candidate Name: ${candidateName}
- Track / Discipline: ${interviewType}
- Difficulty Level: ${difficulty}
- Duration: ${interview?.duration || 30} minutes

Full Interview Dialogue Transcript:
"""
${transcriptSummary || 'No dialogue transcript recorded.'}
"""

Questions & Candidate Answers:
${JSON.stringify(qaSummary, null, 2)}

Candidate Final Code Solution:
"""
${codeSnapshot || interview?.code || '(No code submitted)'}
"""

Code Submissions & Test Runs:
${JSON.stringify(submissionsSummary, null, 2)}

Return ONLY a JSON object with this exact structure:
{
  "overallScore": 5.8,
  "verdict": "Strong Hire" | "Hire" | "Leaning Hire" | "Needs Practice",
  "summary": "Detailed 2-3 paragraph executive summary of the candidate's actual performance, approach, strengths, and specific areas where they struggled.",
  "categoryScores": {
    "problemSolving": 6.0,
    "codeQuality": 5.5,
    "communication": 6.5,
    "technicalAccuracy": 5.0,
    "complexityAnalysis": 4.5
  },
  "strengths": [
    "Evidence-based strength with specific reference to what candidate did well",
    "Another actual strength"
  ],
  "improvements": [
    "Specific technical gap identified in their answer",
    "Another actionable improvement"
  ],
  "questionFeedback": [
    {
      "questionOrder": 1,
      "score": 4.0,
      "feedback": "Specific feedback evaluating the candidate's actual answer for this question...",
      "optimalApproach": "Canonical or optimal approach..."
    }
  ]
}`;

      const result = await callGeminiCascade(apiKey, prompt, {
        responseMimeType: 'application/json',
      });

      if (result.text) {
        const parsed = JSON.parse(result.text);
        if (parsed.overallScore != null && parsed.categoryScores) {
          console.log(`[GeminiService] Evidence-based evaluation generated successfully via ${result.model} (Score: ${parsed.overallScore})`);
          return parsed;
        }
      }
    } catch (err) {
      console.warn('[GeminiService] Live evaluation failed with Gemini cascade, using strict evidence evaluator:', err.message);
    }
  }

  // Fallback to strict evidence-based evaluator
  return evaluateAnswersStrictHeuristic({
    candidateName,
    difficulty,
    interviewType,
    qaSummary,
    codeSnapshot,
    submissions,
  });
}
