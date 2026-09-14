import React, { useState, useEffect } from 'react';
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
  Play
} from 'lucide-react';

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
        .select('id, interviewer_id, status, created_at')
        .eq('candidate_id', user.id);
      setCandidateRequests(reqs || []);

      const { data: ints } = await supabase
        .from('interviews')
        .select('id, interviewer_id, status, start_time')
        .eq('candidate_id', user.id)
        .in('status', ['waiting', 'scheduled', 'active']);
      setCandidateInterviews(ints || []);
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
    const unsubscribe = subscribeToLiveSessions((sessions) => {
      setActiveLiveSessions(sessions);
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

  // Strict Realtime Presence & Active Interview check:
  // "In Session" requires a genuine active interview in the database
  const getInterviewerStatus = (interviewer) => {
    const activeSession = activeLiveSessions.find(s => s.interviewerId === interviewer.id);
    if (activeSession) {
      return { 
        label: 'In Session', 
        color: '#ef4444', 
        bg: 'rgba(239, 68, 68, 0.15)', 
        state: 'busy',
        activeSession 
      };
    }

    // Never derive "In Session" from online presence or old availability
    const live = livePresenceMap[interviewer.id];
    const isAvailable = live?.status === 'available' || interviewer.is_available;
    if (isAvailable) {
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

  return (
    <div className="container" style={{ padding: '3rem 1.5rem', maxWidth: '1080px' }}>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.2rem' }}>
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
                      const pendingReq = candidateRequests.find(
                        (r) => r.interviewer_id === interviewer.id && r.status === 'pending'
                      );
                      const existingInterview = candidateInterviews.find(
                        (i) => i.interviewer_id === interviewer.id && ['scheduled', 'waiting', 'active'].includes(i.status)
                      );

                      if (existingInterview) {
                        return (
                          <Link
                            to={`/interview/${existingInterview.id}`}
                            className={`btn ${existingInterview.status === 'active' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                          >
                            <Play size={14} />
                            <span>{existingInterview.status === 'active' ? 'Enter My Interview' : 'Scheduled · Enter Room'}</span>
                          </Link>
                        );
                      }

                      if (pendingReq) {
                        return (
                          <button
                            disabled
                            className="btn btn-secondary btn-sm"
                            style={{ width: '100%', opacity: 0.85, cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', border: '1px solid rgba(245, 158, 11, 0.4)', color: '#fbbf24' }}
                          >
                            <Clock size={14} color="#f59e0b" />
                            <span>Request Pending</span>
                          </button>
                        );
                      }

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

                      if (status.state === 'busy') {
                        const isMySession = status.activeSession?.candidateId === user?.id;
                        if (isMySession) {
                          return (
                            <Link
                              to={`/interview/${status.activeSession.id}`}
                              className="btn btn-primary btn-sm"
                              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                            >
                              <Play size={14} />
                              <span>Enter My Interview</span>
                            </Link>
                          );
                        }

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%' }}>
                            {status.activeSession && status.activeSession.candidateName && (
                              <div style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 600, textAlign: 'center' }}>
                                Currently interviewing: {status.activeSession.candidateName}
                              </div>
                            )}
                            <button
                              disabled
                              className="btn btn-outline btn-sm"
                              style={{ width: '100%', opacity: 0.7, cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171' }}
                            >
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444' }} />
                              <span>In Session — Not Available</span>
                            </button>
                          </div>
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
