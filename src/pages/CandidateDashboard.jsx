import React, { useState, useEffect } from 'react';
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
  FileText,
  Hash,
  Star
} from 'lucide-react';
import ReviewModal from '../components/interview/ReviewModal';
import LiveNowSection from '../components/interview/LiveNowSection';
import { hasResume as checkHasResume } from '../services/resumeService';

function formatScheduledCountdown(targetMs, nowMs) {
  const diff = Math.max(0, targetMs - nowMs);
  const totalSecs = Math.floor(diff / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  const pad = (n) => String(n).padStart(2, '0');
  if (days > 0) {
    return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function CandidateScheduledInterviewCard({ item, now }) {
  const targetTime = new Date(item.start_time).getTime();
  const countdownText = formatScheduledCountdown(targetTime, now);
  const startDate = new Date(item.start_time);
  const formattedDate = startDate.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const formattedTime = startDate.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div
      className="card"
      style={{
        marginBottom: '1.5rem',
        background: 'rgba(168, 85, 247, 0.08)',
        border: '1px solid rgba(168, 85, 247, 0.4)',
        boxShadow: '0 0 20px rgba(168, 85, 247, 0.15)',
        padding: '1.5rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(168, 85, 247, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#c084fc',
              flexShrink: 0,
            }}
          >
            <Calendar size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
              <span style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.8rem', fontWeight: 800, color: '#c084fc' }}>
                Upcoming Interview
              </span>
              <span className="badge badge-secondary" style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#d8b4fe' }}>
                Scheduled
              </span>
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', marginBottom: '0.4rem' }}>
              Interviewer: <span style={{ color: '#e9d5ff' }}>{item.interviewer_name || 'Assigned Interviewer'}</span>
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
              <span>Date: <strong style={{ color: 'var(--text-primary)' }}>{formattedDate}</strong></span>
              <span>Time: <strong style={{ color: 'var(--text-primary)' }}>{formattedTime}</strong></span>
              {item.duration && (
                <span>Duration: <strong style={{ color: 'var(--text-primary)' }}>{item.duration} mins</strong></span>
              )}
              {item.join_code && (
                <span>Join Code: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{item.join_code}</strong></span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.35)', padding: '0.5rem 1.15rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
            <div style={{ fontSize: '0.72rem', color: '#c084fc', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.15rem' }}>
              Starts in:
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 800, color: '#e9d5ff' }}>
              {countdownText}
            </div>
          </div>

          <Link to={`/interview/${item.id}`} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.65rem 1.25rem' }}>
            <Play size={16} />
            <span style={{ fontWeight: 700 }}>Enter Waiting Room</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

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

  const [activeTab, setActiveTab] = useState('all-interviews'); // 'all-interviews' | 'requests' | 'history'
  const [actionError, setActionError] = useState('');
  const [reviewingInterview, setReviewingInterview] = useState(null);
  const [candidateHasResume, setCandidateHasResume] = useState(true);

  useEffect(() => {
    if (user?.id) {
      checkHasResume(user.id).then((ok) => setCandidateHasResume(ok));
    }
  }, [user?.id]);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Candidate';

  // Categorize interviews and requests from database into explicit lifecycle states
  const activeInterviews = interviews.filter((i) => i.status === 'active');
  const scheduledInterviews = interviews.filter(
    (i) => (i.status === 'scheduled' || i.status === 'waiting') && i.start_time && new Date(i.start_time).getTime() > now
  );
  const waitingInterviews = interviews.filter(
    (i) => (i.status === 'waiting' || i.status === 'scheduled') && (!i.start_time || new Date(i.start_time).getTime() <= now)
  );
  const completedInterviews = interviews.filter((i) => i.status === 'completed');

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const acceptedRequests = requests.filter((r) => r.status === 'accepted');
  const otherRequests = requests.filter((r) => r.status === 'declined' || r.status === 'cancelled');

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
      {/* Resume Prerequisite Banner */}
      {!candidateHasResume && (
        <div
          className="alert alert-warning"
          style={{
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            padding: '1.25rem 1.5rem',
            borderLeft: '4px solid #f59e0b',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <FileText size={24} color="#f59e0b" style={{ flexShrink: 0 }} />
            <div>
              <strong style={{ color: '#f59e0b', fontSize: '1rem' }}>Resume Required Before Starting Interviews</strong>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.875rem' }}>
                Please upload your resume before starting an interview. Both AI and human peer interviewers use your resume to personalize technical questions.
              </p>
            </div>
          </div>
          <Link to="/profile" className="btn btn-primary btn-sm">
            Upload Resume
          </Link>
        </div>
      )}

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
            <Link to="/candidate/find-interviewer" className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Users size={15} />
              <span>Find Interviewer</span>
            </Link>
            <Link to="/join" className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Hash size={15} />
              <span>Join by Code</span>
            </Link>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="btn btn-secondary btn-sm"
              title="Refresh dashboard data"
            >
              <RotateCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
            </button>
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

      {/* 1. HIGH-PRIORITY ALERT: ACTIVE LIVE INTERVIEWS IN PROGRESS */}
      {activeInterviews.length > 0 && (
        <div style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {activeInterviews.map((item) => (
            <div 
              key={item.id}
              className="card" 
              style={{ 
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(6, 182, 212, 0.1) 100%)', 
                border: '2px solid #10b981',
                boxShadow: '0 0 25px rgba(16, 185, 129, 0.25)',
                padding: '1.25rem 1.5rem',
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
                      <span className="badge badge-success" style={{ animation: 'pulse 1.5s infinite' }}>
                        In Session
                      </span>
                    </div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      Interviewer: <strong>{item.interviewer_name || 'Interviewer'}</strong> &bull; Join Code: <strong style={{ fontFamily: 'var(--font-mono)' }}>{item.join_code}</strong>
                    </div>
                  </div>
                </div>

                <Link to={`/interview/${item.id}`} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem' }}>
                  <Play size={18} />
                  <span style={{ fontWeight: 700 }}>Enter My Interview</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. PRIORITY ALERTS: SCHEDULED INTERVIEWS WITH LIVE REALTIME COUNTDOWN */}
      {scheduledInterviews.length > 0 && activeInterviews.length === 0 && (
        <div style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {scheduledInterviews.map((item) => (
            <CandidateScheduledInterviewCard key={item.id} item={item} now={now} />
          ))}
        </div>
      )}

      {/* 3. PRIORITY ALERTS: ACCEPTED SESSIONS WAITING TO START / READY */}
      {waitingInterviews.length > 0 && activeInterviews.length === 0 && (
        <div style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {waitingInterviews.map((item) => (
            <div 
              key={item.id}
              className="card" 
              style={{ 
                background: 'rgba(99, 102, 241, 0.08)', 
                border: '1px solid rgba(99, 102, 241, 0.4)',
                boxShadow: '0 0 20px rgba(99, 102, 241, 0.15)',
                padding: '1.25rem 1.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 'var(--radius-md)', background: 'rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                    <Clock size={22} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#a5b4fc' }}>
                        Interview Session Ready (Waiting Room Open)
                      </span>
                      <span className="badge badge-warning">Interview Ready</span>
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      Interviewer <strong>{item.interviewer_name || 'Verified Interviewer'}</strong> is ready. Enter the waiting room to review problems and await session start.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {item.join_code && (
                    <span className="badge badge-secondary" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                      Code: {item.join_code}
                    </span>
                  )}
                  <Link to={`/interview/${item.id}`} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Play size={15} />
                    <span>Enter Waiting Room</span>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Active / Upcoming</span>
            <Video size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800 }}>
            {loading ? '--' : (activeInterviews.length + waitingInterviews.length + scheduledInterviews.length)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Live rooms ready to join
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Pending Requests</span>
            <Clock size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: pendingRequests.length > 0 ? '#f59e0b' : 'inherit' }}>
            {loading ? '--' : pendingRequests.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Awaiting interviewer response
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Completed Interviews</span>
            <CheckCircle2 size={18} color="#6366f1" />
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800 }}>
            {loading ? '--' : completedInterviews.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Scored in database
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
            Based on evaluations
          </div>
        </div>
      </div>

      {/* Action Hub */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
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
            Practice on demand with customized tracks (DSA, Frontend, Backend, Full Stack). Questions adapt to your chosen difficulty level with automated rubric evaluation.
          </p>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>DSA</span>
            <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>Frontend</span>
            <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>Backend</span>
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
      </div>

      {/* Main Workspace Tabs */}
      <div className="card" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveTab('all-interviews')}
              className={`btn btn-sm ${activeTab === 'all-interviews' ? 'btn-primary' : 'btn-outline'}`}
            >
              <Video size={14} />
              <span>My Interviews</span>
              {(activeInterviews.length + waitingInterviews.length) > 0 && (
                <span className="badge badge-success" style={{ marginLeft: 4, padding: '1px 6px' }}>
                  {activeInterviews.length + waitingInterviews.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('requests')}
              className={`btn btn-sm ${activeTab === 'requests' ? 'btn-primary' : 'btn-outline'}`}
            >
              <Clock size={14} />
              <span>My Interview Requests</span>
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
              <BarChart3 size={14} />
              <span>Interview History</span>
              {completedInterviews.length > 0 && (
                <span className="badge badge-secondary" style={{ marginLeft: 4, padding: '1px 6px' }}>
                  {completedInterviews.length}
                </span>
              )}
            </button>
          </div>

          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Real-time Supabase synchronization active
          </span>
        </div>

        {/* Tab 1: Active Sessions & Upcoming */}
        {activeTab === 'all-interviews' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* 1. MY ACTIVE INTERVIEW (Participant Actionable Room) */}
            {activeInterviews.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                  <h3 style={{ fontSize: '1.1rem', color: '#10b981', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    My Active Interview
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
                        gap: '1rem',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                          <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#f9fafb' }}>
                            {item.is_ai ? 'AI Mock Interview' : `Interview with ${item.interviewer_name || 'Interviewer'}`}
                          </span>
                          <span className="badge badge-success">In Session</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {item.interview_type} &bull; {item.difficulty}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem' }}>
                          <span>Join Code: <strong style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>{item.join_code}</strong></span>
                        </div>
                      </div>
                      <Link to={`/interview/${item.id}`} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Play size={14} />
                        <span>Enter My Interview</span>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. WAITING ROOM READY */}
            {waitingInterviews.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <Clock size={16} color="#818cf8" />
                  <h3 style={{ fontSize: '1.1rem', color: '#a5b4fc', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Waiting Room Ready
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {waitingInterviews.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        background: 'var(--bg-input)',
                        borderRadius: 'var(--radius-md)',
                        padding: '1.25rem',
                        border: '1px solid rgba(99, 102, 241, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '1rem',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '1rem' }}>
                            {item.is_ai ? 'AI Simulation' : `Interview with ${item.interviewer_name || 'Interviewer'}`}
                          </span>
                          <span className="badge badge-warning">Waiting Room</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {item.interview_type} &bull; {item.difficulty}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Join Code: <strong style={{ fontFamily: 'var(--font-mono)' }}>{item.join_code}</strong>
                        </div>
                      </div>
                      <Link to={`/interview/${item.id}`} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Play size={14} />
                        <span>Enter Waiting Room</span>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. UPCOMING / SCHEDULED */}
            {scheduledInterviews.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <Calendar size={16} color="#d8b4fe" />
                  <h3 style={{ fontSize: '1.1rem', color: '#d8b4fe', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Upcoming Interviews
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {scheduledInterviews.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        background: 'var(--bg-input)',
                        borderRadius: 'var(--radius-md)',
                        padding: '1.25rem',
                        border: '1px solid rgba(168, 85, 247, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '1rem',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '1rem' }}>
                            Interview with {item.interviewer_name || 'Verified Interviewer'}
                          </span>
                          <span className="badge badge-secondary" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#d8b4fe' }}>
                            Scheduled
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#d8b4fe', fontWeight: 600 }}>
                          📅 {new Date(item.start_time).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} &bull; {new Date(item.start_time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} ({item.duration || 60} mins)
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.3)', padding: '0.35rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(168, 85, 247, 0.25)' }}>
                          <span style={{ fontSize: '0.72rem', color: '#c084fc', display: 'block', fontWeight: 700 }}>Starts in:</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.95rem', fontWeight: 700, color: '#e9d5ff' }}>
                            {formatScheduledCountdown(new Date(item.start_time).getTime(), now)}
                          </span>
                        </div>
                        <Link to={`/interview/${item.id}`} className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Play size={14} />
                          <span>Enter Waiting Room</span>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State for Active/Upcoming */}
            {activeInterviews.length === 0 && waitingInterviews.length === 0 && scheduledInterviews.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-secondary)' }}>
                <Video size={36} color="var(--border-subtle)" style={{ margin: '0 auto 0.75rem auto' }} />
                <p style={{ fontWeight: 600 }}>No live or upcoming interviews right now.</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Request an interview with an available peer interviewer or practice instantly with AI.
                </p>
                <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                  <Link to="/candidate/find-interviewer" className="btn btn-primary btn-sm">
                    Find Interviewer
                  </Link>
                  <Link to="/interview/ai" className="btn btn-secondary btn-sm">
                    Practice with AI
                  </Link>
                </div>
              </div>
            )}

            {/* 4. LIVE SESSIONS / LIVE NOW (Platform Activity, Read-Only, No Enter Buttons) */}
            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '2rem' }}>
              <LiveNowSection title="Live Now" subtitle="Interviews currently in progress on MockMate (Informational platform view)" />
            </div>
          </div>
        )}

        {/* Tab 2: My Interview Requests (Pending, Accepted, Declined) */}
        {activeTab === 'requests' && (
          <div>
            {requests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-secondary)' }}>
                <Clock size={36} color="var(--border-subtle)" style={{ margin: '0 auto 0.75rem auto' }} />
                <p style={{ fontWeight: 600 }}>No interview requests found.</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  You haven't sent any interview requests to peer interviewers yet.
                </p>
                <div style={{ marginTop: '1.25rem' }}>
                  <Link to="/candidate/find-interviewer" className="btn btn-primary btn-sm">
                    Discover Available Interviewers
                  </Link>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {requests.map((req) => (
                  <div 
                    key={req.id}
                    style={{
                      background: 'var(--bg-input)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1.25rem',
                      border: req.status === 'accepted' ? '1px solid rgba(16, 185, 129, 0.4)' : req.status === 'pending' ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1rem'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 700 }}>
                          Interviewer: {req.interviewer?.full_name || 'Verified Interviewer'}
                        </span>
                        <span className={`badge ${req.status === 'accepted' ? 'badge-success' : req.status === 'pending' ? 'badge-warning' : 'badge-danger'}`}>
                          {req.status === 'accepted' ? 'Accepted' : req.status === 'pending' ? 'Pending' : req.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Requested on {new Date(req.created_at).toLocaleString()}
                        {req.responded_at && ` &bull; Responded: ${new Date(req.responded_at).toLocaleString()}`}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      {req.join_code && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', background: 'rgba(255,255,255,0.05)', padding: '0.35rem 0.65rem', borderRadius: 'var(--radius-sm)' }}>
                          Code: {req.join_code}
                        </span>
                      )}

                      {req.status === 'pending' && (
                        <button
                          onClick={() => handleCancel(req.id)}
                          className="btn btn-outline btn-sm"
                          style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                        >
                          <XCircle size={15} />
                          <span>Cancel Request</span>
                        </button>
                      )}

                      {req.status === 'accepted' && req.interview_id && (
                        <Link to={`/interview/${req.interview_id}`} className="btn btn-primary btn-sm">
                          <Play size={15} />
                          <span>Enter Room</span>
                        </Link>
                      )}

                      {req.status === 'declined' && (
                        <Link to="/candidate/find-interviewer" className="btn btn-outline btn-sm">
                          Find Another
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: History */}
        {activeTab === 'history' && (
          <div>
            {completedInterviews.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-secondary)' }}>
                <BarChart3 size={36} color="var(--border-subtle)" style={{ margin: '0 auto 0.75rem auto' }} />
                <p style={{ fontWeight: 600 }}>No completed interviews yet.</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  When you complete a live mock interview or AI simulation, your debrief and score will appear here.
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
                        <span style={{ fontWeight: 700, fontSize: '1rem' }}>
                          {item.is_ai ? 'AI Simulation' : `Interviewer: ${item.interviewer_name || 'Peer'}`}
                        </span>
                        <span className="badge badge-secondary">{item.interview_type}</span>
                        <span className="badge badge-secondary">{item.difficulty}</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Completed on {new Date(item.completion_time || item.created_at).toLocaleDateString()}
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

                      <Link to={`/interview/results/${item.id}`} className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <FileText size={15} />
                        <span>View Report</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Review Modal if Candidate clicks Rate Interviewer */}
      {reviewingInterview && (
        <ReviewModal
          isOpen={Boolean(reviewingInterview)}
          onClose={() => setReviewingInterview(null)}
          interview={reviewingInterview}
          candidateId={user?.id}
          onReviewSubmitted={() => {
            setReviewingInterview(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
