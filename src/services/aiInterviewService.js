import { supabase, isSupabaseConfigured } from '../lib/supabase';

/**
 * Service for configuring, running, and persisting AI mock interview sessions.
 * Questions generated via backend Gemini endpoint and saved to Supabase PostgreSQL.
 */

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

  // 1. Request tailored questions from Express backend (Gemini API)
  const response = await fetch('/api/questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ interviewType, difficulty, duration }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to generate interview questions from Gemini API.');
  }

  const { questions } = await response.json();
  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    throw new Error('No interview questions were returned by the AI engine.');
  }

  // 2. Generate unique join code for this AI session
  const joinCode = 'AI-' + Math.random().toString(36).substring(2, 8).toUpperCase();

  // 3. Insert interview session into Supabase 'interviews'
  const { data: interview, error: interviewError } = await supabase
    .from('interviews')
    .insert({
      candidate_id: candidateId,
      interviewer_id: null,
      candidate_name: candidateName || 'Candidate',
      interviewer_name: 'MockMate AI (Gemini)',
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

  // 4. Insert generated questions into 'interview_questions'
  const questionRows = questions.map((q, idx) => ({
    interview_id: interview.id,
    question_order: q.questionOrder || idx + 1,
    question_text: q.questionText,
    question_type: q.questionType || 'conceptual',
    hints: q.hints || [],
    expected_topics: q.expectedTopics || [],
  }));

  const { data: insertedQuestions, error: questionsError } = await supabase
    .from('interview_questions')
    .insert(questionRows)
    .select();

  if (questionsError) {
    console.error('[aiInterviewService] Error saving questions to Supabase:', questionsError);
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
