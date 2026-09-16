import { supabase, isSupabaseConfigured } from '../lib/supabase';

/**
 * Service for discovering live available interviewers and sending interview requests.
 * Only real database data from Supabase. No fake or mock interviewers.
 */

// Fetch all interviewers who are marked available (is_available = true)
export async function getAvailableInterviewers() {
  if (!isSupabaseConfigured || !supabase) {
    return { data: [], error: null };
  }

  // 1. Fetch interviewer profiles
  const { data: interviewers, error } = await supabase
    .from('profiles')
    .select(`
      id,
      full_name,
      email,
      bio,
      skills,
      github,
      linkedin,
      portfolio,
      experience,
      is_available,
      headline,
      username,
      created_at
    `)
    .eq('role', 'interviewer')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[discoveryService] Error fetching interviewers:', error);
    return { data: [], error };
  }

  if (!interviewers || interviewers.length === 0) {
    return { data: [], error: null };
  }

  const interviewerIds = interviewers.map((i) => i.id);

  // 2. Fetch rating summaries for these interviewers
  const { data: reviews, error: reviewsError } = await supabase
    .from('reviews')
    .select('interviewer_id, rating')
    .in('interviewer_id', interviewerIds);

  const ratingsMap = {};
  if (!reviewsError && reviews) {
    reviews.forEach((r) => {
      if (!ratingsMap[r.interviewer_id]) {
        ratingsMap[r.interviewer_id] = { sum: 0, count: 0 };
      }
      ratingsMap[r.interviewer_id].sum += Number(r.rating) || 0;
      ratingsMap[r.interviewer_id].count += 1;
    });
  }

  // 3. Fetch genuinely active in-progress interview count via SECURITY DEFINER RPC (bypasses RLS)
  const activeSet = new Set();
  try {
    const { data: rpcData } = await supabase.rpc('get_active_live_sessions');
    if (rpcData && Array.isArray(rpcData)) {
      rpcData.forEach((row) => {
        if (row.interviewer_id) activeSet.add(row.interviewer_id);
      });
    }
  } catch (err) {
    console.warn('[discoveryService] Error checking active live sessions via RPC:', err);
  }

  // Combine interviewers with their rating metrics and active status
  const combined = interviewers.map((interviewer) => {
    const stats = ratingsMap[interviewer.id];
    const avgRating = stats && stats.count > 0 ? (stats.sum / stats.count).toFixed(1) : null;
    const reviewCount = stats ? stats.count : 0;
    const isBusy = activeSet.has(interviewer.id);

    return {
      ...interviewer,
      averageRating: avgRating,
      reviewCount,
      isBusy,
    };
  });

  return { data: combined, error: null };
}

// Create a new interview request from candidate to interviewer
export async function createInterviewRequest({
  candidateId,
  interviewerId,
  candidateName,
  candidateEmail,
  candidateSocials = {},
}) {
  if (!supabase || !candidateId || !interviewerId) {
    throw new Error('Missing candidate or interviewer ID for request');
  }

  if (candidateId === interviewerId) {
    throw new Error('Candidates cannot send an interview request to themselves.');
  }

  // 1. Check if an active pending request already exists between this candidate and interviewer
  const { data: existing, error: checkError } = await supabase
    .from('interview_requests')
    .select('id, status')
    .eq('candidate_id', candidateId)
    .eq('interviewer_id', interviewerId)
    .eq('status', 'pending')
    .maybeSingle();

  if (existing) {
    throw new Error('You already have a pending interview request with this interviewer. Please wait for their response.');
  }

  // 2. Insert new pending request
  const { data, error } = await supabase
    .from('interview_requests')
    .insert({
      candidate_id: candidateId,
      interviewer_id: interviewerId,
      candidate_name: candidateName || 'Candidate',
      candidate_email: candidateEmail || null,
      candidate_socials: candidateSocials,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('[discoveryService] Error creating interview request:', error);
    throw error;
  }

  return data;
}
