import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { getInterviewById, updateInterviewStatus } from '../services/interviewService';
import { useWebRTC } from '../hooks/useWebRTC';
import { useCollaborativeCode } from '../hooks/useCollaborativeCode';
import CollaborativeCodeEditor from '../components/interview/CollaborativeCodeEditor';
import VideoTile from '../components/interview/VideoTile';
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
  XCircle,
  Award,
  User,
  ExternalLink,
  Download,
  Eye
} from 'lucide-react';
import { getInterviewSubmissions } from '../services/codeExecutionService';
import ReviewModal from '../components/interview/ReviewModal';
import { getReviewByInterviewId } from '../services/reviewService';
import { 
  getInterviewQuestions, 
  addQuestionToInterview, 
  removeQuestionFromInterview,
  setActiveInterviewQuestion, 
  DEFAULT_SEED_QUESTIONS 
} from '../services/questionService';
import QuestionBankModal from '../components/questions/QuestionBankModal';
import { getCandidateResume, hasResume } from '../services/resumeService';
import LeetCodeQuestionPanel from '../components/interview/LeetCodeQuestionPanel';

function AuthorizedInterviewRoom({ interviewId, initialInterview, initialUserRole, user, profile }) {
  const navigate = useNavigate();

  const [interview, setInterview] = useState(initialInterview);
  const [userRole, setUserRole] = useState(initialUserRole || 'candidate'); // 'candidate' | 'interviewer'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Questions state
  const [questions, setQuestions] = useState([]);
  const [activeQuestionId, setActiveQuestionId] = useState(null);
  const [showQuestionBankModal, setShowQuestionBankModal] = useState(false);

  // Active room side tabs
  const [sideTab, setSideTab] = useState('video'); // 'video' | 'notes' | 'submissions' | 'candidate'
  const [notes, setNotes] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [submissions, setSubmissions] = useState([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [existingReview, setExistingReview] = useState(null);

  // Candidate Profile & Resume state (Phase 17)
  const [candidateProfile, setCandidateProfile] = useState(null);
  const [candidateResume, setCandidateResume] = useState(null);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [candidateHasResume, setCandidateHasResume] = useState(true);

  useEffect(() => {
    if (interview?.candidate_id) {
      supabase
        .from('profiles')
        .select('id, full_name, headline, bio, skills, github, linkedin, portfolio, leetcode, codeforces, codechef, username')
        .eq('id', interview.candidate_id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setCandidateProfile(data);
        });

      getCandidateResume(interview.candidate_id).then((res) => {
        setCandidateResume(res);
      });

      if (user?.id === interview.candidate_id) {
        hasResume(user.id).then((ok) => setCandidateHasResume(ok));
      }
    }
  }, [interview?.candidate_id, user?.id]);

  // Derive active question object
  const activeQuestion = questions.find(
    (q) => (q.question_id && q.question_id === activeQuestionId) || q.id === activeQuestionId
  ) || questions[0] || DEFAULT_SEED_QUESTIONS[0];

  // Derive available languages from active question
  const availableLanguages = React.useMemo(() => {
    if (Array.isArray(activeQuestion?.supported_languages) && activeQuestion.supported_languages.length > 0) {
      return activeQuestion.supported_languages;
    }
    if (activeQuestion?.starter_code && typeof activeQuestion.starter_code === 'object') {
      const keys = Object.keys(activeQuestion.starter_code).filter(k => Boolean(activeQuestion.starter_code[k]));
      if (keys.length > 0) return keys;
    }
    return ['python', 'cpp', 'java'];
  }, [activeQuestion]);

  // Draggable resizable panels state (Part 7)
  const [questionPanelWidth, setQuestionPanelWidth] = useState(() => {
    const saved = localStorage.getItem('mockmate_panel_width');
    const num = Number(saved);
    return !isNaN(num) && num >= 260 && num <= 700 ? num : 380;
  });
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDownResize = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e) => {
      const newWidth = Math.max(260, Math.min(e.clientX, Math.min(window.innerWidth - 450, 700)));
      setQuestionPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setQuestionPanelWidth((w) => {
        localStorage.setItem('mockmate_panel_width', String(w));
        return w;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleRemoveAssignedQuestion = async (qId) => {
    if (userRole !== 'interviewer') return;
    try {
      await removeQuestionFromInterview(qId);
      await loadQuestions();
    } catch (err) {
      alert('Failed to remove problem: ' + err.message);
    }
  };

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

  // Detect if interview is scheduled for a future timestamp and has not started
  const isScheduledFuture = Boolean(
    interview?.start_time &&
    new Date(interview.start_time).getTime() > Date.now() &&
    interview?.status !== 'active'
  );

  const [scheduledCountdown, setScheduledCountdown] = useState('');

  useEffect(() => {
    if (!isScheduledFuture || !interview?.start_time) return;

    const updateCountdown = () => {
      const diff = new Date(interview.start_time).getTime() - Date.now();
      if (diff <= 0) {
        setScheduledCountdown('Ready to start');
        return;
      }
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setScheduledCountdown(
        `${hours > 0 ? `${hours}h ` : ''}${minutes}m ${seconds}s`
      );
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [isScheduledFuture, interview?.start_time]);

  // WebRTC Audio/Video Hook (Only initialized when participant is authorized and session is explicitly active)
  const webrtc = useWebRTC({
    interviewId,
    userId: user?.id,
    userRole: userRole || initialUserRole || 'candidate',
    enabled: !loading && !error && Boolean(interview) && interview?.status === 'active' && (userRole === 'candidate' || userRole === 'interviewer'),
  });

  // Collaborative Code Editor Hook
  const collaborativeCode = useCollaborativeCode({
    interviewId,
    userId: user?.id,
    questionId: activeQuestion?.question_id || activeQuestion?.id || null,
    initialCode: interview?.code,
    initialLanguage: interview?.language,
    starterCodeByLang: activeQuestion?.starter_code || null,
    availableLanguages,
  });

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
            if (payload.new.status === 'completed') {
              try {
                webrtc?.stop?.();
              } catch (_) {}
              if (userRole === 'candidate') {
                navigate(`/interview/results/${interviewId}`, { replace: true });
                return;
              } else if (userRole === 'interviewer') {
                navigate(`/interview/evaluate/${interviewId}`, { replace: true });
                return;
              }
            }
            setInterview((prev) => {
              if (!prev) return payload.new;
              return {
                ...payload.new,
                code: prev.code,
                language: prev.language,
              };
            });
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
    if (userRole === 'interviewer') {
      if (window.confirm('End live interview session and proceed to candidate evaluation?')) {
        try {
          try {
            webrtc?.stop?.();
          } catch (_) {}
          await updateInterviewStatus(interview.id, 'completed', user.id);
        } catch (err) {
          console.error('[InterviewRoom] Error updating interview status to completed:', err);
        }
        navigate(`/interview/evaluate/${interview.id}`);
      }
      return;
    }

    if (userRole === 'candidate' && interview?.interviewer_id && !existingReview) {
      if (window.confirm('Would you like to rate your interviewer before leaving?')) {
        setShowReviewModal(true);
        return;
      }
    }

    if (!window.confirm('Are you sure you want to exit this interview session?')) return;
    navigate('/candidate/dashboard');
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

  if (!interview) return null;

  // 1. WAITING ROOM VIEW (status === 'waiting' || status === 'scheduled')
  if (interview.status === 'waiting' || interview.status === 'scheduled') {
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

          {/* Scheduled Countdown Alert (Section 9) */}
          {isScheduledFuture && (
            <div
              style={{
                background: 'rgba(168, 85, 247, 0.12)',
                border: '1px solid rgba(168, 85, 247, 0.35)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem 1.5rem',
                marginBottom: '1.5rem',
                textAlign: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#c084fc', fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.35rem' }}>
                <Clock size={20} />
                <span>Interview Scheduled</span>
              </div>
              <p style={{ color: '#e9d5ff', fontSize: '0.9rem', margin: '0 0 0.75rem 0' }}>
                Scheduled for {new Date(interview.start_time).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} at {new Date(interview.start_time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} ({interview.duration || 60} min)
              </p>
              <div style={{
                display: 'inline-block',
                fontFamily: 'var(--font-mono)',
                fontSize: '1.4rem',
                fontWeight: 700,
                color: '#a855f7',
                background: 'rgba(0,0,0,0.3)',
                padding: '0.35rem 1rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(168, 85, 247, 0.25)',
              }}>
                Starts in: {scheduledCountdown}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem', marginBottom: 0 }}>
                Camera, microphone, and live collaborative IDE will automatically initialize when the interview starts.
              </p>
            </div>
          )}

          {/* Candidate Resume Prerequisite Notice */}
          {userRole === 'candidate' && !candidateHasResume && (
            <div
              className="alert alert-warning"
              style={{
                marginBottom: '1.5rem',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                padding: '1rem 1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <FileText size={22} color="#f59e0b" style={{ flexShrink: 0 }} />
                <div>
                  <strong style={{ color: '#f59e0b' }}>Resume Required Before Starting</strong>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem' }}>
                    Please upload your resume in your profile so your interviewer can review your experience and tailor technical questions.
                  </p>
                </div>
              </div>
              <Link to="/profile" className="btn btn-primary btn-sm">
                Upload Resume
              </Link>
            </div>
          )}

          {/* Participants Card */}
          <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: '1.25rem 1.5rem', marginBottom: '1.5rem', textAlign: 'left', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Candidate:</span>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{interview.candidate_name}</div>
                <div style={{ marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {candidateResume ? (
                    <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                      Resume: {candidateResume.fileName}
                    </span>
                  ) : (
                    <span className="badge badge-secondary" style={{ fontSize: '0.7rem', color: '#f87171' }}>
                      No Resume Uploaded
                    </span>
                  )}
                  {candidateResume && (
                    <button
                      type="button"
                      onClick={() => setShowResumeModal(true)}
                      className="btn btn-outline btn-sm"
                      style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem' }}
                    >
                      <Eye size={11} /> View
                    </button>
                  )}
                </div>
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

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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

                    {userRole === 'interviewer' && (
                      <button
                        type="button"
                        onClick={() => handleRemoveAssignedQuestion(q.id)}
                        title="Remove question from interview"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#f87171',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0.25rem',
                        }}
                      >
                        <XCircle size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Device Pre-Check */}
          <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: '1.25rem 1.5rem', marginBottom: '2rem', textAlign: 'left', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Audio & Video Devices</span>
              {!isScheduledFuture && (
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
              )}
            </div>

            {isScheduledFuture ? (
              <div style={{
                padding: '1.5rem',
                textAlign: 'center',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
                border: '1px dashed var(--border-subtle)',
              }}>
                <Clock size={24} style={{ margin: '0 auto 0.5rem auto', color: '#a855f7' }} />
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  Devices on Standby
                </div>
                <div style={{ fontSize: '0.85rem' }}>
                  MockMate will request camera and microphone permissions when the scheduled session starts.
                </div>
              </div>
            ) : (
              <>
                {/* Permission Prompt or Denied Banner */}
                {webrtc.permissionStatus === 'denied' && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem 1rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    color: '#fca5a5',
                  }}>
                    <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px', color: '#ef4444' }} />
                    <div style={{ flex: 1, fontSize: '0.85rem' }}>
                      <div style={{ fontWeight: 600, color: '#f87171', marginBottom: '0.2rem' }}>
                        Camera/microphone permission was denied.
                      </div>
                      <div style={{ color: '#cbd5e1', marginBottom: '0.5rem' }}>
                        Please allow camera and microphone access in your browser settings and try again.
                      </div>
                      <button 
                        onClick={webrtc.requestMediaPermissions}
                        className="btn btn-sm btn-outline"
                        style={{ borderColor: 'rgba(239, 68, 68, 0.5)', color: '#fff' }}
                      >
                        Enable Camera & Microphone
                      </button>
                    </div>
                  </div>
                )}

                {webrtc.permissionStatus === 'prompt' && !webrtc.localStream && (
                  <div style={{
                    background: 'rgba(59, 130, 246, 0.12)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem 1rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    color: '#93c5fd',
                  }}>
                    <Info size={20} style={{ flexShrink: 0, marginTop: '2px', color: '#3b82f6' }} />
                    <div style={{ flex: 1, fontSize: '0.85rem' }}>
                      <div style={{ fontWeight: 600, color: '#60a5fa', marginBottom: '0.2rem' }}>
                        Camera & Microphone Required
                      </div>
                      <div style={{ color: '#cbd5e1', marginBottom: '0.5rem' }}>
                        MockMate needs access to your camera and microphone for the interview.
                      </div>
                      <button 
                        onClick={webrtc.requestMediaPermissions}
                        className="btn btn-sm btn-primary"
                      >
                        Enable Camera & Microphone
                      </button>
                    </div>
                  </div>
                )}

                {webrtc.permissionStatus === 'error' && (
                  <div style={{
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem 1rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    color: '#fde68a',
                  }}>
                    <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px', color: '#f59e0b' }} />
                    <div style={{ flex: 1, fontSize: '0.85rem' }}>
                      <div style={{ fontWeight: 600, color: '#fbbf24', marginBottom: '0.2rem' }}>
                        Media Device Issue
                      </div>
                      <div style={{ color: '#cbd5e1', marginBottom: '0.5rem' }}>
                        {webrtc.permissionError || 'Could not access camera or microphone.'}
                      </div>
                      <button 
                        onClick={webrtc.requestMediaPermissions}
                        className="btn btn-sm btn-outline"
                      >
                        Retry Connection
                      </button>
                    </div>
                  </div>
                )}

                {/* Local Camera Test Preview */}
                <VideoTile
                  stream={webrtc.localStream}
                  isLocal={true}
                  isCameraOn={webrtc.isCameraOn}
                  isMicOn={webrtc.isMicOn}
                  participantName="Your Camera"
                  role={userRole}
                  height="180px"
                />
              </>
            )}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem' }}>
            <span 
              style={{ 
                width: 8, 
                height: 8, 
                borderRadius: '50%', 
                background: webrtc.connectionState === 'connected' ? '#10b981' : (webrtc.connectionState === 'connecting' || webrtc.connectionState === 'reconnecting') ? '#f59e0b' : '#6b7280',
                boxShadow: webrtc.connectionState === 'connected' ? '0 0 6px #10b981' : 'none'
              }} 
            />
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
              {webrtc.connectionState === 'connected' 
                ? 'Connected' 
                : webrtc.connectionState === 'connecting' 
                ? 'Connecting...' 
                : webrtc.connectionState === 'reconnecting' 
                ? 'Reconnecting...' 
                : 'Disconnected'}
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
        gridTemplateColumns: `${questionPanelWidth}px 5px 1fr 340px`, 
        flex: 1, 
        overflow: 'hidden',
        userSelect: isResizing ? 'none' : 'auto',
      }}>
        {/* COLUMN 1 (LEFT): LeetCode-Style Question Panel */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          borderRight: '1px solid var(--border-subtle)', 
          background: '#0d1321', 
          overflow: 'hidden' 
        }}>
          <LeetCodeQuestionPanel
            questions={questions}
            activeQuestion={activeQuestion}
            onSelectQuestion={handleSwitchQuestion}
            onAddQuestion={() => setShowQuestionBankModal(true)}
            canAddQuestion={userRole === 'interviewer'}
            role={userRole}
            isSynced={true}
          />
        </div>

        {/* DRAGGABLE VERTICAL DIVIDER (PART 7) */}
        <div
          onMouseDown={handleMouseDownResize}
          title="Drag to resize Question Panel and Editor"
          style={{
            width: '5px',
            cursor: 'col-resize',
            background: isResizing ? '#6366f1' : 'rgba(255, 255, 255, 0.08)',
            zIndex: 10,
            transition: isResizing ? 'none' : 'background 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ width: '2px', height: '28px', background: isResizing ? '#a5b4fc' : 'rgba(255, 255, 255, 0.2)', borderRadius: '1px' }} />
        </div>

        {/* COLUMN 2 (CENTER): Shared Live IDE / Code Editor */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid var(--border-subtle)' }}>
          <CollaborativeCodeEditor
            code={collaborativeCode.code}
            language={collaborativeCode.language}
            availableLanguages={availableLanguages}
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
          {/* Permission warning banner in active room if denied */}
          {webrtc.permissionStatus === 'denied' && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
              padding: '0.6rem 0.75rem',
              fontSize: '0.75rem',
              color: '#fca5a5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
            }}>
              <span>Camera/mic access denied.</span>
              <button 
                onClick={webrtc.requestMediaPermissions}
                className="btn btn-xs btn-outline"
                style={{ borderColor: 'rgba(239, 68, 68, 0.5)', color: '#fff', fontSize: '0.7rem' }}
              >
                Enable
              </button>
            </div>
          )}

          {/* Remote Video Tile (Peer) */}
          <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ marginBottom: '0.4rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {userRole === 'interviewer' ? 'Candidate Camera' : 'Interviewer Camera'}
            </div>
            <VideoTile
              stream={webrtc.remoteStream}
              isLocal={false}
              isCameraOn={webrtc.peerMediaState.camera}
              isMicOn={webrtc.peerMediaState.mic}
              isScreenSharing={webrtc.peerMediaState.screenSharing}
              participantName={userRole === 'interviewer' ? (interview.candidate_name || 'Candidate') : (interview.interviewer_name || 'Interviewer')}
              role={userRole === 'interviewer' ? 'candidate' : 'interviewer'}
              height="160px"
              waitingMessage={userRole === 'interviewer' ? 'Waiting for candidate...' : 'Waiting for interviewer...'}
            />
          </div>

          {/* Local Video Tile (Self) */}
          <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ marginBottom: '0.4rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Your Camera
            </div>
            <VideoTile
              stream={webrtc.localStream}
              isLocal={true}
              isCameraOn={webrtc.isCameraOn}
              isMicOn={webrtc.isMicOn}
              isScreenSharing={webrtc.isScreenSharing}
              participantName="You"
              role={userRole}
              height="140px"
            />
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

            <button
              onClick={() => setSideTab('candidate')}
              style={{
                flex: 1,
                padding: '0.5rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: sideTab === 'candidate' ? '#111827' : 'transparent',
                color: sideTab === 'candidate' ? 'var(--accent-primary)' : 'var(--text-muted)',
                border: 'none',
                borderBottom: sideTab === 'candidate' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem'
              }}
            >
              <User size={13} />
              <span>Candidate</span>
            </button>
          </div>

          {/* Side Tab Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
            {sideTab === 'candidate' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ background: '#0a0e17', borderRadius: 'var(--radius-sm)', padding: '0.85rem', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc' }}>
                    {candidateProfile?.full_name || interview.candidate_name}
                  </div>
                  {candidateProfile?.headline && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--accent-secondary)', marginTop: '0.2rem' }}>
                      {candidateProfile.headline}
                    </div>
                  )}
                  {candidateProfile?.bio && (
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.4rem 0 0 0', lineHeight: 1.4 }}>
                      "{candidateProfile.bio}"
                    </p>
                  )}
                </div>

                {/* Resume Section (Phase 17) */}
                <div style={{ background: '#0a0e17', borderRadius: 'var(--radius-sm)', padding: '0.85rem', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.4rem' }}>
                    Resume Document
                  </div>
                  {candidateResume ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                        <FileText size={15} color="#818cf8" />
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0' }}>
                          {candidateResume.fileName}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowResumeModal(true)}
                        className="btn btn-primary btn-sm"
                        style={{ width: '100%', fontSize: '0.75rem', padding: '0.3rem 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                      >
                        <Eye size={13} />
                        <span>View Resume</span>
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No resume uploaded by candidate.
                    </div>
                  )}
                </div>

                {/* Coding & Competitive Handles */}
                <div style={{ background: '#0a0e17', borderRadius: 'var(--radius-sm)', padding: '0.85rem', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem' }}>
                    Coding Profiles
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.75rem' }}>
                    {candidateProfile?.leetcode && (
                      <a
                        href={candidateProfile.leetcode.startsWith('http') ? candidateProfile.leetcode : `https://leetcode.com/${candidateProfile.leetcode}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none' }}
                      >
                        <Code2 size={12} />
                        <span>LeetCode: {candidateProfile.leetcode.split('/').pop()}</span>
                        <ExternalLink size={10} />
                      </a>
                    )}
                    {candidateProfile?.codeforces && (
                      <a
                        href={candidateProfile.codeforces.startsWith('http') ? candidateProfile.codeforces : `https://codeforces.com/profile/${candidateProfile.codeforces}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none' }}
                      >
                        <Code2 size={12} />
                        <span>Codeforces: {candidateProfile.codeforces}</span>
                        <ExternalLink size={10} />
                      </a>
                    )}
                    {candidateProfile?.codechef && (
                      <a
                        href={candidateProfile.codechef.startsWith('http') ? candidateProfile.codechef : `https://www.codechef.com/users/${candidateProfile.codechef}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#a855f7', display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none' }}
                      >
                        <Code2 size={12} />
                        <span>CodeChef: {candidateProfile.codechef}</span>
                        <ExternalLink size={10} />
                      </a>
                    )}
                    {candidateProfile?.github && (
                      <a
                        href={candidateProfile.github.startsWith('http') ? candidateProfile.github : `https://${candidateProfile.github}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none' }}
                      >
                        <span>GitHub Profile</span>
                        <ExternalLink size={10} />
                      </a>
                    )}
                    {candidateProfile?.linkedin && (
                      <a
                        href={candidateProfile.linkedin.startsWith('http') ? candidateProfile.linkedin : `https://${candidateProfile.linkedin}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none' }}
                      >
                        <span>LinkedIn Profile</span>
                        <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>

                {/* Skills */}
                {candidateProfile?.skills && candidateProfile.skills.length > 0 && (
                  <div style={{ background: '#0a0e17', borderRadius: 'var(--radius-sm)', padding: '0.85rem', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.4rem' }}>
                      Verified Skills
                    </div>
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                      {candidateProfile.skills.map((s, idx) => (
                        <span key={idx} className="badge badge-secondary" style={{ fontSize: '0.68rem', padding: '1px 5px' }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <a
                  href={`/candidates/${candidateProfile?.username || interview.candidate_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline btn-sm"
                  style={{ width: '100%', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                >
                  <span>Open Full Public Profile</span>
                  <ExternalLink size={11} />
                </a>
              </div>
            ) : sideTab === 'notes' ? (
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

      {/* Candidate Resume Preview Modal (Phase 17) */}
      {showResumeModal && candidateResume && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(6px)',
            padding: '1.5rem',
          }}
          onClick={() => setShowResumeModal(false)}
        >
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '0.75rem',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <FileText size={20} color="#818cf8" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>
                    {candidateProfile?.full_name || interview.candidate_name}'s Resume
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {candidateResume.fileName} • Privacy Protected
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowResumeModal(false)}
                className="btn btn-outline btn-sm"
                style={{ padding: '0.25rem 0.5rem' }}
              >
                Close
              </button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
              {candidateResume.rawText ? (
                <pre
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.85rem',
                    color: '#cbd5e1',
                    lineHeight: '1.6',
                    fontFamily: 'var(--font-sans)',
                    whiteSpace: 'pre-wrap',
                    margin: 0,
                  }}
                >
                  {candidateResume.rawText}
                </pre>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)' }}>
                  <FileText size={36} color="#64748b" style={{ margin: '0 auto 0.5rem auto' }} />
                  <p>Document file: {candidateResume.fileName}</p>
                  {candidateResume.dataUrl && (
                    <a
                      href={candidateResume.dataUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-primary btn-sm"
                      style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <ExternalLink size={14} />
                      <span>Open Document in New Tab</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * InterviewRoomPage: Gatekeeper component enforcing participant authorization.
 * STRICT SECURITY: Does NOT mount WebRTC, camera, microphone, Monaco editor,
 * or collaborative channels until participant authorization succeeds.
 */
export default function InterviewRoomPage() {
  const { id: interviewId } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [interview, setInterview] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function verifyAndLoad() {
      if (!interviewId || !user?.id) return;
      try {
        const res = await getInterviewById(interviewId, user.id);
        if (!isMounted) return;

        if (!res.isAuthorized || !res.interview) {
          setError(res.error || 'You are not a participant in this interview.');
          setLoading(false);
          return;
        }

        if (res.interview.status === 'completed') {
          if (res.userRoleInInterview === 'interviewer' && !res.interview.score) {
            navigate(`/interview/evaluate/${interviewId}`, { replace: true });
          } else {
            navigate(`/interview/results/${interviewId}`, { replace: true });
          }
          return;
        }

        if (res.interview.status !== 'waiting' && res.interview.status !== 'active' && res.interview.status !== 'scheduled') {
          setError('This interview is not currently active, waiting, or scheduled.');
          setLoading(false);
          return;
        }

        setInterview(res.interview);
        setUserRole(res.userRoleInInterview);
        setLoading(false);
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to authorize interview session.');
          setLoading(false);
        }
      }
    }

    verifyAndLoad();
    return () => {
      isMounted = false;
    };
  }, [interviewId, user?.id, navigate]);

  if (loading) {
    return (
      <div className="container" style={{ padding: '6rem 1.5rem', textAlign: 'center' }}>
        <RotateCw size={36} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem auto', color: 'var(--accent-primary)' }} />
        <h2>Verifying Interview Authorization...</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Validating participant security and credentials</p>
      </div>
    );
  }

  if (error || !interview) {
    const dashboardPath = profile?.role === 'interviewer' ? '/interviewer/dashboard' : '/candidate/dashboard';
    return (
      <div className="container" style={{ padding: '5rem 1.5rem', maxWidth: '540px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.04)' }}>
          <ShieldAlert size={52} color="#ef4444" style={{ margin: '0 auto 1.25rem auto' }} />
          <h2 style={{ fontSize: '1.6rem', marginBottom: '0.75rem', color: '#f87171' }}>Access Denied</h2>
          <p style={{ color: '#f1f5f9', marginBottom: '0.5rem', fontSize: '1.05rem', fontWeight: 600 }}>
            {error || 'You are not a participant in this interview.'}
          </p>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.75rem', fontSize: '0.875rem', lineHeight: 1.5 }}>
            This interview room is strictly private to the assigned interviewer and candidate.
          </p>
          <Link to={dashboardPath} className="btn btn-primary" style={{ width: '100%', maxWidth: '240px', margin: '0 auto' }}>
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AuthorizedInterviewRoom
      interviewId={interviewId}
      initialInterview={interview}
      initialUserRole={userRole}
      user={user}
      profile={profile}
    />
  );
}

