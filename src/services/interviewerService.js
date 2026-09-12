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

// Accept an interview request and generate an associated interview session atomically
export async function acceptInterviewRequest({ requestId, candidateId, candidateName, interviewerId, interviewerName }) {
  const targetRequestId = requestId || (typeof arguments[0] === 'string' ? arguments[0] : null);
  if (!supabase || !targetRequestId) {
    throw new Error('Missing parameters to accept interview request');
  }

  // 1. Invoke atomic database RPC: accept_interview_request
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('accept_interview_request', {
      p_request_id: targetRequestId,
    });

    if (!rpcError && rpcData?.success) {
      return {
        request: rpcData.request,
        interview: rpcData.interview,
      };
    }

    if (rpcError) {
      console.warn('[interviewerService] RPC accept_interview_request error, falling back if not found:', rpcError.message);
      // If error is an actual validation/authorization failure from the DB, throw immediately
      if (!rpcError.message.includes('function') && !rpcError.message.includes('does not exist')) {
        throw new Error(rpcError.message);
      }
    }
  } catch (err) {
    if (!err.message.includes('function') && !err.message.includes('does not exist')) {
      throw err;
    }
  }

  // 2. Direct fallback if database RPC is not yet created in the Supabase instance
  const joinCode = 'MM-' + Math.random().toString(36).substring(2, 8).toUpperCase();

  const { data: interview, error: interviewError } = await supabase
    .from('interviews')
    .insert({
      candidate_id: candidateId,
      interviewer_id: interviewerId,
      candidate_name: candidateName || 'Candidate',
      interviewer_name: interviewerName || 'Interviewer',
      interview_type: 'Technical',
      difficulty: 'Medium',
      duration: 45,
      status: 'waiting',
      join_code: joinCode,
      is_ai: false,
      request_id: targetRequestId,
    })
    .select()
    .single();

  if (interviewError) throw interviewError;

  const { data: updatedRequest, error: requestError } = await supabase
    .from('interview_requests')
    .update({
      status: 'accepted',
      interview_id: interview.id,
      join_code: joinCode,
      responded_at: new Date().toISOString(),
    })
    .eq('id', targetRequestId)
    .eq('interviewer_id', interviewerId)
    .select()
    .single();

  if (requestError) throw requestError;

  return { request: updatedRequest, interview };
}

// Decline an interview request atomically
export async function declineInterviewRequest(requestId, interviewerId) {
  if (!supabase || !requestId) {
    throw new Error('Missing parameters to decline request');
  }

  // 1. Invoke atomic database RPC: decline_interview_request
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('decline_interview_request', {
      p_request_id: requestId,
    });

    if (!rpcError && rpcData?.success) {
      return rpcData.request;
    }

    if (rpcError) {
      console.warn('[interviewerService] RPC decline_interview_request error, falling back if not found:', rpcError.message);
      if (!rpcError.message.includes('function') && !rpcError.message.includes('does not exist')) {
        throw new Error(rpcError.message);
      }
    }
  } catch (err) {
    if (!err.message.includes('function') && !err.message.includes('does not exist')) {
      throw err;
    }
  }

  // 2. Direct fallback
  const { data, error } = await supabase
    .from('interview_requests')
    .update({
      status: 'declined',
      responded_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('interviewer_id', interviewerId)
    .select()
    .single();

  if (error) throw error;
  return data;
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
