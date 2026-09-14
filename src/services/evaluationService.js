import { supabase } from '../lib/supabase';
import { getApiBaseUrl } from '../utils/apiConfig';

/**
 * Triggers AI evaluation for a completed interview via backend Gemini service.
 * Accepts optional authoritative transcript, qaHistory, and codeSnapshot.
 */
export async function requestEvaluation(interviewId, { transcript = [], qaHistory = [], codeSnapshot = '' } = {}) {
  if (!interviewId) throw new Error('Interview ID is required');

  const apiBase = getApiBaseUrl();
  const response = await fetch(`${apiBase}/evaluate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      interviewId,
      transcript,
      qaHistory,
      codeSnapshot,
    }),
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
        isPending: false,
      };
    }

    // If it is a peer interview and interviewer has not submitted an evaluation yet
    if (interview && !interview.is_ai) {
      return {
        interview,
        evaluation: null,
        score: null,
        questions,
        answers,
        submissions,
        isPending: true,
      };
    }

    // Otherwise, for AI interviews only, trigger evaluation from backend
    const evalRes = await requestEvaluation(interviewId);
    return {
      interview: interview || { id: interviewId },
      evaluation: evalRes.evaluation,
      score: evalRes.score,
      questions,
      answers,
      submissions,
      isPending: false,
    };
  } catch (err) {
    console.error('[evaluationService] Error:', err);
    return {
      error: err.message || 'Failed to load interview evaluation report.',
    };
  }
}

/**
 * Submits a comprehensive final mock-interview evaluation for a peer session.
 * Strictly checks that the caller is the assigned interviewer.
 */
export async function submitPeerEvaluation({
  interviewId,
  overallScore,
  technicalSkills,
  problemSolving,
  codeQuality,
  communication,
  approachReasoning,
  strengths = [],
  improvements = [],
  interviewerFeedback,
  recommendation = 'Hire',
  evaluatorName = 'Interviewer',
}) {
  if (!supabase || !interviewId) throw new Error('Missing interview ID');

  // Verify caller is the assigned interviewer
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required.');

  const { data: interview, error: fetchErr } = await supabase
    .from('interviews')
    .select('id, interviewer_id, candidate_id, is_ai')
    .eq('id', interviewId)
    .single();

  if (fetchErr || !interview) throw new Error('Interview not found.');
  if (interview.interviewer_id !== user.id) {
    throw new Error('Unauthorized: Only the assigned interviewer can submit evaluations for this interview.');
  }

  const nowIso = new Date().toISOString();
  const evaluationPayload = {
    interview_id: interviewId,
    interviewer_id: user.id,
    candidate_id: interview.candidate_id,
    overallScore: Number(overallScore) || 0,
    overall_score: Number(overallScore) || 0,
    verdict: recommendation,
    recommendation,
    summary: interviewerFeedback || 'Comprehensive evaluation submitted by interviewer.',
    feedback: interviewerFeedback || '',
    technicalSkills: Number(technicalSkills) || 0,
    problemSolving: Number(problemSolving) || 0,
    codeQuality: Number(codeQuality) || 0,
    communication: Number(communication) || 0,
    approachReasoning: Number(approachReasoning) || 0,
    categoryScores: {
      problemSolving: Number(problemSolving) || 0,
      codeQuality: Number(codeQuality) || 0,
      communication: Number(communication) || 0,
      technicalAccuracy: Number(technicalSkills) || 0,
      complexityAnalysis: Number(approachReasoning) || 0,
    },
    strengths: Array.isArray(strengths) ? strengths : [strengths].filter(Boolean),
    improvements: Array.isArray(improvements) ? improvements : [improvements].filter(Boolean),
    areas_to_improve: Array.isArray(improvements) ? improvements : [improvements].filter(Boolean),
    interviewerFeedback: interviewerFeedback || '',
    evaluatorName,
    isPeer: true,
    created_at: nowIso,
    updated_at: nowIso,
    submittedAt: nowIso,
  };

  const { data: updated, error: updateErr } = await supabase
    .from('interviews')
    .update({
      evaluation: evaluationPayload,
      score: Number(overallScore) || 0,
      status: 'completed',
      completion_time: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', interviewId)
    .select()
    .single();

  if (updateErr) {
    console.error('[evaluationService] Failed to submit peer evaluation:', updateErr);
    throw updateErr;
  }

  return updated;
}
