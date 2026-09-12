import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { 
  getCandidateInterviews, 
  getCandidateRequests, 
  getCandidateRank, 
  calculateCandidateStats,
  cancelInterviewRequest
} from '../services/candidateService';

export function useCandidateDashboard() {
  const { user } = useAuth();

  const [interviews, setInterviews] = useState([]);
  const [requests, setRequests] = useState([]);
  const [rank, setRank] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadData = useCallback(async (showRefreshing = false) => {
    if (!user?.id || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    if (showRefreshing) setRefreshing(true);

    try {
      const [interviewsRes, requestsRes, rankRes] = await Promise.all([
        getCandidateInterviews(user.id),
        getCandidateRequests(user.id),
        getCandidateRank(user.id),
      ]);

      if (interviewsRes.error) setError(interviewsRes.error.message);
      if (requestsRes.error) setError(requestsRes.error.message);

      setInterviews(interviewsRes.data || []);
      setRequests(requestsRes.data || []);
      setRank(rankRes.rank);
    } catch (err) {
      console.error('[useCandidateDashboard] Data load error:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();

    if (!user?.id || !supabase || !isSupabaseConfigured) return;

    // Set up Realtime listener for interview_requests
    const requestsChannel = supabase
      .channel(`candidate_requests_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'interview_requests',
          filter: `candidate_id=eq.${user.id}`,
        },
        () => {
          loadData(true);
        }
      )
      .subscribe();

    // Set up Realtime listener for interviews
    const interviewsChannel = supabase
      .channel(`candidate_interviews_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'interviews',
          filter: `candidate_id=eq.${user.id}`,
        },
        () => {
          loadData(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(requestsChannel);
      supabase.removeChannel(interviewsChannel);
    };
  }, [user?.id, loadData]);

  const handleCancelRequest = async (requestId) => {
    if (!user?.id) return;
    try {
      await cancelInterviewRequest(requestId, user.id);
      await loadData(true);
    } catch (err) {
      console.error('[useCandidateDashboard] Failed to cancel request:', err);
      throw err;
    }
  };

  const stats = calculateCandidateStats(interviews, requests);

  return {
    interviews,
    requests,
    stats,
    rank,
    loading,
    refreshing,
    error,
    refresh: () => loadData(true),
    cancelRequest: handleCancelRequest,
  };
}
