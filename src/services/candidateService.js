import { supabase, isSupabaseConfigured } from '../lib/supabase';

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
      created_at
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
  if (!isSupabaseConfigured || !supabase || !candidateId) {
    return { rank: null, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('candidate_leaderboard')
      .select('rank, average_score, interview_count')
      .eq('candidate_id', candidateId)
      .maybeSingle();

    if (error) {
      // If view doesn't exist or permissions pending, return null gracefully
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
  const scoredInterviews = completedInterviews.filter((i) => i.score !== null && i.score !== undefined);

  const totalScore = scoredInterviews.reduce((acc, curr) => acc + Number(curr.score), 0);
  const averageScore = scoredInterviews.length > 0 
    ? (totalScore / scoredInterviews.length).toFixed(1) 
    : null;

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const acceptedRequests = requests.filter((r) => r.status === 'accepted');

  // Recent scores (last 5 completed interviews)
  const recentScores = scoredInterviews
    .slice(0, 5)
    .map((i) => ({
      date: new Date(i.created_at).toLocaleDateString(),
      type: i.interview_type,
      score: Number(i.score),
    }));

  return {
    totalCompleted: completedInterviews.length,
    averageScore,
    pendingRequestsCount: pendingRequests.length,
    acceptedRequestsCount: acceptedRequests.length,
    recentScores,
  };
}
