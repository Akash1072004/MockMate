import { supabase, isSupabaseConfigured } from '../lib/supabase';

/**
 * Service for interviewer dashboard data and operations.
 * Database-backed with Supabase PostgreSQL and Realtime.
 */

// Fetch all requests sent to this interviewer
export async function getInterviewerRequests(interviewerId) {
  if (!isSupabaseConfigured || !supabase || !interviewerId) {
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
      candidate_socials,
      status,
      interview_id,
      join_code,
      created_at,
      responded_at,
      candidate:candidate_id (
        id,
        full_name,
        email,
        bio,
        skills,
        github,
        linkedin,
        portfolio,
        experience
      )
    `)
    .eq('interviewer_id', interviewerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[interviewerService] Error fetching requests:', error);
    return { data: [], error };
  }

  return { data: data || [], error: null };
}

// Fetch all interviews conducted by this interviewer
export async function getInterviewerInterviews(interviewerId) {
  if (!isSupabaseConfigured || !supabase || !interviewerId) {
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
    .eq('interviewer_id', interviewerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[interviewerService] Error fetching interviews:', error);
    return { data: [], error };
  }

  return { data: data || [], error: null };
}

// Fetch reviews received by this interviewer
export async function getInterviewerReviews(interviewerId) {
  if (!isSupabaseConfigured || !supabase || !interviewerId) {
    return { data: [], error: null };
  }

  const { data, error } = await supabase
    .from('reviews')
    .select(`
      id,
      interview_id,
      candidate_id,
      interviewer_id,
      rating,
      review_text,
      created_at,
      candidate:candidate_id (
        id,
        full_name
      )
    `)
    .eq('interviewer_id', interviewerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[interviewerService] Error fetching reviews:', error);
    return { data: [], error };
  }

  return { data: data || [], error: null };
}

// Toggle availability status in profiles table
export async function updateAvailability(interviewerId, isAvailable) {
  if (!supabase || !interviewerId) throw new Error('Invalid interviewer ID');

  const { data, error } = await supabase
    .from('profiles')
    .update({ 
      is_available: isAvailable,
      updated_at: new Date().toISOString()
    })
    .eq('id', interviewerId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Accept an interview request and generate an associated interview session atomically via database RPC
export async function acceptInterviewRequest({ requestId }) {
  const targetRequestId = requestId || (typeof arguments[0] === 'string' ? arguments[0] : null);
  if (!supabase || !targetRequestId) {
    throw new Error('Missing request ID to accept interview request');
  }

  // Canonical atomic RPC execution (strictly enforced at database level)
  const { data: rpcData, error: rpcError } = await supabase.rpc('accept_interview_request', {
    p_request_id: targetRequestId,
  });

  if (rpcError) {
    console.error('[interviewerService] accept_interview_request RPC error:', rpcError);
    throw new Error(rpcError.message || 'Failed to accept interview request.');
  }

  if (!rpcData || !rpcData.success) {
    throw new Error('Database failed to accept interview request.');
  }

  return {
    request: rpcData.request,
    interview: rpcData.interview,
  };
}

// Decline an interview request atomically via database RPC
export async function declineInterviewRequest(requestId) {
  if (!supabase || !requestId) {
    throw new Error('Missing request ID to decline request');
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc('decline_interview_request', {
    p_request_id: requestId,
  });

  if (rpcError) {
    console.error('[interviewerService] decline_interview_request RPC error:', rpcError);
    throw new Error(rpcError.message || 'Failed to decline interview request.');
  }

  return rpcData?.request;
}

// Compute ratings summary from reviews
export function calculateReviewsSummary(reviews = []) {
  if (!reviews || reviews.length === 0) {
    return { averageRating: null, totalReviews: 0 };
  }

  const total = reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0);
  const avg = (total / reviews.length).toFixed(1);

  return {
    averageRating: avg,
    totalReviews: reviews.length,
  };
}
