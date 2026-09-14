import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getApiBaseUrl } from '../utils/apiConfig';

/**
 * Service for interview sessions, join codes, and lifecycle states.
 * Enforces participant authorization: only authorized candidate or interviewer can access.
 */

// Fetch interview by ID with participant authorization verification
export async function getInterviewById(interviewId, userId) {
  if (!isSupabaseConfigured || !supabase || !interviewId || !userId) {
    return { interview: null, isAuthorized: false, error: 'Unauthenticated or missing interview ID' };
  }

  const { data, error } = await supabase
    .from('interviews')
    .select('*')
    .eq('id', interviewId)
    .maybeSingle();

  if (error) {
    console.error('[interviewService] Error fetching interview by ID:', error);
    return { interview: null, isAuthorized: false, error: error.message };
  }

  if (!data) {
    return { interview: null, isAuthorized: false, error: 'Interview session not found' };
  }

  // Strictly enforce authorization: user must be either candidate or interviewer
  const isCandidate = data.candidate_id === userId;
  const isInterviewer = data.interviewer_id === userId;

  if (!isCandidate && !isInterviewer) {
    return {
      interview: null,
      isAuthorized: false,
      error: 'You are not a participant in this interview.',
    };
  }

  return {
    interview: data,
    isAuthorized: true,
    userRoleInInterview: isInterviewer ? 'interviewer' : 'candidate',
    error: null,
  };
}

// Fetch interview by Join Code with participant authorization verification
export async function getInterviewByJoinCode(joinCode, userId) {
  if (!isSupabaseConfigured || !supabase || !joinCode || !userId) {
    throw new Error('Missing join code or authentication');
  }

  const normalizedCode = joinCode.trim().toUpperCase();

  // 1. Prefer secure database RPC: join_interview_by_code
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('join_interview_by_code', {
      p_join_code: normalizedCode,
    });

    if (!rpcError && rpcData?.success) {
      return {
        interview: rpcData.interview,
        userRoleInInterview: rpcData.userRole,
      };
    }

    if (rpcError) {
      console.warn('[interviewService] RPC join_interview_by_code error, falling back if not found:', rpcError.message);
      if (!rpcError.message.includes('function') && !rpcError.message.includes('does not exist')) {
        throw new Error(rpcError.message);
      }
    }
  } catch (err) {
    if (!err.message.includes('function') && !err.message.includes('does not exist')) {
      throw err;
    }
  }

  // 2. Direct query fallback
  const { data, error } = await supabase
    .from('interviews')
    .select('*')
    .eq('join_code', normalizedCode)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error('Invalid join code: No interview matches this code.');
  }

  if (data.status !== 'waiting' && data.status !== 'active') {
    throw new Error(`Interview session is no longer joinable (Status: ${data.status}).`);
  }

  // Authorization check
  const isCandidate = data.candidate_id === userId;
  const isInterviewer = data.interviewer_id === userId;

  if (!isCandidate && !isInterviewer) {
    throw new Error('Unauthorized: You are not a registered participant in this interview session.');
  }

  return {
    interview: data,
    userRoleInInterview: isInterviewer ? 'interviewer' : 'candidate',
  };
}

// Update interview status (waiting -> active -> completed/cancelled)
export async function updateInterviewStatus(interviewId, newStatus, userId) {
  if (!supabase || !interviewId) throw new Error('Missing interview ID');

  const updates = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };

  if (newStatus === 'active') {
    updates.start_time = new Date().toISOString();
  } else if (newStatus === 'completed' || newStatus === 'cancelled') {
    updates.completion_time = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('interviews')
    .update(updates)
    .eq('id', interviewId)
    .select()
    .single();

  if (error) {
    console.error('[interviewService] Error updating status:', error);
    throw error;
  }

  return data;
}

