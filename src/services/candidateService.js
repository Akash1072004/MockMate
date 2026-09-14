import { getLeaderboard } from './leaderboardService.js';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

/**
 * Service for candidate data retrieval from Supabase.
 * No hardcoded or fake data. All data is fetched directly from database tables.
 */

// Fetch all interviews for a candidate
export async function getCandidateInterviews(candidateId) {
  if (!isSupabaseConfigured || !supabase || !candidateId) {
    return { data: [], error: null };
  }

  const { data, error } = await supabase
    .from('interviews')
    .select(`
      id,
      candidate_id,
      interviewer_id,
      candidate_name,
      interviewer_name,
      interview_type,
      difficulty,
      duration,
      status,
      score,
      join_code,
      evaluation,
      start_time,
      completion_time,
      created_at,
      updated_at,
      request_id,
      is_ai
    `)
    .eq('candidate_id', candidateId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[candidateService] Error fetching interviews:', error);
    return { data: [], error };
  }

  return { data: data || [], error: null };
}

// Fetch all interview requests sent by candidate
export async function getCandidateRequests(candidateId) {
  if (!isSupabaseConfigured || !supabase || !candidateId) {
    return { data: [], error: null };
  }

  const { data, error } = await supabase
    .from('interview_requests')
    .select(`
      id,
      candidate_id,
      interviewer_id,
      candidate_name,
      candidate_email,
      status,
      interview_id,
      join_code,
      created_at,
      responded_at,
      interviewer:interviewer_id (
        id,
        full_name,
        email,
        bio,
        skills,
        github,
        linkedin
      )
    `)
    .eq('candidate_id', candidateId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[candidateService] Error fetching requests:', error);
    return { data: [], error };
  }

  return { data: data || [], error: null };
}

// Fetch candidate leaderboard rank
export async function getCandidateRank(candidateId) {
  if (!candidateId) return { rank: null, error: null };
  try {
    const { data, error } = await getLeaderboard();
    if (!error && Array.isArray(data)) {
      const match = data.find((c) => c.candidate_id === candidateId);
      if (match) {
        return { 
          rank: match.rank, 
          average_score: match.average_score, 
          interview_count: match.interview_count, 
          error: null 
        };
      }
    }
  } catch (e) {
    // fallback to supabase view below
  }

  if (!isSupabaseConfigured || !supabase) {
    return { rank: null, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('candidate_leaderboard')
      .select('rank, average_score, interview_count')
      .eq('candidate_id', candidateId)
      .maybeSingle();

    if (error) {
      return { rank: null, error };
    }

    return { rank: data?.rank ?? null, error: null };
  } catch (err) {
    return { rank: null, error: err };
  }
}

// Cancel a pending interview request atomically via database RPC
export async function cancelInterviewRequest(requestId) {
  if (!supabase || !requestId) throw new Error('Invalid request parameters');

  const { data: rpcData, error: rpcError } = await supabase.rpc('cancel_interview_request', {
    p_request_id: requestId,
  });

  if (rpcError) {
    console.error('[candidateService] cancel_interview_request RPC error:', rpcError);
    throw new Error(rpcError.message || 'Failed to cancel interview request.');
  }

  return rpcData?.request;
}

// Compute statistics from verified interviews list
export function calculateCandidateStats(interviews = [], requests = []) {
  const completedInterviews = interviews.filter((i) => i.status === 'completed');

  const scoredInterviews = completedInterviews
    .map((i) => {
      let scoreVal = null;
      if (i.score !== null && i.score !== undefined && !isNaN(Number(i.score))) {
        scoreVal = Number(i.score);
      } else if (i.evaluation) {
        try {
          const evalObj = typeof i.evaluation === 'string' ? JSON.parse(i.evaluation) : i.evaluation;
          const candidateScore = evalObj?.overallScore ?? evalObj?.overall_score ?? evalObj?.score;
          if (candidateScore !== null && candidateScore !== undefined && !isNaN(Number(candidateScore))) {
            scoreVal = Number(candidateScore);
          }
        } catch (e) {
          // ignore json parse error
        }
      }
      return { ...i, resolvedScore: scoreVal };
    })
    .filter((i) => i.resolvedScore !== null && i.resolvedScore !== undefined && !isNaN(i.resolvedScore));

  const totalScore = scoredInterviews.reduce((acc, curr) => acc + curr.resolvedScore, 0);

  // Preserve exact score precision up to 2 decimal places; null if no valid completed evaluations
  let averageScore = null;
  if (scoredInterviews.length > 0) {
    const rawAvg = totalScore / scoredInterviews.length;
    averageScore = Number.isInteger(rawAvg) ? rawAvg.toString() : parseFloat(rawAvg.toFixed(2)).toString();
  }

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const acceptedRequests = requests.filter((r) => r.status === 'accepted');

  // Recent scores (last 5 completed interviews)
  const recentScores = scoredInterviews
    .slice(0, 5)
    .map((i) => ({
      date: new Date(i.created_at).toLocaleDateString(),
      type: i.interview_type,
      score: i.resolvedScore,
    }));

  return {
    totalCompleted: completedInterviews.length,
    averageScore,
    pendingRequestsCount: pendingRequests.length,
    acceptedRequestsCount: acceptedRequests.length,
    recentScores,
  };
}

/**
 * Concludes an active AI interview from the candidate dashboard or session recovery.
 * Enforces candidate ownership.
 */
export async function concludeActiveAIInterview(interviewId, candidateId) {
  if (!isSupabaseConfigured || !supabase || !interviewId || !candidateId) {
    return { data: null, error: new Error('Missing interview ID or candidate ID') };
  }

  const { data, error } = await supabase
    .from('interviews')
    .update({
      status: 'completed',
      completion_time: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', interviewId)
    .eq('candidate_id', candidateId)
    .eq('is_ai', true)
    .select()
    .single();

  if (error) {
    console.error('[candidateService] Error concluding active AI interview:', error);
    return { data: null, error };
  }

  return { data, error: null };
}
