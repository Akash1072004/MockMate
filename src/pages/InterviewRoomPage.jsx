import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { getInterviewById, updateInterviewStatus } from '../services/interviewService';
import { useWebRTC } from '../hooks/useWebRTC';
import { useCollaborativeCode } from '../hooks/useCollaborativeCode';
import CollaborativeCodeEditor from '../components/interview/CollaborativeCodeEditor';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Monitor, 
  LogOut, 
  Play, 
  Clock, 
  Code2, 
  CheckCircle2, 
  AlertCircle, 
  FileText,
  ShieldAlert,
  RotateCw,
  History,
  Terminal,
  Star,
  BookOpen,
  Plus,
  Layers,
  ChevronRight,
  Info,
  Check,
  Award
} from 'lucide-react';
import { getInterviewSubmissions } from '../services/codeExecutionService';
import ReviewModal from '../components/interview/ReviewModal';
import { getReviewByInterviewId } from '../services/reviewService';
import { 
  getInterviewQuestions, 
  addQuestionToInterview, 
  setActiveInterviewQuestion, 
  DEFAULT_SEED_QUESTIONS 
} from '../services/questionService';
import QuestionBankModal from '../components/questions/QuestionBankModal';

export default function InterviewRoomPage() {
  const { id: interviewId } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [interview, setInterview] = useState(null);
  const [userRole, setUserRole] = useState('candidate'); // 'candidate' | 'interviewer'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Questions state
  const [questions, setQuestions] = useState([]);
  const [activeQuestionId, setActiveQuestionId] = useState(null);
  const [showQuestionBankModal, setShowQuestionBankModal] = useState(false);

  // Active room side tabs
  const [sideTab, setSideTab] = useState('video'); // 'video' | 'notes' | 'submissions'
  const [notes, setNotes] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [submissions, setSubmissions] = useState([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [existingReview, setExistingReview] = useState(null);

  // Derive active question object
  const activeQuestion = questions.find(
    (q) => (q.question_id && q.question_id === activeQuestionId) || q.id === activeQuestionId
  ) || questions[0] || DEFAULT_SEED_QUESTIONS[0];

  const loadSubmissions = async () => {
    if (interviewId) {
      const subs = await getInterviewSubmissions(interviewId);
      setSubmissions(subs);
    }
  };

  const loadExistingReview = async () => {
    if (interviewId) {
      const rev = await getReviewByInterviewId(interviewId);
      setExistingReview(rev);
    }
  };

  const loadQuestions = async () => {
    if (!interviewId) return;
    try {
      const list = await getInterviewQuestions(interviewId);
      if (list && list.length > 0) {
        setQuestions(list);
      } else {
        // Fallback to default questions
        setQuestions(DEFAULT_SEED_QUESTIONS.slice(0, 2));
      }
    } catch (err) {
      console.error('[InterviewRoom] Error loading questions:', err);
      setQuestions(DEFAULT_SEED_QUESTIONS.slice(0, 2));
    }
  };

  useEffect(() => {
    loadSubmissions();
    loadExistingReview();
    loadQuestions();
  }, [interviewId]);

  // Sync active question from interview record
  useEffect(() => {
    if (interview?.active_question_id) {
      setActiveQuestionId(interview.active_question_id);
    } else if (questions.length > 0 && !activeQuestionId) {
      const defaultId = questions[0].question_id || questions[0].id;
      setActiveQuestionId(defaultId);
    }
  }, [interview?.active_question_id, questions]);

  // WebRTC Audio/Video Hook
  const webrtc = useWebRTC({
    interviewId,
    userId: user?.id,
    enabled: interview?.status === 'active' || interview?.status === 'waiting',
  });

  // Collaborative Code Editor Hook
  const collaborativeCode = useCollaborativeCode({
    interviewId,
    userId: user?.id,
    questionId: activeQuestion?.question_id || activeQuestion?.id || null,
    initialCode: interview?.code,
    initialLanguage: interview?.language,
    starterCodeByLang: activeQuestion?.starter_code || null,
  });

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Bind local stream
  useEffect(() => {
    if (localVideoRef.current && webrtc.localStream) {
      localVideoRef.current.srcObject = webrtc.localStream;
    }
  }, [webrtc.localStream]);

  // Bind remote stream
  useEffect(() => {
    if (remoteVideoRef.current && webrtc.remoteStream) {
      remoteVideoRef.current.srcObject = webrtc.remoteStream;
    }
  }, [webrtc.remoteStream]);

  // Load interview and verify participant authorization
  const loadInterview = async () => {
    if (!interviewId || !user?.id) return;
    try {
      const res = await getInterviewById(interviewId, user.id);
      if (!res.isAuthorized || res.error) {
        setError(res.error || 'You are not authorized to participate in this interview session.');
        setLoading(false);
        return;
      }

      setInterview(res.interview);
      setUserRole(res.userRoleInInterview);
      if (res.interview?.active_question_id) {
        setActiveQuestionId(res.interview.active_question_id);
      }
    } catch (err) {
      console.error('[InterviewRoom] Load error:', err);
      setError(err.message || 'Failed to initialize interview room.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInterview();

    if (!interviewId || !supabase) return;

    // Realtime listener for interview state changes (status, active question, etc.)
    const interviewChannel = supabase
      .channel(`interview_room_${interviewId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'interviews',
          filter: `id=eq.${interviewId}`,
        },
        (payload) => {
          if (payload.new) {
            setInterview(payload.new);
            if (payload.new.active_question_id) {
              setActiveQuestionId(payload.new.active_question_id);
            }
          }
        }
      )
      .subscribe();

    // Realtime listener for questions added to this interview
    const questionsChannel = supabase
      .channel(`interview_questions_${interviewId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'interview_questions',
          filter: `interview_id=eq.${interviewId}`,
        },
        () => {
          loadQuestions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(interviewChannel);
      supabase.removeChannel(questionsChannel);
    };
  }, [interviewId, user?.id]);

  // Elapsed timer when active
  useEffect(() => {
    if (interview?.status !== 'active') return;

    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [interview?.status]);

  const handleStartInterview = async () => {
    if (!interview || userRole !== 'interviewer') return;
    try {
      // Ensure active question is set when starting
      const firstQId = activeQuestion?.question_id || activeQuestion?.id || null;
      if (firstQId && !interview.active_question_id) {
        await setActiveInterviewQuestion(interview.id, firstQId);
      }
      const updated = await updateInterviewStatus(interview.id, 'active', user.id);
      setInterview(updated);
    } catch (err) {
      alert('Failed to start interview: ' + err.message);
    }
  };

  const handleSwitchQuestion = async (q) => {
    const qId = q.question_id || q.id;
    setActiveQuestionId(qId);
    if (userRole === 'interviewer' && interviewId) {
      try {
        await setActiveInterviewQuestion(interviewId, qId);
      } catch (err) {
        console.warn('Could not sync active question:', err);
      }
    }
  };

  const handleAddQuestionFromBank = async (selectedQ) => {
    try {
      await addQuestionToInterview(interviewId, selectedQ, questions.length + 1);
      await loadQuestions();
      setShowQuestionBankModal(false);
      handleSwitchQuestion(selectedQ);
    } catch (err) {
      alert('Failed to add question to interview: ' + err.message);
    }
  };

  const handleEndInterview = async () => {
    if (userRole === 'candidate' && interview?.interviewer_id && !existingReview) {
      if (window.confirm('Would you like to rate your interviewer before leaving?')) {
        setShowReviewModal(true);
        return;
      }
    }

    if (!window.confirm('Are you sure you want to exit this interview session?')) return;
    try {
      if (userRole === 'interviewer') {
        await updateInterviewStatus(interview.id, 'completed', user.id);
        navigate('/interviewer/dashboard');
      } else {
        navigate('/candidate/dashboard');
      }
    } catch (err) {
      alert('Failed to exit interview: ' + err.message);
    }
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getDifficultyColor = (diff) => {
    switch (diff?.toLowerCase()) {
      case 'easy':
        return '#10b981';
      case 'hard':
        return '#ef4444';
      default:
        return '#f59e0b';
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '6rem 1.5rem', textAlign: 'center' }}>
        <RotateCw size={36} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem auto', color: 'var(--accent-primary)' }} />
        <h2>Connecting to Interview Room...</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Validating participant security and join code</p>
      </div>
    );
  }

  if (error || !interview) {
    return (
      <div className="container" style={{ padding: '5rem 1.5rem', maxWidth: '540px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <ShieldAlert size={48} color="#ef4444" style={{ margin: '0 auto 1rem auto' }} />
          <h2 style={{ fontSize: '1.6rem', marginBottom: '0.75rem' }}>Access Denied</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            {error || 'This interview room does not exist or you do not have permission to join.'}
          </p>
          <Link to="/dashboard" className="btn btn-primary">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // 1. WAITING ROOM VIEW (status === 'waiting')
  if (interview.status === 'waiting') {
    return (
      <div className="container" style={{ padding: '3.5rem 1.5rem', maxWidth: '820px' }}>
        <div className="card" style={{ padding: '2.5rem 2.5rem', textAlign: 'center' }}>
          <div className="badge badge-warning" style={{ margin: '0 auto 1rem auto' }}>
            Waiting Room
          </div>

          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
            {interview.interview_type} Interview
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
            Join Code: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{interview.join_code}</strong> | Difficulty: <strong>{interview.difficulty}</strong>
          </p>

          {/* Participants Card */}
          <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: '1.25rem 1.5rem', marginBottom: '1.5rem', textAlign: 'left', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Candidate:</span>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{interview.candidate_name}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Interviewer:</span>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{interview.interviewer_name}</div>
              </div>
            </div>
          </div>

          {/* Assigned Questions Bank Preview */}
          <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: '1.25rem 1.5rem', marginBottom: '1.5rem', textAlign: 'left', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BookOpen size={18} color="var(--accent-primary)" />
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                  Interview Coding Problems ({questions.length})
                </span>
              </div>
              {userRole === 'interviewer' && (
                <button
                  onClick={() => setShowQuestionBankModal(true)}
                  className="btn btn-outline btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}
                >
                  <Plus size={14} />
                  <span>Add Question</span>
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {questions.map((q, idx) => (
                <div
                  key={q.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 1rem',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ 
                      width: 24, 
                      height: 24, 
                      borderRadius: '50%', 
                      background: 'var(--bg-secondary)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      fontSize: '0.75rem', 
                      fontWeight: 700,
                      color: 'var(--accent-primary)' 
                    }}>
                      {idx + 1}
                    </span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{q.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{q.topic}</div>
                    </div>
                  </div>

                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '0.2rem 0.6rem',
                    borderRadius: 9999,
                    background: `${getDifficultyColor(q.difficulty)}15`,
                    color: getDifficultyColor(q.difficulty),
                    border: `1px solid ${getDifficultyColor(q.difficulty)}40`
                  }}>
                    {q.difficulty}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Device Pre-Check */}
          <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: '1.25rem 1.5rem', marginBottom: '2rem', textAlign: 'left', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Audio & Video Device Check</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={webrtc.toggleCamera} 
                  className={`btn btn-sm ${webrtc.isCameraOn ? 'btn-primary' : 'btn-outline'}`}
                >
                  {webrtc.isCameraOn ? <Video size={14} /> : <VideoOff size={14} />}
                  <span>{webrtc.isCameraOn ? 'Camera On' : 'Camera Off'}</span>
                </button>
                <button 
                  onClick={webrtc.toggleMic} 
                  className={`btn btn-sm ${webrtc.isMicOn ? 'btn-primary' : 'btn-outline'}`}
                >
                  {webrtc.isMicOn ? <Mic size={14} /> : <MicOff size={14} />}
                  <span>{webrtc.isMicOn ? 'Mic On' : 'Mic Muted'}</span>
                </button>
              </div>
            </div>

            {/* Local Camera Test Preview */}
            <div style={{
              height: '180px',
              background: '#0a0e17',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              {webrtc.isCameraOn ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  <VideoOff size={32} style={{ margin: '0 auto 0.5rem auto' }} />
                  <p style={{ fontSize: '0.85rem' }}>Camera is currently turned off</p>
                </div>
              )}
            </div>
          </div>

          {userRole === 'interviewer' ? (
            <div>
              <p style={{ color: '#10b981', fontWeight: 600, marginBottom: '1.25rem' }}>
                Both participants are ready. Click below to begin the live interview.
              </p>
              <button onClick={handleStartInterview} className="btn btn-primary btn-lg" style={{ width: '100%' }}>
                <Play size={18} />
                <span>Start Interview Session</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b', fontWeight: 600 }}>
                <Clock size={18} />
                <span>Waiting for Interviewer ({interview.interviewer_name}) to start the session...</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Your video, audio, and synchronized code editor will connect immediately when the session begins.
              </p>
            </div>
          )}

          <div style={{ marginTop: '2rem' }}>
            <Link to="/dashboard" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Leave Waiting Room & Return to Dashboard
            </Link>
          </div>
        </div>

        {/* Question Bank Modal for Interviewer */}
        {showQuestionBankModal && (
          <QuestionBankModal
            isOpen={showQuestionBankModal}
            onClose={() => setShowQuestionBankModal(false)}
            onSelectQuestion={handleAddQuestionFromBank}
            selectionMode={true}
          />
        )}
      </div>
    );
  }

  // 2. ACTIVE INTERVIEW ROOM VIEW (status === 'active')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 70px)', background: '#0b0f19' }}>
      {/* Top Header Bar */}
      <div style={{
        height: '56px',
        background: '#111827',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.25rem',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>
            Mock<span className="text-gradient">Mate</span>
          </span>
          <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }}></span>
            Live Active
          </span>
          <span className="badge badge-secondary" style={{ fontFamily: 'var(--font-mono)' }}>
            {interview.join_code}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Candidate: <strong>{interview.candidate_name}</strong> &bull; Interviewer: <strong>{interview.interviewer_name}</strong>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* WebRTC Connection Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
            <span 
              style={{ 
                width: 8, 
                height: 8, 
                borderRadius: '50%', 
                background: webrtc.connectionState === 'connected' ? '#10b981' : webrtc.connectionState === 'connecting' ? '#f59e0b' : '#6b7280',
                boxShadow: webrtc.connectionState === 'connected' ? '0 0 6px #10b981' : 'none'
              }} 
            />
            <span style={{ color: 'var(--text-secondary)' }}>
              {webrtc.connectionState === 'connected' ? 'P2P Connected' : webrtc.connectionState === 'connecting' ? 'Connecting WebRTC...' : 'WebRTC Ready'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'var(--font-mono)', fontSize: '0.95rem', color: '#38bdf8' }}>
            <Clock size={16} />
            <span>{formatTimer(elapsedSeconds)}</span>
          </div>

          {userRole === 'candidate' && interview?.interviewer_id && (
            <button
              onClick={() => setShowReviewModal(true)}
              className="btn btn-outline btn-sm"
              style={{
                borderColor: existingReview ? '#10b981' : '#f59e0b',
                color: existingReview ? '#34d399' : '#fbbf24',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
              title={existingReview ? 'Reviewed' : 'Rate this interviewer'}
            >
              <Star size={14} fill={existingReview ? '#34d399' : '#fbbf24'} />
              <span>{existingReview ? `Rated ${existingReview.rating}★` : 'Rate Interviewer'}</span>
            </button>
          )}

          <button
            onClick={handleEndInterview}
            className="btn btn-outline btn-sm"
            style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
          >
            <LogOut size={15} />
            <span>{userRole === 'interviewer' ? 'End Interview' : 'Leave Room'}</span>
          </button>
        </div>
      </div>

      {/* Main Room 3-Column Split View */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '380px 1fr 340px', 
        flex: 1, 
        overflow: 'hidden' 
      }}>
        {/* COLUMN 1 (LEFT): Question / Problem System */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          borderRight: '1px solid var(--border-subtle)', 
          background: '#0d1321', 
          overflow: 'hidden' 
        }}>
          {/* Question Selector Tabs */}
          <div style={{ 
            padding: '0.65rem 1rem', 
            background: '#111827', 
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            overflowX: 'auto'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflowX: 'auto', flex: 1 }}>
              {questions.map((q, idx) => {
                const isSelected = (q.question_id && q.question_id === activeQuestionId) || q.id === activeQuestionId;
                return (
                  <button
                    key={q.id || idx}
                    onClick={() => handleSwitchQuestion(q)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.3rem 0.65rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: isSelected ? '1px solid var(--accent-primary)' : '1px solid transparent',
                      background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.03)',
                      color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      whiteSpace: 'nowrap'
                    }}
                    title={q.title}
                  >
                    <span>Q{idx + 1}</span>
                    <span style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {q.title}
                    </span>
                  </button>
                );
              })}
            </div>

            {userRole === 'interviewer' && (
              <button
                onClick={() => setShowQuestionBankModal(true)}
                className="btn btn-outline btn-sm"
                style={{ 
                  padding: '0.25rem 0.5rem', 
                  fontSize: '0.75rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.25rem',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
                title="Add another question to this interview"
              >
                <Plus size={13} />
                <span>Add</span>
              </button>
            )}
          </div>

          {/* Problem Statement Content (Scrollable) */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
            {activeQuestion ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Title & Metadata Badges */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.55rem',
                      borderRadius: 9999,
                      background: `${getDifficultyColor(activeQuestion.difficulty)}20`,
                      color: getDifficultyColor(activeQuestion.difficulty),
                      border: `1px solid ${getDifficultyColor(activeQuestion.difficulty)}40`
                    }}>
                      {activeQuestion.difficulty}
                    </span>
                    <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>
                      {activeQuestion.topic}
                    </span>
                    {userRole === 'interviewer' && (
                      <span style={{ fontSize: '0.7rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        <Check size={12} /> Sync Active
                      </span>
                    )}
                  </div>

                  <h2 style={{ fontSize: '1.25rem', color: '#f9fafb', fontWeight: 700, lineHeight: 1.3 }}>
                    {activeQuestion.title}
                  </h2>
                </div>

                {/* Description */}
                <div>
                  <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>
                    Description
                  </div>
                  <div style={{ 
                    fontSize: '0.875rem', 
                    color: '#cbd5e1', 
                    lineHeight: 1.6, 
                    whiteSpace: 'pre-wrap' 
                  }}>
                    {activeQuestion.description}
                  </div>
                </div>

                {/* Input / Output Format */}
                {(activeQuestion.input_description || activeQuestion.output_description) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {activeQuestion.input_description && (
                      <div>
                        <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>
                          Input Format
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5, background: 'rgba(255,255,255,0.02)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                          {activeQuestion.input_description}
                        </div>
                      </div>
                    )}
                    {activeQuestion.output_description && (
                      <div>
                        <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>
                          Output Format
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5, background: 'rgba(255,255,255,0.02)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                          {activeQuestion.output_description}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Examples */}
                {activeQuestion.examples && activeQuestion.examples.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.6rem', fontWeight: 600 }}>
                      Examples
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {activeQuestion.examples.map((ex, exIdx) => (
                        <div 
                          key={exIdx} 
                          style={{ 
                            background: '#111827', 
                            border: '1px solid var(--border-subtle)', 
                            borderRadius: 'var(--radius-sm)', 
                            padding: '0.75rem',
                            fontSize: '0.85rem'
                          }}
                        >
                          <div style={{ fontWeight: 600, color: 'var(--accent-primary)', marginBottom: '0.35rem', fontSize: '0.8rem' }}>
                            Example {exIdx + 1}
                          </div>
                          <div style={{ marginBottom: '0.35rem' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Input: </span>
                            <pre style={{ margin: '0.2rem 0', background: '#090d16', padding: '0.4rem 0.6rem', borderRadius: 4, color: '#e2e8f0', fontSize: '0.8rem', overflowX: 'auto' }}>
                              {ex.input}
                            </pre>
                          </div>
                          <div style={{ marginBottom: '0.35rem' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Output: </span>
                            <pre style={{ margin: '0.2rem 0', background: '#090d16', padding: '0.4rem 0.6rem', borderRadius: 4, color: '#10b981', fontSize: '0.8rem', overflowX: 'auto' }}>
                              {ex.output}
                            </pre>
                          </div>
                          {ex.explanation && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Explanation: </span>
                              {ex.explanation}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Constraints */}
                {activeQuestion.constraints && (
                  <div>
                    <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>
                      Constraints
                    </div>
                    <div style={{ 
                      background: 'rgba(255,255,255,0.02)', 
                      border: '1px solid var(--border-subtle)', 
                      borderRadius: 'var(--radius-sm)', 
                      padding: '0.65rem 0.75rem', 
                      fontSize: '0.8rem', 
                      fontFamily: 'var(--font-mono)', 
                      color: '#94a3b8',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {activeQuestion.constraints}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                <BookOpen size={32} style={{ margin: '0 auto 0.75rem auto', opacity: 0.4 }} />
                <p>No problem selected.</p>
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 2 (CENTER): Shared Live IDE / Code Editor */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid var(--border-subtle)' }}>
          <CollaborativeCodeEditor
            code={collaborativeCode.code}
            language={collaborativeCode.language}
            syncStatus={collaborativeCode.syncStatus}
            onCodeChange={collaborativeCode.setCode}
            onLanguageChange={collaborativeCode.setLanguage}
            onResetTemplate={collaborativeCode.resetToTemplate}
            interviewId={interviewId}
            questionId={activeQuestion?.question_id || activeQuestion?.id || null}
            testCases={activeQuestion?.test_cases || []}
            onRunSuccess={loadSubmissions}
          />
        </div>

        {/* COLUMN 3 (RIGHT): Video Panels, Side Tabs, and Session Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', background: '#111827', overflowY: 'auto' }}>
          {/* Remote Video Tile (Peer) */}
          <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{
              height: '160px',
              background: '#1f2937',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              {webrtc.remoteStream && webrtc.peerMediaState.camera ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Video size={32} style={{ margin: '0 auto 0.35rem auto' }} />
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                    {userRole === 'interviewer' ? interview.candidate_name : interview.interviewer_name}
                  </div>
                  <div style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>
                    {webrtc.connectionState === 'connected' ? 'Peer camera is off' : 'Waiting for peer to connect...'}
                  </div>
                </div>
              )}

              {/* Role badge */}
              <span className="badge badge-secondary" style={{ position: 'absolute', bottom: 6, left: 6, fontSize: '0.65rem' }}>
                {userRole === 'interviewer' ? 'Candidate' : 'Interviewer'}
              </span>

              {/* Remote mic & screen share badges */}
              <div style={{ position: 'absolute', bottom: 6, right: 6, display: 'flex', gap: '0.35rem' }}>
                {webrtc.peerMediaState.screenSharing && (
                  <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>
                    Screen Active
                  </span>
                )}
                {!webrtc.peerMediaState.mic && (
                  <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>
                    Muted
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Local Video Tile (Self) */}
          <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{
              height: '140px',
              background: '#1a2234',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
              border: '1px solid rgba(99, 102, 241, 0.3)'
            }}>
              {webrtc.isCameraOn ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <>
                  <VideoOff size={28} color="#6b7280" />
                  <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Your Camera is Off
                  </div>
                </>
              )}

              <span className="badge badge-primary" style={{ position: 'absolute', bottom: 6, left: 6, fontSize: '0.65rem' }}>
                You ({userRole})
              </span>

              {/* Self Mic Indicator */}
              <div style={{ position: 'absolute', bottom: 6, right: 6 }}>
                {!webrtc.isMicOn && (
                  <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>
                    Muted
                  </span>
                )}
                {webrtc.isScreenSharing && (
                  <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>
                    Sharing
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Media Controls Bar */}
          <div style={{ padding: '0.75rem', display: 'flex', justifyContent: 'center', gap: '0.65rem', borderBottom: '1px solid var(--border-subtle)' }}>
            <button
              onClick={webrtc.toggleCamera}
              className={`btn btn-sm ${webrtc.isCameraOn ? 'btn-secondary' : 'btn-danger'}`}
              title={webrtc.isCameraOn ? 'Turn off camera' : 'Turn on camera'}
            >
              {webrtc.isCameraOn ? <Video size={15} /> : <VideoOff size={15} />}
            </button>

            <button
              onClick={webrtc.toggleMic}
              className={`btn btn-sm ${webrtc.isMicOn ? 'btn-secondary' : 'btn-danger'}`}
              title={webrtc.isMicOn ? 'Mute microphone' : 'Unmute microphone'}
            >
              {webrtc.isMicOn ? <Mic size={15} /> : <MicOff size={15} />}
            </button>

            <button
              onClick={webrtc.toggleScreenShare}
              className={`btn btn-sm ${webrtc.isScreenSharing ? 'btn-primary' : 'btn-secondary'}`}
              title={webrtc.isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
            >
              <Monitor size={15} />
            </button>
          </div>

          {/* Side Tabs Bar (Submissions vs Solution Notes) */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', background: '#0e1424' }}>
            <button
              onClick={() => setSideTab('submissions')}
              style={{
                flex: 1,
                padding: '0.5rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: sideTab === 'submissions' ? '#111827' : 'transparent',
                color: sideTab === 'submissions' ? 'var(--accent-primary)' : 'var(--text-muted)',
                border: 'none',
                borderBottom: sideTab === 'submissions' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem'
              }}
            >
              <History size={13} />
              <span>Runs ({submissions.length})</span>
            </button>

            <button
              onClick={() => setSideTab('notes')}
              style={{
                flex: 1,
                padding: '0.5rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: sideTab === 'notes' ? '#111827' : 'transparent',
                color: sideTab === 'notes' ? 'var(--accent-primary)' : 'var(--text-muted)',
                border: 'none',
                borderBottom: sideTab === 'notes' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem'
              }}
            >
              <FileText size={13} />
              <span>Notes</span>
            </button>
          </div>

          {/* Side Tab Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
            {sideTab === 'notes' ? (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Candidate notes: Time complexity, space complexity, edge cases..."
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: '160px',
                  background: 'transparent',
                  border: 'none',
                  color: '#e2e8f0',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.85rem',
                  lineHeight: '1.5',
                  resize: 'none',
                  outline: 'none',
                }}
              />
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Execution History</span>
                  <button onClick={loadSubmissions} className="btn btn-outline btn-sm" style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}>
                    <RotateCw size={11} />
                  </button>
                </div>

                {submissions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem', color: 'var(--text-muted)' }}>
                    <Terminal size={24} style={{ margin: '0 auto 0.5rem auto', opacity: 0.4 }} />
                    <p style={{ fontSize: '0.75rem' }}>Click "Run Code" in the IDE to test your solution.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {submissions.map((sub, idx) => (
                      <div
                        key={sub.id || idx}
                        style={{
                          background: '#0a0e17',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.65rem',
                          fontSize: '0.75rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <span style={{
                            padding: '0.15rem 0.5rem',
                            borderRadius: 9999,
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            background: sub.verdict === 'AC' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: sub.verdict === 'AC' ? '#34d399' : '#f87171',
                            border: `1px solid ${sub.verdict === 'AC' ? '#10b981' : '#ef4444'}`,
                          }}>
                            {sub.verdict}
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>
                            {new Date(sub.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div style={{ color: '#cbd5e1', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                          {sub.language} &bull; {sub.execution_time_ms ? `${sub.execution_time_ms}ms` : '0ms'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Action Button */}
          {userRole === 'interviewer' && (
            <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
              <button
                onClick={handleEndInterview}
                className="btn btn-primary btn-sm"
                style={{ width: '100%' }}
              >
                <CheckCircle2 size={15} />
                <span>Complete & Evaluate</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Question Bank Modal for Interviewer in active room */}
      {showQuestionBankModal && (
        <QuestionBankModal
          isOpen={showQuestionBankModal}
          onClose={() => setShowQuestionBankModal(false)}
          onSelectQuestion={handleAddQuestionFromBank}
          selectionMode={true}
        />
      )}

      {/* Candidate Rating & Review Modal */}
      {showReviewModal && interview && (
        <ReviewModal
          isOpen={showReviewModal}
          onClose={() => {
            setShowReviewModal(false);
            navigate('/candidate/dashboard');
          }}
          interview={interview}
          candidateId={user?.id}
          onReviewSubmitted={() => {
            loadExistingReview();
          }}
        />
      )}
    </div>
  );
}