// Persist code and language state to the interview record
export async function updateInterviewCode(interviewId, code, language) {
  if (!supabase || !interviewId) return;

  const { data, error } = await supabase
    .from('interviews')
    .update({
      code,
      language,
      updated_at: new Date().toISOString(),
    })
    .eq('id', interviewId)
    .select()
    .single();

  if (error) {
    console.error('[interviewService] Error updating code state:', error);
    throw error;
  }

  return data;
}

/**
 * Fetch genuinely ACTIVE live sessions across the platform.
 * Read-only metadata: interviewer name, candidate name, start time, duration, status.
 * Excludes private code and evaluation data.
 */
export async function fetchLiveSessions() {
  // 1. Try backend server endpoint (privileged service role query)
  try {
    const apiBase = getApiBaseUrl();
    const res = await fetch(`${apiBase}/interviews/live-sessions`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.liveSessions)) {
        return data.liveSessions;
      }
    }
  } catch (err) {
    console.warn('[interviewService] Backend live-sessions fetch failed, trying Supabase fallback:', err.message);
  }

  // 2. Direct Supabase RPC or query fallback
  if (supabase) {
    try {
      // First try the secure helper RPC function
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_active_live_sessions');
      if (!rpcError && Array.isArray(rpcData)) {
        return rpcData.map(i => ({
          id: i.id,
          interviewerId: i.interviewer_id,
          interviewerName: i.interviewer_name || 'Interviewer',
          candidateId: i.candidate_id,
          candidateName: i.candidate_name || 'Candidate',
          interviewType: i.interview_type || 'Technical',
          difficulty: i.difficulty || 'Medium',
          startTime: i.start_time,
          duration: i.duration || 60,
          status: 'IN SESSION'
        }));
      }

      // Fallback to table SELECT via the newly created metadata RLS policy
      const { data, error } = await supabase
        .from('interviews')
        .select('id, interviewer_id, interviewer_name, candidate_id, candidate_name, interview_type, difficulty, start_time, duration, status')
        .eq('status', 'active')
        .order('start_time', { ascending: false });

      if (!error && data) {
        return data.map(i => ({
          id: i.id,
          interviewerId: i.interviewer_id,
          interviewerName: i.interviewer_name || 'Interviewer',
          candidateId: i.candidate_id,
          candidateName: i.candidate_name || 'Candidate',
          interviewType: i.interview_type || 'Technical',
          difficulty: i.difficulty || 'Medium',
          startTime: i.start_time,
          duration: i.duration || 60,
          status: 'IN SESSION'
        }));
      }
    } catch (dbErr) {
      console.error('[interviewService] Supabase fallback live sessions error:', dbErr);
    }
  }

  return [];
}

/**
 * Subscribes to Supabase Realtime changes for active live sessions.
 * Triggers callback immediately when an interview becomes active or completes.
 */
export function subscribeToLiveSessions(onUpdate) {
  if (!supabase || typeof onUpdate !== 'function') return () => {};

  const channel = supabase
    .channel('public_live_sessions_realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'interviews',
      },
      (payload) => {
        // 1. Immediate optimistic reconciliation on DELETE or status change away from active
        if (payload.eventType === 'DELETE' && payload.old?.id) {
          onUpdate((prev) => (Array.isArray(prev) ? prev.filter((s) => s.id !== payload.old.id) : []));
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          if (payload.new.status !== 'active') {
            onUpdate((prev) => (Array.isArray(prev) ? prev.filter((s) => s.id !== payload.new.id) : []));
          }
        }

        // 2. Authoritative query re-sync from get_active_live_sessions RPC
        fetchLiveSessions().then((sessions) => {
          onUpdate(sessions);
        });
      }
    )
    .subscribe();

  // Periodic polling fallback (every 10s)
  const pollInterval = setInterval(() => {
    fetchLiveSessions().then((sessions) => onUpdate(sessions));
  }, 10000);

  return () => {
    if (channel) supabase.removeChannel(channel);
    clearInterval(pollInterval);
  };
}
