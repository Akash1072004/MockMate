import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  Trophy,
  BookOpen,
  Plus,
  FileText,
  Sparkles,
  HelpCircle,
  FolderPlus,
  Code2,
  Search,
  Radio
} from 'lucide-react';
import QuestionBankModal from '../components/questions/QuestionBankModal';
import LiveNowSection from '../components/interview/LiveNowSection';
import ScheduleModal from '../components/interviews/ScheduleModal';
import { addQuestionToInterview, removeQuestionFromInterview, getInterviewQuestions } from '../services/questionService';
import { usePresencePublisher } from '../hooks/usePresence';
import { getLeaderboard } from '../services/leaderboardService';

function WaitingInterviewCard({ item, onAddQuestion }) {
  const [questions, setQuestions] = useState([]);
  const [loadingQ, setLoadingQ] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const loadQuestions = async () => {
    setLoadingQ(true);
    try {
      const list = await getInterviewQuestions(item.id);
      setQuestions(list || []);
    } catch (err) {
      console.warn('Failed to load interview questions:', err);
    } finally {
      setLoadingQ(false);
    }
  };

  useEffect(() => {
    loadQuestions();
  }, [item.id]);

  const handleRemove = async (qId) => {
    setRemovingId(qId);
    try {
      await removeQuestionFromInterview(qId);
      setQuestions((prev) => prev.filter((q) => q.id !== qId));
    } catch (err) {
      alert('Failed to remove question: ' + err.message);
    } finally {
      setRemovingId(null);
    }
  };

  const isScheduled = Boolean(item.start_time && new Date(item.start_time) > new Date());

  return (
    <div
      style={{
        background: 'var(--bg-input)',
        borderRadius: 'var(--radius-md)',
        padding: '1.25rem',
        border: isScheduled ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
            <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>Candidate: {item.candidate_name}</span>
            <span className={`badge ${isScheduled ? 'badge-secondary' : 'badge-warning'}`} style={isScheduled ? { background: 'rgba(168, 85, 247, 0.15)', color: '#d8b4fe' } : {}}>
              {isScheduled ? 'Scheduled' : 'Waiting Room Ready'}
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {item.start_time && (
              <span style={{ color: '#d8b4fe', fontWeight: 600 }}>
                📅 Scheduled: {new Date(item.start_time).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} at {new Date(item.start_time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} ({item.duration || 60}m)
              </span>
            )}
            <span>Join Code: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{item.join_code}</strong></span>
            <span>Track: {item.interview_type} &bull; {item.difficulty}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => onAddQuestion(item.id)}
            className="btn btn-outline btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Plus size={14} />
            <span>Add Question</span>
          </button>

          <Link to={`/interview/${item.id}`} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Play size={15} />
            <span>{isScheduled ? 'Enter Waiting Room' : 'Start Interview'}</span>
          </Link>
        </div>
      </div>

      {/* Assigned Questions Chips */}
      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Assigned Problems ({questions.length})
          </span>
          {questions.length === 0 && (
            <span style={{ fontSize: '0.75rem', color: '#f59e0b' }}>No problems assigned yet. Click "Add Question" to select from bank.</span>
          )}
        </div>
        {questions.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {questions.map((q, qIdx) => (
              <span
                key={q.id || qIdx}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.78rem',
                  padding: '0.2rem 0.55rem',
                  background: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  color: '#a5b4fc',
                }}
              >
                <span>{qIdx + 1}. {q.title}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(q.id)}
                  disabled={removingId === q.id}
                  title="Remove problem before interview starts"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#f87171',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    lineHeight: 1,
                  }}
                >
                  <XCircle size={13} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function InterviewerDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
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

  // Tabs: 'waiting' | 'active' | 'incoming' | 'question-bank' | 'history' | 'reviews' | 'candidates'
  const [activeTab, setActiveTab] = useState('incoming');
  const [actionLoading, setActionLoading] = useState(null); // requestId
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [showQuestionBankModal, setShowQuestionBankModal] = useState(false);
  const [selectedInterviewForQuestions, setSelectedInterviewForQuestions] = useState(null);
  const [schedulingRequest, setSchedulingRequest] = useState(null);

  // Candidates discovery state
  const [candidatesList, setCandidatesList] = useState([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState('');

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Interviewer';

  // Real-time Presence publishing: marks interviewer online, busy when in active interview, or offline
  usePresencePublisher({
    user,
    role: 'interviewer',
    isAvailable,
    inInterview: interviews.some((i) => i.status === 'active'),
  });

  useEffect(() => {
    if (activeTab === 'candidates' && candidatesList.length === 0) {
      setCandidatesLoading(true);
      getLeaderboard()
        .then(({ data }) => {
          setCandidatesList(data || []);
        })
        .finally(() => setCandidatesLoading(false));
    }
  }, [activeTab]);

  // Categorize requests and interviews from real database tables
  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const activeInterviews = interviews.filter((i) => i.status === 'active');
  const waitingInterviews = interviews.filter((i) => i.status === 'waiting');
  const completedInterviews = interviews.filter((i) => i.status === 'completed');

  const handleSelectQuestionForInterview = async (q) => {
    if (!selectedInterviewForQuestions) return;
    try {
      await addQuestionToInterview(selectedInterviewForQuestions, q);
      setActionSuccess(`Problem "${q.title}" added to interview session.`);
      setTimeout(() => setActionSuccess(''), 4000);
      refresh();
    } catch (err) {
      setActionError(err.message || 'Failed to add question to interview.');
    }
  };

  const handleConfirmSchedule = async ({ scheduledAt, duration }) => {
    if (!schedulingRequest) return;
    const req = schedulingRequest;
    setActionLoading(req.id);
    setActionError('');
    try {
      const res = await acceptRequest(req, { scheduledAt, duration });
      setActionSuccess(`Interview scheduled for ${new Date(scheduledAt).toLocaleString()}! You can now assign problems.`);
      setTimeout(() => setActionSuccess(''), 5000);
      if (res?.interview?.id) {
        setSelectedInterviewForQuestions(res.interview.id);
        setShowQuestionBankModal(true);
      }
      setActiveTab('waiting');
    } catch (err) {
      setActionError(err.message || 'Failed to schedule interview.');
    } finally {
      setActionLoading(null);
      setSchedulingRequest(null);
    }
  };

  const handleConfirmStartNow = async ({ duration }) => {
    if (!schedulingRequest) return;
    const req = schedulingRequest;
    setActionLoading(req.id);
    setActionError('');
    try {
      const res = await acceptRequest(req, { scheduledAt: new Date().toISOString(), duration });
      setActionSuccess('Interview session started! You can now assign problems.');
      setTimeout(() => setActionSuccess(''), 5000);
      if (res?.interview?.id) {
        setSelectedInterviewForQuestions(res.interview.id);
        setShowQuestionBankModal(true);
      }
      setActiveTab('waiting');
    } catch (err) {
      setActionError(err.message || 'Failed to start interview.');
    } finally {
      setActionLoading(null);
      setSchedulingRequest(null);
    }
  };

  const handleDecline = async (requestId) => {
    setActionLoading(requestId);
    setActionError('');
    try {
      await declineRequest(requestId);
      setActionSuccess('Interview request declined.');
      setTimeout(() => setActionSuccess(''), 4000);
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
              Conduct technical and DSA mock interviews, evaluate candidate performance, assign coding problems, and manage your live availability.
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

            <button
              onClick={() => navigate('/interviewer/questions/create')}
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Plus size={15} />
              <span>Create Question</span>
            </button>

            <button
              onClick={() => {
                setSelectedInterviewForQuestions(null);
                setShowQuestionBankModal(true);
              }}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <BookOpen size={15} color="#818cf8" />
              <span>Question Bank</span>
            </button>

            <Link to="/leaderboard" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Trophy size={15} color="#f59e0b" />
              <span>Leaderboard</span>
            </Link>
          </div>
        </div>
      </div>

      {actionSuccess && (
        <div style={{
          marginBottom: '1.5rem',
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid #10b981',
          color: '#34d399',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.9rem'
        }}>
          <CheckCircle2 size={18} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={18} />
          <span>{actionError}</span>
        </div>
      )}

      {/* 1. HIGH-PRIORITY ALERT: ACTIVE LIVE INTERVIEW (STRICT PARTICIPANT ID CHECK) */}
      {interviews
        .filter((item) => item.interviewer_id === user?.id && item.status === 'active')
        .map((activeItem) => (
          <div 
            key={activeItem.id}
            className="card" 
            style={{ 
              marginBottom: '2rem', 
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(6, 182, 212, 0.1) 100%)', 
              border: '2px solid #10b981',
              boxShadow: '0 0 25px rgba(16, 185, 129, 0.25)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ 
                  width: 46, 
                  height: 46, 
                  borderRadius: 'var(--radius-md)', 
                  background: '#10b981', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  color: '#fff',
                  boxShadow: '0 0 12px #10b981'
                }}>
                  <Video size={24} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '1.15rem', color: '#6ee7b7' }}>
                      My Active Interview in Progress!
                    </span>
                    <span className="badge badge-success">In Session</span>
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    Candidate: <strong>{activeItem.candidate_name || 'Candidate'}</strong>
                    {activeItem.join_code && (
                      <> &bull; Join Code: <strong style={{ fontFamily: 'var(--font-mono)' }}>{activeItem.join_code}</strong></>
                    )}
                  </div>
                </div>
              </div>

              <Link to={`/interview/${activeItem.id}`} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem' }}>
                <Play size={18} />
                <span style={{ fontWeight: 700 }}>Enter My Interview</span>
              </Link>
            </div>
          </div>
        ))}

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Pending Requests</span>
            <Clock size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: pendingRequests.length > 0 ? '#f59e0b' : 'inherit' }}>
            {loading ? '--' : pendingRequests.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Awaiting your decision
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Upcoming / Waiting</span>
            <Video size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800 }}>
            {loading ? '--' : waitingInterviews.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Ready to start
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Conducted Interviews</span>
            <CheckCircle2 size={18} color="#6366f1" />
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800 }}>
            {loading ? '--' : completedInterviews.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Archived in database
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Interviewer Rating</span>
            <Star size={18} color="#f59e0b" fill="#f59e0b" />
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800 }}>
            {loading ? '--' : (reviewMetrics.averageRating ? `${reviewMetrics.averageRating}★` : 'N/A')}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {reviewMetrics.totalReviews} verified reviews
          </div>
        </div>
      </div>

      {/* Main Workspace Tabs */}
      <div className="card" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveTab('incoming')}
              className={`btn btn-sm ${activeTab === 'incoming' ? 'btn-primary' : 'btn-outline'}`}
            >
              <Clock size={14} />
              <span>Interview Requests</span>
              {pendingRequests.length > 0 && (
                <span className="badge badge-warning" style={{ marginLeft: 4, padding: '1px 6px' }}>
                  {pendingRequests.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('waiting')}
              className={`btn btn-sm ${activeTab === 'waiting' ? 'btn-primary' : 'btn-outline'}`}
            >
              <Video size={14} />
              <span>Upcoming / Waiting Interviews</span>
              {waitingInterviews.length > 0 && (
                <span className="badge badge-success" style={{ marginLeft: 4, padding: '1px 6px' }}>
                  {waitingInterviews.length}
                </span>
              )}
            </button>

            {activeInterviews.length > 0 && (
              <button
                onClick={() => setActiveTab('active')}
                className={`btn btn-sm ${activeTab === 'active' ? 'btn-primary' : 'btn-outline'}`}
              >
                <Play size={14} />
                <span>My Active Interview ({activeInterviews.length})</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('live-now')}
              className={`btn btn-sm ${activeTab === 'live-now' ? 'btn-primary' : 'btn-outline'}`}
            >
              <Radio size={14} color="#ef4444" />
              <span>Live Now</span>
            </button>

            <button
              onClick={() => setActiveTab('question-bank')}
              className={`btn btn-sm ${activeTab === 'question-bank' ? 'btn-primary' : 'btn-outline'}`}
            >
              <BookOpen size={14} />
              <span>Question Bank</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-outline'}`}
            >
              <CheckCircle2 size={14} />
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
              <Star size={14} />
              <span>Candidate Reviews</span>
            </button>

            <button
              onClick={() => setActiveTab('candidates')}
              className={`btn btn-sm ${activeTab === 'candidates' ? 'btn-primary' : 'btn-outline'}`}
            >
              <Users size={14} />
              <span>Find Candidates</span>
            </button>
          </div>

          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Real-time Supabase synchronization active
          </span>
        </div>

        {/* Tab 1: Pending Interview Requests */}
        {activeTab === 'incoming' && (
          <div>
            {pendingRequests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-secondary)' }}>
                <Clock size={36} color="var(--border-subtle)" style={{ margin: '0 auto 0.75rem auto' }} />
                <p style={{ fontWeight: 600 }}>No pending interview requests.</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  When candidates request a mock interview with you, they will appear here in real time.
                </p>
                <div style={{ marginTop: '1rem' }}>
                  <span style={{ fontSize: '0.8rem', color: isAvailable ? '#10b981' : '#ef4444' }}>
                    Status: {isAvailable ? 'You are currently marked AVAILABLE for requests' : 'You are currently marked UNAVAILABLE. Click toggle above to accept candidates.'}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {pendingRequests.map((req) => {
                  const candidate = req.candidate || {};
                  const socials = req.candidate_socials || {};

                  return (
                    <div
                      key={req.id}
                      style={{
                        background: 'var(--bg-input)',
                        borderRadius: 'var(--radius-md)',
                        padding: '1.25rem',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                            <Link to={`/candidates/${req.candidate_id}`} style={{ fontWeight: 700, fontSize: '1.1rem', color: '#f9fafb', textDecoration: 'none' }} title="View Candidate Profile">
                              {req.candidate_name}
                            </Link>
                            <span className="badge badge-warning">Pending Request</span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Email: {req.candidate_email || 'Hidden'} &bull; Sent on {new Date(req.created_at).toLocaleString()}
                          </div>
                        </div>

                        {/* Social Links */}
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                          {socials.github && (
                            <a href={socials.github.startsWith('http') ? socials.github : `https://${socials.github}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <span>GitHub</span>
                              <ExternalLink size={12} />
                            </a>
                          )}
                          {socials.linkedin && (
                            <a href={socials.linkedin.startsWith('http') ? socials.linkedin : `https://${socials.linkedin}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <span>LinkedIn</span>
                              <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
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
                          onClick={() => setSchedulingRequest(req)}
                          disabled={actionLoading === req.id}
                          className="btn btn-primary btn-sm"
                        >
                          <CheckCircle2 size={15} />
                          <span>{actionLoading === req.id ? 'Creating Session...' : 'Accept & Schedule'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Upcoming / Waiting Interviews */}
        {activeTab === 'waiting' && (
          <div>
            {waitingInterviews.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-secondary)' }}>
                <Video size={36} color="var(--border-subtle)" style={{ margin: '0 auto 0.75rem auto' }} />
                <p style={{ fontWeight: 600 }}>No upcoming or waiting interview sessions.</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Accepted candidate requests ready to start will show here with their join codes and question selection options.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {waitingInterviews.map((item) => (
                  <WaitingInterviewCard
                    key={item.id}
                    item={item}
                    onAddQuestion={(interviewId) => {
                      setSelectedInterviewForQuestions(interviewId);
                      setShowQuestionBankModal(true);
                    }}
                  />
                ))}
              </div>
            )}

            {/* Live Now Section below waiting interviews */}
            <div style={{ marginTop: '2.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '2rem' }}>
              <LiveNowSection title="Live Now" subtitle="Interviews currently taking place across MockMate (Read-only platform feed)" />
            </div>
          </div>
        )}

        {/* Tab 3: Active Live Interviews */}
        {activeTab === 'active' && (
          <div>
            {activeInterviews.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-secondary)' }}>
                <Video size={36} color="var(--border-subtle)" style={{ margin: '0 auto 0.75rem auto' }} />
                <p style={{ fontWeight: 600 }}>No live interviews in progress right now.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {activeInterviews.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: 'rgba(16, 185, 129, 0.08)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1.25rem',
                      border: '2px solid #10b981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1rem'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>Live Candidate: {item.candidate_name}</span>
                        <span className="badge badge-success">Active Now</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Join Code: <strong style={{ fontFamily: 'var(--font-mono)' }}>{item.join_code}</strong> &bull; Started at: {new Date(item.start_time || item.created_at).toLocaleTimeString()}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <Link to={`/interview/evaluate/${item.id}`} className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Award size={14} />
                        <span>Evaluate Candidate</span>
                      </Link>
                      <Link to={`/interview/${item.id}`} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Play size={15} />
                        <span>Enter My Interview</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Dedicated Live Now Section */}
        {activeTab === 'live-now' && (
          <div>
            <LiveNowSection title="Live Now" subtitle="Interviews currently taking place across MockMate (Read-only platform feed)" />
          </div>
        )}

        {/* Tab 4: Question Bank & Management */}
        {activeTab === 'question-bank' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>Coding Problem System</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Create and manage coding problems with test cases, hidden validation cases, and starter templates.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => navigate('/interviewer/questions/create')}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Plus size={15} />
                  <span>Create Question</span>
                </button>
                <button
                  onClick={() => setShowQuestionBankModal(true)}
                  className="btn btn-outline btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <BookOpen size={15} />
                  <span>Browse Question Bank</span>
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-input)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Plus size={20} color="#818cf8" />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1rem' }}>Create Coding Problem</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Add custom problems to Supabase</p>
                  </div>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Enter title, difficulty, descriptions, examples, constraints, Python/C++/Java starter code, and protected hidden test cases.
                </p>
                <button 
                  onClick={() => navigate('/interviewer/questions/create')}
                  className="btn btn-primary btn-sm" 
                  style={{ width: '100%' }}
                >
                  Open Problem Builder
                </button>
              </div>

              <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-input)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'rgba(6, 182, 212, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BookOpen size={20} color="#38bdf8" />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1rem' }}>LeetCode-Style Question Bank</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Search and filter library</p>
                  </div>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Browse classic coding questions (Two Sum, Valid Parentheses, Binary Search, Kadane's Algorithm) and assign them to live interviews.
                </p>
                <button 
                  onClick={() => setShowQuestionBankModal(true)}
                  className="btn btn-secondary btn-sm" 
                  style={{ width: '100%' }}
                >
                  View Question Library
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Conducted History */}
        {activeTab === 'history' && (
          <div>
            {completedInterviews.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-secondary)' }}>
                <CheckCircle2 size={36} color="var(--border-subtle)" style={{ margin: '0 auto 0.75rem auto' }} />
                <p style={{ fontWeight: 600 }}>No conducted interviews yet.</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Completed live interviews with evaluations will be permanently archived here.
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
                        <span style={{ fontWeight: 700, fontSize: '1rem' }}>Candidate: {item.candidate_name}</span>
                        <span className="badge badge-secondary">{item.interview_type}</span>
                        <span className="badge badge-secondary">{item.difficulty}</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Conducted on {new Date(item.completion_time || item.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      {item.score !== null ? (
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '1.4rem', fontWeight: 800, color: item.score >= 7 ? '#10b981' : '#f59e0b' }}>
                            {item.score}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>/10</span>
                        </div>
                      ) : (
                        <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>Evaluation Pending</span>
                      )}

                      {item.score === null ? (
                        <Link to={`/interview/evaluate/${item.id}`} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Award size={15} />
                          <span>Evaluate Candidate</span>
                        </Link>
                      ) : (
                        <Link to={`/interview/results/${item.id}`} className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <FileText size={15} />
                          <span>View Evaluation</span>
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 6: Reviews Received */}
        {activeTab === 'reviews' && (
          <div>
            {reviews.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-secondary)' }}>
                <Star size={36} color="var(--border-subtle)" style={{ margin: '0 auto 0.75rem auto' }} />
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

        {/* Tab 7: Find Candidates / Candidate Discovery */}
        {activeTab === 'candidates' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>Candidate Discovery</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Inspect public candidate profiles, competitive programming credentials, and aggregate mock interview performance.
                </p>
              </div>

              <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
                <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-input"
                  value={candidateSearch}
                  onChange={(e) => setCandidateSearch(e.target.value)}
                  placeholder="Search by name or skill..."
                  style={{ paddingLeft: '2.25rem', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            <div style={{
              background: 'rgba(99, 102, 241, 0.05)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem 1rem',
              marginBottom: '1.5rem',
              fontSize: '0.825rem',
              color: 'var(--text-secondary)'
            }}>
              🔒 <strong>Privacy Protection:</strong> Private resume documents and internal evaluator feedback notes are only accessible to interviewers who have an accepted or active interview session with that specific candidate.
            </div>

            {candidatesLoading ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                <RotateCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 0.75rem auto', color: 'var(--accent-primary)' }} />
                <p>Loading candidate directory...</p>
              </div>
            ) : candidatesList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                <Users size={36} color="var(--border-subtle)" style={{ margin: '0 auto 0.75rem auto' }} />
                <p style={{ fontWeight: 600 }}>No candidates found on the platform yet.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
                {candidatesList
                  .filter((c) => {
                    const q = candidateSearch.toLowerCase().trim();
                    if (!q) return true;
                    const name = (c.candidate_name || '').toLowerCase();
                    const skills = Array.isArray(c.skills) ? c.skills.join(' ').toLowerCase() : '';
                    return name.includes(q) || skills.includes(q);
                  })
                  .map((c) => {
                    const profileUrl = `/candidates/${c.username || c.candidate_id}`;

                    return (
                      <div
                        key={c.candidate_id}
                        className="card"
                        style={{
                          background: 'var(--bg-input)',
                          borderRadius: 'var(--radius-md)',
                          padding: '1.25rem',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.75rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <Link
                              to={profileUrl}
                              style={{
                                fontSize: '1.1rem',
                                fontWeight: 700,
                                color: '#f8fafc',
                                textDecoration: 'none',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = '#818cf8')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = '#f8fafc')}
                            >
                              {c.candidate_name || 'Candidate'}
                            </Link>
                            {c.headline && (
                              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                                {c.headline}
                              </p>
                            )}
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#10b981' }}>
                              {c.average_score ? `${c.average_score}/10` : 'New'}
                            </span>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {c.interview_count || 0} interviews
                            </div>
                          </div>
                        </div>

                        {/* Skills */}
                        {c.skills && c.skills.length > 0 && (
                          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                            {c.skills.slice(0, 4).map((skill, idx) => (
                              <span key={idx} className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* External Handles */}
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {c.leetcode && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#f59e0b' }}>
                              <Code2 size={12} /> LeetCode
                            </span>
                          )}
                          {c.codeforces && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#3b82f6' }}>
                              <Code2 size={12} /> CF
                            </span>
                          )}
                          {c.github && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#94a3b8' }}>
                              GitHub
                            </span>
                          )}
                        </div>

                        <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
                          <Link
                            to={profileUrl}
                            className="btn btn-outline btn-sm"
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                          >
                            <span>Inspect Public Profile</span>
                            <ExternalLink size={12} />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Question Bank Modal */}
      {showQuestionBankModal && (
        <QuestionBankModal
          isOpen={showQuestionBankModal}
          onClose={() => {
            setShowQuestionBankModal(false);
            setSelectedInterviewForQuestions(null);
          }}
          onSelectQuestion={selectedInterviewForQuestions ? handleSelectQuestionForInterview : undefined}
          selectionMode={Boolean(selectedInterviewForQuestions)}
        />
      )}

      {/* Schedule Interview Modal */}
      {schedulingRequest && (
        <ScheduleModal
          isOpen={Boolean(schedulingRequest)}
          onClose={() => setSchedulingRequest(null)}
          request={schedulingRequest}
          onSchedule={handleConfirmSchedule}
          onStartNow={handleConfirmStartNow}
        />
      )}
    </div>
  );
}
