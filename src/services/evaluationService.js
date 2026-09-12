import { supabase } from '../lib/supabase';

const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Triggers AI evaluation for a completed interview via backend Gemini service.
 */
export async function requestEvaluation(interviewId) {
  if (!interviewId) throw new Error('Interview ID is required');

  const response = await fetch(`${API_BASE_URL}/evaluate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ interviewId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Evaluation request failed with status ${response.status}`);
  }

  return response.json();
}

/**
 * Retrieves full evaluation and interview record for the results report page.
 * If evaluation is not yet generated, triggers generation automatically.
 */
export async function getInterviewEvaluation(interviewId) {
  if (!interviewId) return { error: 'Interview ID is required' };

  try {
    let interview = null;
    let questions = [];
    let answers = [];
    let submissions = [];

    if (supabase) {
      // 1. Fetch interview row
      const { data: intData, error: intErr } = await supabase
        .from('interviews')
        .select('*')
        .eq('id', interviewId)
        .single();

      if (!intErr && intData) {
        interview = intData;
      }

      // 2. Fetch questions
      const { data: qData } = await supabase
        .from('interview_questions')
        .select('*')
        .eq('interview_id', interviewId)
        .order('question_order', { ascending: true });

      if (qData) questions = qData;

      // 3. Fetch answers
      const { data: aData } = await supabase
        .from('interview_answers')
        .select('*')
        .eq('interview_id', interviewId);

      if (aData) answers = aData;

      // 4. Fetch submissions
      const { data: sData } = await supabase
        .from('code_submissions')
        .select('*')
        .eq('interview_id', interviewId)
        .order('created_at', { ascending: false });

      if (sData) submissions = sData;
    }

    // If evaluation is already present in DB
    if (interview?.evaluation) {
      return {
        interview,
        evaluation: interview.evaluation,
        score: interview.score,
        questions,
        answers,
        submissions,
      };
    }

    // Otherwise, trigger evaluation from backend
    const evalRes = await requestEvaluation(interviewId);
    return {
      interview: interview || { id: interviewId },
      evaluation: evalRes.evaluation,
      score: evalRes.score,
      questions,
      answers,
      submissions,
    };
  } catch (err) {
    console.error('[evaluationService] Error:', err);
    return {
      error: err.message || 'Failed to load interview evaluation report.',
    };
  }
}
