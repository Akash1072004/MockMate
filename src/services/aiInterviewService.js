import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const AI_STAGE_DEFINITIONS = [
  { key: 'introduction', order: 1, title: 'Introduction & Background Overview', type: 'behavioral' },
  { key: 'personal', order: 2, title: 'Engineering Passion & Core Stacks', type: 'behavioral' },
  { key: 'resume_dive', order: 3, title: 'Resume Deep Dive & Architecture Decisions', type: 'conceptual' },
  { key: 'technical', order: 4, title: 'Technical Concepts & System Trade-offs', type: 'conceptual' },
  { key: 'coding', order: 5, title: 'Live Algorithmic Problem Solving', type: 'coding' },
  { key: 'followup', order: 6, title: 'Complexity Analysis & Scale Edge Cases', type: 'conceptual' },
  { key: 'evaluation', order: 7, title: 'Session Debrief & Overall Feedback', type: 'behavioral' },
];

// Initialize a new AI interview session
export async function startAIInterview({
  candidateId,
  candidateName,
  interviewType = 'DSA',
  difficulty = 'Medium',
  duration = 30,
}) {
  if (!supabase || !candidateId) {
    throw new Error('Candidate authentication is required to start an AI interview.');
  }

  // 1. Generate unique join code for this AI session
  const joinCode = 'AI-' + Math.random().toString(36).substring(2, 8).toUpperCase();

  // 2. Insert interview session into Supabase 'interviews'
  const { data: interview, error: interviewError } = await supabase
    .from('interviews')
    .insert({
      candidate_id: candidateId,
      interviewer_id: null,
      candidate_name: candidateName || 'Candidate',
      interviewer_name: 'MockMate AI (Alex Vance)',
      interview_type: interviewType,
      difficulty: difficulty,
      duration: duration,
      status: 'active',
      join_code: joinCode,
      is_ai: true,
      start_time: new Date().toISOString(),
    })
    .select()
    .single();

  if (interviewError) {
    console.error('[aiInterviewService] Error creating interview in Supabase:', interviewError);
    throw interviewError;
  }

  // 3. Register the 7 structured interview stage questions into 'interview_questions'
  const questionRows = AI_STAGE_DEFINITIONS.map((stageDef) => ({
    interview_id: interview.id,
    question_order: stageDef.order,
    question_text: `[${stageDef.key.toUpperCase()}] ${stageDef.title}`,
    question_type: stageDef.type,
    hints: [stageDef.key],
    expected_topics: [interviewType, stageDef.key],
  }));

  const { data: insertedQuestions, error: questionsError } = await supabase
    .from('interview_questions')
    .insert(questionRows)
    .select();

  if (questionsError) {
    console.error('[aiInterviewService] Error saving structured questions to Supabase:', questionsError);
  }

  return {
    interview,
    questions: insertedQuestions || questionRows,
  };
}

// Save candidate answer to 'interview_answers'
export async function saveCandidateAnswer({
  interviewId,
  questionId,
  candidateAnswer = '',
  codeSnapshot = '',
}) {
  if (!supabase || !interviewId || !questionId) return;

  const { data, error } = await supabase
    .from('interview_answers')
    .upsert({
      interview_id: interviewId,
      question_id: questionId,
      candidate_answer: candidateAnswer,
      code_snapshot: codeSnapshot,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'interview_id,question_id',
    })
    .select()
    .single();

  if (error) {
    console.error('[aiInterviewService] Error saving answer to Supabase:', error);
    throw error;
  }

  return data;
}

// Fetch all questions for an interview session
export async function getInterviewQuestions(interviewId) {
  if (!supabase || !interviewId) return [];

  const { data, error } = await supabase
    .from('interview_questions')
    .select('*')
    .eq('interview_id', interviewId)
    .order('question_order', { ascending: true });

  if (error) {
    console.error('[aiInterviewService] Error fetching questions:', error);
    return [];
  }

  return data || [];
}

// Fetch existing answers for an interview session
export async function getInterviewAnswers(interviewId) {
  if (!supabase || !interviewId) return {};

  const { data, error } = await supabase
    .from('interview_answers')
    .select('*')
    .eq('interview_id', interviewId);

  if (error) {
    console.error('[aiInterviewService] Error fetching answers:', error);
    return {};
  }

  const map = {};
  (data || []).forEach((ans) => {
    map[ans.question_id] = ans;
  });

  return map;
}

// Complete the AI interview session
export async function completeInterviewSession(interviewId) {
  if (!supabase || !interviewId) return;

  const { data, error } = await supabase
    .from('interviews')
    .update({
      status: 'completed',
      completion_time: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', interviewId)
    .select()
    .single();

  if (error) {
    console.error('[aiInterviewService] Error completing interview:', error);
    throw error;
  }

  return data;
}

/**
 * Send a turn to the conversational AI interviewer with authoritative stage, intent, and followUpCount
 */
export async function sendAITurn({
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
  const response = await fetch('/api/questions/ai-turn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stage,
      candidateName,
      resumeText,
      history,
      lastUserMessage,
      interviewType,
      difficulty,
      codingProblem,
      code,
      intent,
      followUpCount,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to process AI conversation turn.');
  }

  return response.json();
}


/**
 * Retrieves the current active AI interview for a candidate, if one exists.
 */
export async function getActiveAIInterview(candidateId) {
  if (!supabase || !candidateId) return null;
  const { data, error } = await supabase
    .from('interviews')
    .select('*')
    .eq('candidate_id', candidateId)
    .eq('is_ai', true)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return data[0];
}

/**
 * Retrieves a specific AI interview by ID with its authoritative status.
 */
export async function getAIInterviewById(interviewId) {
  if (!supabase || !interviewId) return null;
  const { data, error } = await supabase
    .from('interviews')
    .select('*')
    .eq('id', interviewId)
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Concludes/archives any lingering active AI interviews for a candidate.
 * Ensures a single active AI session per candidate.
 */
export async function archiveCandidateActiveAIInterviews(candidateId) {
  if (!supabase || !candidateId) return;
  await supabase
    .from('interviews')
    .update({
      status: 'completed',
      completion_time: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('candidate_id', candidateId)
    .eq('is_ai', true)
    .eq('status', 'active');
}
