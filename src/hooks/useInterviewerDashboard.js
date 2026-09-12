import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { 
  getInterviewerRequests, 
  getInterviewerInterviews, 
  getInterviewerReviews, 
  updateAvailability, 
  acceptInterviewRequest, 
  declineInterviewRequest,
  calculateReviewsSummary
} from '../services/interviewerService';

export function useInterviewerDashboard() {
  const { user, profile, updateProfile } = useAuth();

  const [requests, setRequests] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadData = useCallback(async (showRefreshing = false) => {
    if (!user?.id || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    if (showRefreshing) setRefreshing(true);

    try {
      const [requestsRes, interviewsRes, reviewsRes] = await Promise.all([
        getInterviewerRequests(user.id),
        getInterviewerInterviews(user.id),
        getInterviewerReviews(user.id),
      ]);

      if (requestsRes.error) setError(requestsRes.error.message);
      if (interviewsRes.error) setError(interviewsRes.error.message);
      if (reviewsRes.error) setError(reviewsRes.error.message);

      setRequests(requestsRes.data || []);
      setInterviews(interviewsRes.data || []);
      setReviews(reviewsRes.data || []);
    } catch (err) {
      console.error('[useInterviewerDashboard] Data loading error:', err);
      setError(err.message || 'Failed to load interviewer data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();

    if (!user?.id || !supabase || !isSupabaseConfigured) return;

    // Realtime subscription for incoming interview_requests
    const requestsChannel = supabase
      .channel(`interviewer_requests_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'interview_requests',
          filter: `interviewer_id=eq.${user.id}`,
        },
        () => {
          loadData(true);
        }
      )
      .subscribe();

    // Realtime subscription for interviews
    const interviewsChannel = supabase
      .channel(`interviewer_interviews_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'interviews',
          filter: `interviewer_id=eq.${user.id}`,
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

  const handleToggleAvailability = async () => {
    if (!user?.id) return;
    setAvailabilityLoading(true);
    try {
      const newStatus = !profile?.is_available;
      await updateAvailability(user.id, newStatus);
      await updateProfile({ is_available: newStatus });
    } catch (err) {
      console.error('[useInterviewerDashboard] Toggle availability error:', err);
      throw err;
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const handleAcceptRequest = async (request) => {
    if (!user?.id || !request) return;
    try {
      const result = await acceptInterviewRequest({
        requestId: request.id,
        candidateId: request.candidate_id,
        candidateName: request.candidate_name,
        interviewerId: user.id,
        interviewerName: profile?.full_name || 'Interviewer',
      });
      await loadData(true);
      return result;
    } catch (err) {
      console.error('[useInterviewerDashboard] Accept request error:', err);
      throw err;
    }
  };

  const handleDeclineRequest = async (requestId) => {
    if (!user?.id || !requestId) return;
    try {
      await declineInterviewRequest(requestId, user.id);
      await loadData(true);
    } catch (err) {
      console.error('[useInterviewerDashboard] Decline request error:', err);
      throw err;
    }
  };

  const reviewMetrics = calculateReviewsSummary(reviews);

  return {
    requests,
    interviews,
    reviews,
    reviewMetrics,
    isAvailable: Boolean(profile?.is_available),
    loading,
    refreshing,
    availabilityLoading,
    error,
    refresh: () => loadData(true),
    toggleAvailability: handleToggleAvailability,
    acceptRequest: handleAcceptRequest,
    declineRequest: handleDeclineRequest,
  };
}
