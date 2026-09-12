import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useInterviewerDashboard } from '../hooks/useInterviewerDashboard';
import { 
  Users, 
  Video, 
  Star, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  RotateCw, 
  Play, 
  User, 
  ExternalLink, 
  Calendar,
  Award,
  Globe,
  Trophy
} from 'lucide-react';

export default function InterviewerDashboard() {
  const { user, profile } = useAuth();
  const {
    requests,
    interviews,
    reviews,
    reviewMetrics,
    isAvailable,
    loading,
    refreshing,
    availabilityLoading,
    error,
    refresh,
    toggleAvailability,
    acceptRequest,
    declineRequest,
  } = useInterviewerDashboard();

  const [activeTab, setActiveTab] = useState('incoming'); // 'incoming' | 'active' | 'history' | 'reviews'
  const [actionLoading, setActionLoading] = useState(null); // requestId
  const [actionError, setActionError] = useState('');

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Interviewer';

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const acceptedSessions = requests.filter((r) => r.status === 'accepted');
  const activeInterviews = interviews.filter((i) => i.status === 'waiting' || i.status === 'active');
  const completedInterviews = interviews.filter((i) => i.status === 'completed');

  const handleAccept = async (req) => {
    setActionLoading(req.id);
    setActionError('');
    try {
      await acceptRequest(req);
    } catch (err) {
      setActionError(err.message || 'Failed to accept interview request.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (requestId) => {
    setActionLoading(requestId);
    setActionError('');
    try {
      await declineRequest(requestId);
    } catch (err) {
      setActionError(err.message || 'Failed to decline request.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="container" style={{ padding: '3rem 1.5rem' }}>
      {/* Welcome Banner & Availability Controls */}
      <div 
        className="card" 
        style={{ 
          marginBottom: '2rem', 
          background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(99, 102, 241, 0.05) 100%)', 
          border: '1px solid rgba(6, 182, 212, 0.3)' 
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <h1 style={{ fontSize: '2rem' }}>Welcome, {displayName}!</h1>
              <span className="badge badge-success">Interviewer</span>
            </div>
            <p style={{ maxWidth: '640px', fontSize: '0.95rem' }}>
              Conduct technical and DSA mock interviews, evaluate candidate performance, and manage your live availability.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Realtime Availability Switch */}
            <button
              onClick={toggleAvailability}
              disabled={availabilityLoading}
              className={`btn ${isAvailable ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              title="Toggle whether candidates can find and send requests to you"
            >
              <span 
                style={{ 
                  width: 9, 
                  height: 9, 
                  borderRadius: '50%', 
                  background: isAvailable ? '#10b981' : '#ef4444',
                  boxShadow: isAvailable ? '0 0 8px #10b981' : 'none'
                }}
              />
              <span>{isAvailable ? 'Available (Online)' : 'Unavailable (Offline)'}</span>
            </button>

            <button
              onClick={refresh}
              disabled={refreshing}
              className="btn btn-secondary btn-sm"
              title="Refresh requests"
            >
              <RotateCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
            </button>

            <Link to="/leaderboard" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Trophy size={15} color="#f59e0b" />
              <span>Leaderboard</span>
            </Link>
            <Link to="/profile" className="btn btn-secondary btn-sm">
              <User size={15} />
              <span>Profile</span>
            </Link>
          </div>
        </div>
      </div>

      {actionError && (
        <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={18} />
          <span>{actionError}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Incoming Requests</span>
            <Clock size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: pendingRequests.length > 0 ? '#f59e0b' : 'inherit' }}>
            {loading ? '--' : pendingRequests.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {pendingRequests.length > 0 ? 'Pending your decision' : 'No pending requests'}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Active / Accepted</span>
            <Video size={18} color="#38bdf8" />
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800 }}>
            {loading ? '--' : acceptedSessions.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Ready to interview
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Conducted Mocks</span>
            <CheckCircle2 size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800 }}>
            {loading ? '--' : completedInterviews.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Recorded in database
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Interviewer Rating</span>
            <Star size={18} fill="#f59e0b" color="#f59e0b" />
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>{loading ? '--' : (reviewMetrics.averageRating || 'N/A')}</span>
            {reviewMetrics.averageRating && <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/ 5.0</span>}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {reviewMetrics.totalReviews} candidate review{reviewMetrics.totalReviews === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {/* Main Content Tabs */}
      <div className="card" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveTab('incoming')}
              className={`btn btn-sm ${activeTab === 'incoming' ? 'btn-primary' : 'btn-outline'}`}
            >
              <span>Incoming Requests</span>
              {pendingRequests.length > 0 && (
                <span className="badge badge-warning" style={{ marginLeft: 4, padding: '1px 6px' }}>
                  {pendingRequests.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('active')}
              className={`btn btn-sm ${activeTab === 'active' ? 'btn-primary' : 'btn-outline'}`}
            >
              <span>Active Sessions</span>
              {acceptedSessions.length > 0 && (
                <span className="badge badge-success" style={{ marginLeft: 4, padding: '1px 6px' }}>
                  {acceptedSessions.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-outline'}`}
            >
              <span>Conducted History</span>
              {completedInterviews.length > 0 && (
                <span className="badge badge-secondary" style={{ marginLeft: 4, padding: '1px 6px' }}>
                  {completedInterviews.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('reviews')}
              className={`btn btn-sm ${activeTab === 'reviews' ? 'btn-primary' : 'btn-outline'}`}
            >
              <span>Candidate Reviews</span>
              {reviews.length > 0 && (
                <span className="badge badge-secondary" style={{ marginLeft: 4, padding: '1px 6px' }}>
                  {reviews.length}
                </span>
              )}
            </button>
          </div>

          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Realtime updates enabled
          </span>
        </div>

        {/* Tab 1: Incoming Requests */}
        {activeTab === 'incoming' && (
          <div>
            {pendingRequests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-secondary)' }}>
                <Clock size={36} color="var(--border-subtle)" style={{ marginBottom: '0.75rem' }} />
                <p style={{ fontWeight: 600 }}>No incoming interview requests.</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  {isAvailable 
                    ? 'Your status is set to Available. When a candidate requests an interview, it will appear here immediately.'
                    : 'You are currently set to Unavailable. Switch your status above to receive requests.'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {pendingRequests.map((req) => {
                  const candidate = req.candidate || {};
                  return (
                    <div
                      key={req.id}
                      style={{
                        background: 'var(--bg-input)',
                        borderRadius: 'var(--radius-md)',
                        padding: '1.5rem',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                            <span style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                              {req.candidate_name || candidate.full_name || 'Candidate'}
                            </span>
                            <span className="badge badge-warning">Pending Request</span>
                          </div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            {req.candidate_email || candidate.email || 'Email provided on accept'}
                          </div>
                        </div>

                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Requested: {new Date(req.created_at).toLocaleString()}
                        </div>
                      </div>

                      {/* Candidate Profile Details if provided */}
                      {(candidate.bio || candidate.skills?.length > 0 || candidate.github || candidate.linkedin) && (
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.05)' }}>
                          {candidate.bio && (
                            <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                              "{candidate.bio}"
                            </p>
                          )}
                          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            {candidate.skills?.length > 0 && (
                              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                                {candidate.skills.slice(0, 5).map((s, idx) => (
                                  <span key={idx} className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>{s}</span>
                                ))}
                              </div>
                            )}
                            {candidate.github && (
                              <a href={candidate.github.startsWith('http') ? candidate.github : `https://${candidate.github}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <span>GitHub</span>
                                <ExternalLink size={12} />
                              </a>
                            )}
                            {candidate.linkedin && (
                              <a href={candidate.linkedin.startsWith('http') ? candidate.linkedin : `https://${candidate.linkedin}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <span>LinkedIn</span>
                                <ExternalLink size={12} />
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <button
                          onClick={() => handleDecline(req.id)}
                          disabled={actionLoading === req.id}
                          className="btn btn-outline btn-sm"
                          style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
                        >
                          <XCircle size={15} />
                          <span>Decline</span>
                        </button>
                        <button
                          onClick={() => handleAccept(req)}
                          disabled={actionLoading === req.id}
                          className="btn btn-primary btn-sm"
                        >
                          <CheckCircle2 size={15} />
                          <span>{actionLoading === req.id ? 'Creating Session...' : 'Accept Request'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Active / Accepted Sessions */}
        {activeTab === 'active' && (
          <div>
            {acceptedSessions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-secondary)' }}>
                <Video size={36} color="var(--border-subtle)" style={{ marginBottom: '0.75rem' }} />
                <p style={{ fontWeight: 600 }}>No active or accepted interview sessions.</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Accepted candidate requests will show here with a direct link to enter the room.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {acceptedSessions.map((req) => (
                  <div
                    key={req.id}
                    style={{
                      background: 'var(--bg-input)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1.25rem',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1rem'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 700 }}>Candidate: {req.candidate_name}</span>
                        <span className="badge badge-success">Session Ready</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Accepted at: {new Date(req.responded_at || req.created_at).toLocaleString()}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {req.join_code && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', background: 'rgba(255,255,255,0.05)', padding: '0.35rem 0.65rem', borderRadius: 'var(--radius-sm)' }}>
                          Code: {req.join_code}
                        </span>
                      )}
                      {req.interview_id && (
                        <Link to={`/interview/${req.interview_id}`} className="btn btn-primary btn-sm">
                          <Play size={15} />
                          <span>Enter Room</span>
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Conducted History */}
        {activeTab === 'history' && (
          <div>
            {completedInterviews.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-secondary)' }}>
                <CheckCircle2 size={36} color="var(--border-subtle)" style={{ marginBottom: '0.75rem' }} />
                <p style={{ fontWeight: 600 }}>No conducted interviews yet.</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Completed live interviews with your evaluations will be permanently archived here.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {completedInterviews.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: 'var(--bg-input)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1.25rem',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1rem'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                        <span style={{ fontWeight: 700 }}>Candidate: {item.candidate_name}</span>
                        <span className="badge badge-secondary">{item.interview_type}</span>
                        <span className="badge badge-success">Completed</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem' }}>
                        <span>Date: {new Date(item.created_at).toLocaleDateString()}</span>
                        <span>Duration: {item.duration} mins</span>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Assigned Score</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: item.score >= 7 ? '#10b981' : item.score >= 5 ? '#f59e0b' : '#ef4444' }}>
                        {item.score !== null ? `${item.score}/10` : '--'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Reviews Received */}
        {activeTab === 'reviews' && (
          <div>
            {reviews.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-secondary)' }}>
                <Star size={36} color="var(--border-subtle)" style={{ marginBottom: '0.75rem' }} />
                <p style={{ fontWeight: 600 }}>No ratings or reviews received yet.</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  When candidates complete a live mock interview with you, their ratings and verified reviews will appear here.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {reviews.map((rev) => (
                  <div
                    key={rev.id}
                    style={{
                      background: 'var(--bg-input)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1.25rem',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 700 }}>{rev.candidate?.full_name || 'Candidate'}</span>
                        <div style={{ display: 'flex', gap: '2px' }}>
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star 
                              key={s} 
                              size={14} 
                              fill={s <= rev.rating ? '#f59e0b' : 'transparent'} 
                              color={s <= rev.rating ? '#f59e0b' : 'var(--text-muted)'} 
                            />
                          ))}
                        </div>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(rev.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {rev.review_text && (
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        "{rev.review_text}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
