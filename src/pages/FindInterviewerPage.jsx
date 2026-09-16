import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAvailableInterviewers, createInterviewRequest } from '../services/discoveryService';
import { useLiveInterviewerPresence } from '../hooks/usePresence';
import { hasResume } from '../services/resumeService';
import { fetchLiveSessions, subscribeToLiveSessions } from '../services/interviewService';
import { supabase } from '../lib/supabase';
import { 
  Users, 
  Star, 
  ArrowLeft, 
  RotateCw, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Send, 
  Clock, 
  Briefcase, 
  User,
  Sparkles,
  FileText,
  Play,
  Calendar,
  X,
  XCircle
} from 'lucide-react';


/**
 * Format live countdown down to the second.
 * Never returns negative values.
 */
function formatLiveCountdown(targetMs, nowMs) {
  const diff = targetMs - nowMs;
  if (diff <= 0) return '00:00:00';
  const totalSecs = Math.floor(diff / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;
  const pad = (n) => String(n).padStart(2, '0');

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${pad(remHours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Format scheduled timestamp into friendly date/time representation.
 */
function formatScheduledDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tmrw = new Date();
  tmrw.setDate(tmrw.getDate() + 1);
  const isTomorrow = d.toDateString() === tmrw.toDateString();

  const timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });

  if (isToday) return `Today, ${timeStr}`;
  if (isTomorrow) return `Tomorrow, ${timeStr}`;
  return `${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}, ${timeStr}`;
}

export default function FindInterviewerPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [interviewers, setInterviewers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedInterviewer, setSelectedInterviewer] = useState(null);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState('');
  const [error, setError] = useState('');
  const [candidateHasResume, setCandidateHasResume] = useState(true);
  const [candidateRequests, setCandidateRequests] = useState([]);
  const [candidateInterviews, setCandidateInterviews] = useState([]);
  const [activeLiveSessions, setActiveLiveSessions] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [now, setNow] = useState(Date.now());
  const prevCandidateStateRef = useRef({ initialized: false, requests: [], interviews: [] });
  const notifiedReadySetRef = useRef(new Set());

  // Active 1-second interval timer for live client-side countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const addToast = (toast) => {
    const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 7000);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Live Supabase Presence subscription
  const livePresenceMap = useLiveInterviewerPresence();

  useEffect(() => {
    if (user?.id) {
      hasResume(user.id).then((ok) => setCandidateHasResume(ok));
      loadCandidateState();
    }
  }, [user?.id]);

  const loadCandidateState = async () => {
    if (!user?.id) return;
    try {
      const { data: reqs } = await supabase
        .from('interview_requests')
        .select('id, candidate_id, interviewer_id, status, interview_id, join_code, created_at, responded_at')
        .eq('candidate_id', user.id)
        .order('created_at', { ascending: false });

      const { data: ints } = await supabase
        .from('interviews')
        .select('id, candidate_id, interviewer_id, interviewer_name, status, start_time, duration, join_code, created_at, updated_at')
        .eq('candidate_id', user.id)
        .in('status', ['waiting', 'scheduled', 'active'])
        .order('created_at', { ascending: false });

      const currentReqs = reqs || [];
      const currentInts = ints || [];

      // Detect realtime status transitions and dispatch in-app notifications
      const prevState = prevCandidateStateRef.current;
      if (prevState.initialized) {
        currentReqs.forEach((newReq) => {
          const oldReq = prevState.requests.find((r) => r.id === newReq.id);
          const interviewerObj = interviewers.find((i) => i.id === newReq.interviewer_id);
          const intName = interviewerObj?.full_name || 'Interviewer';

          if (oldReq && oldReq.status === 'pending' && newReq.status === 'accepted') {
            addToast({
              type: 'success',
              title: 'Interview Accepted',
              message: `✓ ${intName} accepted your interview request. Waiting for the interviewer to schedule the interview.`,
            });
          } else if (oldReq && oldReq.status === 'pending' && newReq.status === 'declined') {
            addToast({
              type: 'warning',
              title: 'Request Declined',
              message: `✕ ${intName} was unable to accept your interview request.`,
            });
          }
        });

        currentInts.forEach((newInt) => {
          const oldInt = prevState.interviews.find((i) => i.id === newInt.id);
          const intName = newInt.interviewer_name || 'Interviewer';

          if (newInt.start_time && (!oldInt || !oldInt.start_time || oldInt.start_time !== newInt.start_time)) {
            const dateFormatted = formatScheduledDate(newInt.start_time);
            addToast({
              type: 'info',
              title: 'Interview Scheduled',
              message: `📅 ${intName} scheduled your interview for ${dateFormatted}.`,
            });
          }
        });
      }

      prevCandidateStateRef.current = {
        initialized: true,
        requests: currentReqs,
        interviews: currentInts,
      };

      setCandidateRequests(currentReqs);
      setCandidateInterviews(currentInts);
    } catch (err) {
      console.warn('[FindInterviewerPage] Error loading candidate state:', err);
    }
  };

  const loadInterviewers = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    setError('');

    try {
      const { data, error: fetchError } = await getAvailableInterviewers();
      if (fetchError) throw fetchError;
      setInterviewers(data || []);
      await loadCandidateState();
    } catch (err) {
      console.error('[FindInterviewerPage] Failed to fetch interviewers:', err);
      setError('Could not load live interviewers from the database. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadInterviewers();

    fetchLiveSessions().then(sessions => setActiveLiveSessions(sessions));
    const unsubscribe = subscribeToLiveSessions((updaterOrSessions) => {
      if (typeof updaterOrSessions === 'function') {
        setActiveLiveSessions(updaterOrSessions);
      } else if (Array.isArray(updaterOrSessions)) {
        setActiveLiveSessions(updaterOrSessions);
      }
    });

    // Realtime channel for candidate's own interviews & requests so completed/updated sessions sync immediately
    let candidateIntChannel = null;
    if (supabase && user?.id) {
      candidateIntChannel = supabase
        .channel(`find_interviewer_candidate_${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'interviews',
            filter: `candidate_id=eq.${user.id}`,
          },
          () => {
            loadCandidateState();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'interview_requests',
            filter: `candidate_id=eq.${user.id}`,
          },
          () => {
            loadCandidateState();
          }
        )
        .subscribe();
    }

    return () => {
      unsubscribe();
      if (candidateIntChannel) supabase.removeChannel(candidateIntChannel);
    };
  }, [user?.id]);

  // Authoritative Session-Aware Status Check:
  // Checks activeLiveSessions (from get_active_live_sessions RPC), candidate's own interviews,
  // interviewer discovery active flag, and live presence.
  const getInterviewerStatus = (interviewer) => {
    // 1. Active session in activeLiveSessions (matches interviewerId or interviewer_id)
    const activeSession = activeLiveSessions.find(
      (s) => s.interviewerId === interviewer.id || s.interviewer_id === interviewer.id
    );

    // 2. Candidate's own active interview with this interviewer
    const candidateActiveInterview = candidateInterviews.find(
      (i) => i.interviewer_id === interviewer.id && i.status === 'active'
    );

    // 3. Interviewer marked busy from discovery service or live presence
    const isSessionActive = Boolean(
      activeSession ||
      candidateActiveInterview ||
      interviewer.isBusy ||
      livePresenceMap[interviewer.id]?.status === 'busy'
    );

    const live = livePresenceMap[interviewer.id];
    const isOnline = live?.status === 'available' || live?.status === 'busy' || interviewer.is_available;

    if (isSessionActive) {
      return {
        label: isOnline ? 'Online · In Session' : 'In Session',
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.15)',
        state: 'busy',
        activeSession: activeSession || (candidateActiveInterview ? {
          id: candidateActiveInterview.id,
          interviewerId: interviewer.id,
          candidateId: user?.id,
          candidateName: profile?.full_name || user?.email,
        } : null),
      };
    }

    if (isOnline) {
      return { label: 'Online · Available', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', state: 'available' };
    }

    return { label: 'Offline', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', state: 'offline' };
  };

  const handleOpenRequestModal = (interviewer) => {
    if (!candidateHasResume) {
      setError('Please upload your resume in your profile before requesting a live interview.');
      return;
    }
    setSelectedInterviewer(interviewer);
    setRequestSuccess('');
    setError('');
  };

  const handleSendRequest = async () => {
    if (!user || !selectedInterviewer) return;

    setSendingRequest(true);
    setError('');
    setRequestSuccess('');

    try {
      const created = await createInterviewRequest({
        candidateId: user.id,
        interviewerId: selectedInterviewer.id,
        candidateName: profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Candidate',
        candidateEmail: user.email,
        candidateSocials: {
          github: profile?.github || null,
          linkedin: profile?.linkedin || null,
          portfolio: profile?.portfolio || null,
        },
      });

      // Update local state immediately
      setCandidateRequests((prev) => [...prev, created]);
      setRequestSuccess(`Interview request successfully sent to ${selectedInterviewer.full_name}! Waiting for their response.`);
      setSelectedInterviewer(null);
    } catch (err) {
      console.error('[FindInterviewerPage] Request failed:', err);
      setError(err.message || 'Failed to submit interview request.');
    } finally {
      setSendingRequest(false);
    }
  };

  // When scheduled time arrives, dispatch notification if not already notified
  useEffect(() => {
    candidateInterviews.forEach((intItem) => {
      if (intItem.status === 'waiting' && intItem.start_time) {
        const startTimeMs = new Date(intItem.start_time).getTime();
        if (startTimeMs <= now && !notifiedReadySetRef.current.has(intItem.id)) {
          notifiedReadySetRef.current.add(intItem.id);
          addToast({
            type: 'success',
            title: 'Interview Ready',
            message: `🟢 Your interview with ${intItem.interviewer_name || 'your interviewer'} is starting now.`,
          });
        }
      }
    });
  }, [now, candidateInterviews]);

  return (
    <div className="container" style={{ padding: '3rem 1.5rem', maxWidth: '1080px' }}>
      {/* Realtime Floating Toast Notifications */}
      {toasts.length > 0 && (
        <div style={{
          position: 'fixed',
          top: '1.5rem',
          right: '1.5rem',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          maxWidth: '420px',
          width: 'calc(100% - 3rem)',
        }}>
          {toasts.map((t) => (
            <div
              key={t.id}
              className="card"
              style={{
                background: '#0d1322',
                border: t.type === 'success' ? '1px solid #10b981' : t.type === 'info' ? '1px solid #6366f1' : '1px solid #f59e0b',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6)',
                padding: '0.85rem 1.15rem',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
              }}
            >
              <div style={{ marginTop: '0.15rem', color: t.type === 'success' ? '#34d399' : t.type === 'info' ? '#818cf8' : '#fbbf24' }}>
                {t.type === 'success' ? <CheckCircle2 size={18} /> : t.type === 'info' ? <Calendar size={18} /> : <AlertCircle size={18} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {t.title && <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f9fafb', marginBottom: '0.15rem' }}>{t.title}</div>}
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{t.message}</div>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.1rem' }}
                title="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <Link to="/candidate/dashboard" className="btn btn-outline btn-sm" style={{ marginBottom: '0.75rem', display: 'inline-flex' }}>
            <ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </Link>
          <h1 style={{ fontSize: '2.2rem', marginBottom: '0.25rem' }}>Available Live Interviewers</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Only verified peer interviewers currently marked online in Supabase are displayed below.
          </p>
        </div>

        <button
          onClick={() => loadInterviewers(true)}
          disabled={refreshing}
          className="btn btn-secondary btn-sm"
          title="Refresh available interviewers"
        >
          <RotateCw size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh List'}</span>
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {requestSuccess && (
        <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
          <CheckCircle2 size={18} style={{ color: '#10b981', flexShrink: 0 }} />
          <span>{requestSuccess}</span>
        </div>
      )}

      {/* Interviewers Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-secondary)' }}>
          <RotateCw size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem auto' }} />
          <p>Querying available interviewers from database...</p>
        </div>
      ) : interviewers.length === 0 ? (
        /* Strict No Fake Fallback Empty State */
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <Users size={48} color="var(--border-subtle)" style={{ margin: '0 auto 1rem auto' }} />
          <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>No Interviewers Currently Available</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '520px', margin: '0 auto 1.5rem auto', fontSize: '0.95rem' }}>
            No peer interviewers are currently set to Available in the database. You can practice with our AI engine immediately, or check back in a few moments.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button onClick={() => loadInterviewers(true)} className="btn btn-secondary btn-sm">
              <RotateCw size={15} />
              <span>Check Again</span>
            </button>
            <Link to="/candidate/dashboard" className="btn btn-primary btn-sm">
              <Sparkles size={15} />
              <span>Practice with AI</span>
            </Link>
          </div>
        </div>
      ) : (
        <>
          {!candidateHasResume && (
            <div
              className="alert alert-warning"
              style={{
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                padding: '1rem 1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <FileText size={20} color="#f59e0b" style={{ flexShrink: 0 }} />
                <div>
                  <strong style={{ color: '#f59e0b' }}>Resume Required</strong>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem' }}>
                    Please upload your resume before requesting a live interview so peer interviewers can review your background.
                  </p>
                </div>
              </div>
              <Link to="/profile" className="btn btn-primary btn-sm">
                Upload Resume
              </Link>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {interviewers.map((interviewer) => {
              const status = getInterviewerStatus(interviewer);
              const isReady = status.state === 'available';

              return (
                <div
                  key={interviewer.id}
                  className="card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    borderTop: `3px solid ${status.color}`,
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      {interviewer.avatar_url ? (
                        <img
                          src={interviewer.avatar_url}
                          alt={interviewer.full_name}
                          style={{
                            width: '46px',
                            height: '46px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '2px solid rgba(6, 182, 212, 0.4)',
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '46px',
                            height: '46px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.2rem',
                            fontWeight: 700,
                            flexShrink: 0,
                            border: '2px solid rgba(6, 182, 212, 0.3)',
                          }}
                        >
                          {(interviewer.full_name || 'I').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                          {interviewer.full_name}
                        </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '9999px',
                            backgroundColor: status.bg,
                            color: status.color,
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: status.color, display: 'inline-block' }}></span>
                          {status.label}
                        </span>

                        {interviewer.averageRating ? (
                          <span style={{ fontSize: '0.8rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <Star size={13} fill="#f59e0b" color="#f59e0b" />
                            <strong>{interviewer.averageRating}</strong> ({interviewer.reviewCount})
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>New Interviewer</span>
                        )}
                      </div>
                    </div>
                    </div>
                  </div>

                  {/* Headline / Bio & Experience */}
                  {interviewer.headline && (
                    <div style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--accent-secondary)' }}>
                      {interviewer.headline}
                    </div>
                  )}

                  {interviewer.bio ? (
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5', flex: 1, margin: 0 }}>
                      "{interviewer.bio}"
                    </p>
                  ) : (
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic', flex: 1, margin: 0 }}>
                      Experienced software engineer ready to conduct live mock interviews.
                    </p>
                  )}

                  {/* Skills Tags */}
                  {interviewer.skills && interviewer.skills.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      {interviewer.skills.slice(0, 4).map((skill, idx) => (
                        <span key={idx} className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Social Links */}
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.8rem', flexWrap: 'wrap' }}>
                    {interviewer.github && (
                      <a href={interviewer.github.startsWith('http') ? interviewer.github : `https://${interviewer.github}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span>GitHub</span>
                        <ExternalLink size={12} />
                      </a>
                    )}
                    {interviewer.linkedin && (
                      <a href={interviewer.linkedin.startsWith('http') ? interviewer.linkedin : `https://${interviewer.linkedin}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span>LinkedIn</span>
                        <ExternalLink size={12} />
                      </a>
                    )}
                    {interviewer.portfolio && (
                      <a href={interviewer.portfolio.startsWith('http') ? interviewer.portfolio : `https://${interviewer.portfolio}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span>Portfolio</span>
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>

                  <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
                    {(() => {
                      const requestsForThisInterviewer = candidateRequests.filter(
                        (r) => r.interviewer_id === interviewer.id
                      );
                      const latestReq = requestsForThisInterviewer.sort(
                        (a, b) => new Date(b.created_at) - new Date(a.created_at)
                      )[0];

                      const existingInterview = candidateInterviews.find(
                        (i) => i.interviewer_id === interviewer.id && ['scheduled', 'waiting', 'active'].includes(i.status)
                      );

                      const activeSession = status.activeSession;
                      const isCurrentCandidateActive = Boolean(
                        (existingInterview && existingInterview.status === 'active') ||
                        (activeSession && (activeSession.candidateId === user?.id || activeSession.candidate_id === user?.id))
                      );

                      // CASE 1: Current Candidate who sent the request and has the active interview session
                      if (isCurrentCandidateActive) {
                        const targetInterviewId = existingInterview?.id || activeSession?.id;
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', width: '100%' }}>
                            <div style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                              <span>Interview in Session</span>
                            </div>
                            <Link
                              to={`/interview/${targetInterviewId}`}
                              className="btn btn-primary btn-sm"
                              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontWeight: 700 }}
                            >
                              <Play size={14} />
                              <span>Enter Interview</span>
                            </Link>
                          </div>
                        );
                      }

                      // 2. Waiting Interview (Accepted by Interviewer)
                      if (existingInterview && existingInterview.status === 'waiting') {
                        const startTimeMs = existingInterview.start_time ? new Date(existingInterview.start_time).getTime() : null;
                        const isScheduledTime = startTimeMs !== null && !isNaN(startTimeMs);
                        const isReady = isScheduledTime && startTimeMs <= now;

                        // A. Scheduled time has arrived (Countdown reached 00:00:00)
                        if (isReady) {
                          return (
                            <div style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.5rem',
                              width: '100%',
                              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(99, 102, 241, 0.1) 100%)',
                              border: '1px solid rgba(16, 185, 129, 0.5)',
                              boxShadow: '0 0 16px rgba(16, 185, 129, 0.2)',
                              borderRadius: 'var(--radius-md)',
                              padding: '0.75rem',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ fontSize: '0.82rem', color: '#34d399', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                                  <span>🟢 Interview Ready</span>
                                </div>
                                <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Starting Now</span>
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#e2e8f0', lineHeight: 1.4 }}>
                                Your interview with <strong>{interviewer.full_name}</strong> is ready.
                              </div>
                              <Link
                                to={`/interview/${existingInterview.id}`}
                                className="btn btn-primary btn-sm"
                                style={{
                                  width: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.4rem',
                                  fontWeight: 700,
                                  boxShadow: '0 0 12px rgba(99, 102, 241, 0.4)',
                                }}
                              >
                                <Play size={14} />
                                <span>Join Interview</span>
                              </Link>
                            </div>
                          );
                        }

                        // B. Scheduled in future with live countdown
                        if (isScheduledTime) {
                          const remainingCountdown = formatLiveCountdown(startTimeMs, now);
                          const formattedDateStr = formatScheduledDate(existingInterview.start_time);

                          return (
                            <div style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.5rem',
                              width: '100%',
                              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(99, 102, 241, 0.08) 100%)',
                              border: '1px solid rgba(168, 85, 247, 0.45)',
                              borderRadius: 'var(--radius-md)',
                              padding: '0.75rem',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.25rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#d8b4fe', fontSize: '0.8rem', fontWeight: 800 }}>
                                  <Calendar size={14} />
                                  <span>📅 Interview Scheduled</span>
                                </div>
                                <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#d8b4fe', border: '1px solid rgba(168, 85, 247, 0.3)', fontSize: '0.65rem' }}>
                                  Scheduled
                                </span>
                              </div>

                              <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                                Interview with <strong style={{ color: '#f9fafb' }}>{interviewer.full_name}</strong>
                                <div style={{ color: '#c084fc', fontWeight: 600, marginTop: '0.15rem' }}>
                                  {formattedDateStr}
                                </div>
                              </div>

                              {/* Live Countdown Display */}
                              <div style={{
                                background: 'rgba(0,0,0,0.35)',
                                border: '1px solid rgba(168, 85, 247, 0.3)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '0.4rem 0.65rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}>
                                <span style={{ fontSize: '0.7rem', color: '#a855f7', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  Starts in
                                </span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 800, color: '#e9d5ff' }}>
                                  {remainingCountdown}
                                </span>
                              </div>

                              {/* Join Disabled Until Start Time */}
                              <button
                                disabled
                                className="btn btn-secondary btn-sm"
                                style={{
                                  width: '100%',
                                  opacity: 0.75,
                                  cursor: 'not-allowed',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.4rem',
                                  fontSize: '0.78rem',
                                }}
                                title="Join will become available when the interview starts."
                              >
                                <Clock size={13} />
                                <span>Join will become available at start</span>
                              </button>
                            </div>
                          );
                        }

                        // C. Accepted but not yet scheduled by interviewer
                        return (
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.45rem',
                            width: '100%',
                            background: 'rgba(16, 185, 129, 0.08)',
                            border: '1px solid rgba(16, 185, 129, 0.35)',
                            borderRadius: 'var(--radius-md)',
                            padding: '0.75rem',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#34d399', fontSize: '0.8rem', fontWeight: 800 }}>
                                <CheckCircle2 size={14} />
                                <span>✓ Interview Accepted</span>
                              </div>
                              <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Accepted</span>
                            </div>
                            <div style={{ fontSize: '0.73rem', color: '#94a3b8', lineHeight: 1.45 }}>
                              Interview request accepted by <strong style={{ color: '#f9fafb' }}>{interviewer.full_name}</strong>. Waiting for the interviewer to schedule the interview.
                            </div>
                            <button
                              disabled
                              className="btn btn-secondary btn-sm"
                              style={{ width: '100%', opacity: 0.8, cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.78rem' }}
                            >
                              <Clock size={13} color="#34d399" />
                              <span>Awaiting Interviewer Schedule...</span>
                            </button>
                          </div>
                        );
                      }

                      // 3. Request is Pending (Awaiting Interviewer Acceptance)
                      if (latestReq && latestReq.status === 'pending') {
                        return (
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.45rem',
                            width: '100%',
                            background: 'rgba(245, 158, 11, 0.06)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            borderRadius: 'var(--radius-md)',
                            padding: '0.75rem',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#fbbf24', fontSize: '0.8rem', fontWeight: 800 }}>
                                <Clock size={14} />
                                <span>🕐 Request Pending</span>
                              </div>
                              <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>Pending</span>
                            </div>
                            <div style={{ fontSize: '0.73rem', color: '#94a3b8', lineHeight: 1.45 }}>
                              Interview request sent to <strong style={{ color: '#f9fafb' }}>{interviewer.full_name}</strong>. Waiting for their response.
                            </div>
                            <button
                              disabled
                              className="btn btn-secondary btn-sm"
                              style={{ width: '100%', opacity: 0.85, cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', border: '1px solid rgba(245, 158, 11, 0.4)', color: '#fbbf24', fontSize: '0.78rem' }}
                            >
                              <Clock size={13} color="#f59e0b" />
                              <span>Request Pending</span>
                            </button>
                          </div>
                        );
                      }

                      // CASE 2: Other Candidates (Interviewer is in session with someone else)
                      if (status.state === 'busy') {
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%' }}>
                            <button
                              disabled
                              className="btn btn-outline btn-sm"
                              style={{
                                width: '100%',
                                opacity: 0.8,
                                cursor: 'not-allowed',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.4rem',
                                border: '1px solid rgba(245, 158, 11, 0.4)',
                                color: '#f59e0b',
                                background: 'rgba(245, 158, 11, 0.06)',
                              }}
                            >
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b' }} />
                              <span>Interviewer in Session</span>
                            </button>
                          </div>
                        );
                      }

                      // 4. Request was Rejected / Declined
                      if (latestReq && latestReq.status === 'declined') {
                        return (
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.45rem',
                            width: '100%',
                            background: 'rgba(239, 68, 68, 0.06)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: 'var(--radius-md)',
                            padding: '0.75rem',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#f87171', fontSize: '0.8rem', fontWeight: 800 }}>
                                <XCircle size={14} />
                                <span>✕ Request Rejected</span>
                              </div>
                              <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>Declined</span>
                            </div>
                            <div style={{ fontSize: '0.73rem', color: '#94a3b8', lineHeight: 1.45 }}>
                              Interviewer was unable to accept your previous request. You can request again.
                            </div>
                            <button
                              onClick={() => handleOpenRequestModal(interviewer)}
                              disabled={sendingRequest}
                              className="btn btn-outline btn-sm"
                              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                            >
                              <RotateCw size={13} />
                              <span>Request Again</span>
                            </button>
                          </div>
                        );
                      }

                      // 5. Request was Cancelled
                      if (latestReq && latestReq.status === 'cancelled') {
                        return (
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.45rem',
                            width: '100%',
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-md)',
                            padding: '0.75rem',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Request Cancelled</span>
                              <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>Cancelled</span>
                            </div>
                            <button
                              onClick={() => handleOpenRequestModal(interviewer)}
                              disabled={sendingRequest}
                              className="btn btn-outline btn-sm"
                              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                            >
                              <RotateCw size={13} />
                              <span>Request Again</span>
                            </button>
                          </div>
                        );
                      }

                      // 6. No Prior Request -> Standard Availability Check
                      if (!candidateHasResume) {
                        return (
                          <Link
                            to="/profile"
                            className="btn btn-outline btn-sm"
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.3)' }}
                          >
                            <FileText size={14} />
                            <span>Upload Resume First</span>
                          </Link>
                        );
                      }

                      if (status.state === 'available') {
                        return (
                          <button
                            onClick={() => handleOpenRequestModal(interviewer)}
                            disabled={sendingRequest}
                            className="btn btn-primary btn-sm"
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                          >
                            <Send size={14} />
                            <span>Request Interview</span>
                          </button>
                        );
                      }



                      return (
                        <button
                          disabled
                          className="btn btn-outline btn-sm"
                          style={{ width: '100%', opacity: 0.5, cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                        >
                          <span>Offline</span>
                        </button>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Confirmation Modal */}
      {selectedInterviewer && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1.5rem'
        }}>
          <div className="card" style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.35rem', marginBottom: '0.5rem' }}>Confirm Interview Request</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Send an interview request to <strong>{selectedInterviewer.full_name}</strong>. They will be notified in real-time.
            </p>

            <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
              <div style={{ marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Candidate: </span>
                <strong>{profile?.full_name || user?.email}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Interviewer: </span>
                <strong>{selectedInterviewer.full_name} ({selectedInterviewer.email})</strong>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                onClick={() => setSelectedInterviewer(null)}
                disabled={sendingRequest}
                className="btn btn-outline btn-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSendRequest}
                disabled={sendingRequest}
                className="btn btn-primary btn-sm"
              >
                <Send size={15} />
                <span>{sendingRequest ? 'Submitting Request...' : 'Send Request'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
