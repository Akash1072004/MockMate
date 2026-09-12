import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCandidateDashboard } from '../hooks/useCandidateDashboard';
import { 
  Bot, 
  Users, 
  Trophy, 
  User, 
  BarChart3, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Play, 
  RotateCw, 
  Calendar, 
  Video, 
  Code2, 
  ArrowRight,
  ExternalLink,
  XCircle,
  Sparkles,
  FileText
} from 'lucide-react';

export default function CandidateDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { 
    interviews, 
    requests, 
    stats, 
    rank, 
    loading, 
    refreshing, 
    error, 
    refresh, 
    cancelRequest 
  } = useCandidateDashboard();

  const [activeTab, setActiveTab] = useState('accepted'); // 'accepted' | 'pending' | 'history'
  const [actionError, setActionError] = useState('');

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Candidate';

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const acceptedRequests = requests.filter((r) => r.status === 'accepted');
  const completedInterviews = interviews.filter((i) => i.status === 'completed');

  const handleCancel = async (requestId) => {
    setActionError('');
    try {
      await cancelRequest(requestId);
    } catch (err) {
      setActionError(err.message || 'Failed to cancel request.');
    }
  };

  return (
    <div className="container" style={{ padding: '3rem 1.5rem' }}>
      {/* Welcome Banner */}
      <div 
        className="card" 
        style={{ 
          marginBottom: '2rem', 
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(6, 182, 212, 0.06) 100%)', 
          border: '1px solid rgba(99, 102, 241, 0.3)' 
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <h1 style={{ fontSize: '2rem' }}>Welcome, {displayName}!</h1>
              <span className="badge badge-primary">Candidate</span>
            </div>
            <p style={{ maxWidth: '640px', fontSize: '0.95rem' }}>
              Your candidate performance hub. Practice coding and behavioral interviews with Gemini AI or connect with peer interviewers in real time.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="btn btn-secondary btn-sm"
              title="Refresh dashboard data"
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
              <span>Edit Profile</span>
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

      {/* Prominent Accepted Interview Alerts */}
      {acceptedRequests.length > 0 && (
        <div 
          className="card" 
          style={{ 
            marginBottom: '2rem', 
            background: 'rgba(16, 185, 129, 0.08)', 
            border: '1px solid rgba(16, 185, 129, 0.4)',
            boxShadow: '0 0 20px rgba(16, 185, 129, 0.15)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                <Video size={22} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#6ee7b7' }}>
                  Interview Request Accepted!
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Interviewer <strong>{acceptedRequests[0].interviewer?.full_name || 'Your Interviewer'}</strong> accepted your request.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {acceptedRequests[0].join_code && (
                <span className="badge badge-secondary" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                  Code: {acceptedRequests[0].join_code}
                </span>
              )}
              {acceptedRequests[0].interview_id ? (
                <Link to={`/interview/${acceptedRequests[0].interview_id}`} className="btn btn-primary btn-sm">
                  <Play size={16} />
                  <span>Join Live Interview</span>
                </Link>
              ) : (
                <span className="badge badge-warning">Preparing Session...</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Statistics Cards (Real Database Data) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Completed Interviews</span>
            <CheckCircle2 size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800 }}>
            {loading ? '--' : stats.totalCompleted}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {stats.totalCompleted > 0 ? 'Verified in database' : 'No sessions completed yet'}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Average Score</span>
            <BarChart3 size={18} color="#818cf8" />
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800 }}>
            {loading ? '--' : (stats.averageScore ? `${stats.averageScore}/10` : 'N/A')}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {stats.averageScore ? 'Based on AI & peer evaluations' : 'Complete a session to get scored'}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Pending Requests</span>
            <Clock size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: stats.pendingRequestsCount > 0 ? '#f59e0b' : 'inherit' }}>
            {loading ? '--' : stats.pendingRequestsCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Awaiting interviewer response
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Leaderboard Rank</span>
            <Trophy size={18} color="#eab308" />
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800 }}>
            {loading ? '--' : (rank ? `#${rank}` : 'Unranked')}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            <Link to="/login" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>
              View Leaderboard
            </Link>
          </div>
        </div>
      </div>

      {/* Action Hub */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        {/* Start AI Interview Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '3px solid var(--accent-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="feature-icon-wrapper" style={{ background: 'rgba(99, 102, 241, 0.15)' }}>
              <Bot size={24} color="#818cf8" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem' }}>Start AI Mock Interview</h3>
              <p style={{ fontSize: '0.825rem' }}>Adaptive Gemini-powered simulations</p>
            </div>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Practice on demand with customized tracks (DSA, Frontend, Backend, Full Stack, HR). Questions adapt to your chosen difficulty level with automated rubric evaluation.
          </p>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>DSA</span>
            <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>Frontend</span>
            <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>Backend</span>
            <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>HR</span>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
            <Link 
              to="/interview/ai"
              className="btn btn-primary btn-sm"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              <Sparkles size={16} />
              <span>Configure AI Interview</span>
            </Link>
          </div>
        </div>

        {/* Find Live Interviewer Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '3px solid var(--accent-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="feature-icon-wrapper" style={{ background: 'rgba(6, 182, 212, 0.15)' }}>
              <Users size={24} color="#38bdf8" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem' }}>Find Live Interviewer</h3>
              <p style={{ fontSize: '0.825rem' }}>Human-to-human peer mock interviews</p>
            </div>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Browse active peer interviewers from the database, send an interview request, and join a synchronized live room with WebRTC video and collaborative code editor.
          </p>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>WebRTC Video</span>
            <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>Live Code Sync</span>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
            <Link 
              to="/candidate/find-interviewer"
              className="btn btn-secondary btn-sm"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              <Users size={16} />
              <span>Discover Available Interviewers</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs Section: Requests & Previous Interviews */}
      <div className="card" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setActiveTab('accepted')}
              className={`btn btn-sm ${activeTab === 'accepted' ? 'btn-primary' : 'btn-outline'}`}
            >
              <span>Accepted Sessions</span>
              {acceptedRequests.length > 0 && (
                <span className="badge badge-success" style={{ marginLeft: 4, padding: '1px 6px' }}>
                  {acceptedRequests.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('pending')}
              className={`btn btn-sm ${activeTab === 'pending' ? 'btn-primary' : 'btn-outline'}`}
            >
              <span>Pending Requests</span>
              {pendingRequests.length > 0 && (
                <span className="badge badge-warning" style={{ marginLeft: 4, padding: '1px 6px' }}>
                  {pendingRequests.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-outline'}`}
            >
              <span>Interview History</span>
              {completedInterviews.length > 0 && (
                <span className="badge badge-secondary" style={{ marginLeft: 4, padding: '1px 6px' }}>
                  {completedInterviews.length}
                </span>
              )}
            </button>
          </div>

          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Real-time database synchronization active
          </span>
        </div>

        {/* Tab 1: Accepted Sessions */}
        {activeTab === 'accepted' && (
          <div>
            {acceptedRequests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                <CheckCircle2 size={36} color="var(--border-subtle)" style={{ marginBottom: '0.75rem' }} />
                <p style={{ fontWeight: 600 }}>No accepted interview sessions waiting.</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  When an interviewer accepts your interview request, it will appear here with an active join link.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {acceptedRequests.map((req) => (
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
                        <span style={{ fontWeight: 700 }}>Interviewer: {req.interviewer?.full_name || 'Verified Interviewer'}</span>
                        <span className="badge badge-success">Accepted</span>
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
                          <span>Join Room</span>
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Pending Requests */}
        {activeTab === 'pending' && (
          <div>
            {pendingRequests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                <Clock size={36} color="var(--border-subtle)" style={{ marginBottom: '0.75rem' }} />
                <p style={{ fontWeight: 600 }}>No pending interview requests.</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  You do not have any pending requests sent to interviewers.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {pendingRequests.map((req) => (
                  <div 
                    key={req.id}
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 700 }}>Requested: {req.interviewer?.full_name || 'Interviewer'}</span>
                        <span className="badge badge-warning">Pending</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Sent on {new Date(req.created_at).toLocaleString()}
                      </div>
                    </div>

                    <div>
                      <button
                        onClick={() => handleCancel(req.id)}
                        className="btn btn-outline btn-sm"
                        style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                      >
                        <XCircle size={15} />
                        <span>Cancel Request</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Previous Interviews History */}
        {activeTab === 'history' && (
          <div>
            {completedInterviews.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                <BarChart3 size={36} color="var(--border-subtle)" style={{ marginBottom: '0.75rem' }} />
                <p style={{ fontWeight: 600 }}>No completed interviews yet.</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  When you complete an AI simulation or peer mock interview, your score and evaluation report will be permanently recorded here.
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
                        <span style={{ fontWeight: 700 }}>{item.interview_type} Interview</span>
                        <span className="badge badge-secondary">{item.difficulty}</span>
                        <span className="badge badge-success">Completed</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem' }}>
                        <span>Mode: {item.interviewer_name ? `Peer (${item.interviewer_name})` : 'AI Simulation'}</span>
                        <span>Date: {new Date(item.created_at).toLocaleDateString()}</span>
                        <span>Duration: {item.duration} mins</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Score</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: item.score >= 7 ? '#10b981' : item.score >= 5 ? '#f59e0b' : '#ef4444' }}>
                          {item.score !== null ? `${item.score}/10` : '--'}
                        </div>
                      </div>

                      <Link
                        to={`/interview/results/${item.id}`}
                        className="btn btn-outline btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}
                      >
                        <FileText size={13} />
                        <span>Debrief</span>
                      </Link>
                    </div>
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
