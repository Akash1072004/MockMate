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
  Star
} from 'lucide-react';
import { getInterviewSubmissions } from '../services/codeExecutionService';
import ReviewModal from '../components/interview/ReviewModal';
import { getReviewByInterviewId } from '../services/reviewService';

export default function InterviewRoomPage() {
  const { id: interviewId } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [interview, setInterview] = useState(null);
  const [userRole, setUserRole] = useState('candidate'); // 'candidate' | 'interviewer'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Active room state
  const [activeTab, setActiveTab] = useState('editor'); // 'editor' | 'notes' | 'submissions'
  const [notes, setNotes] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [submissions, setSubmissions] = useState([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [existingReview, setExistingReview] = useState(null);

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

  useEffect(() => {
    loadSubmissions();
    loadExistingReview();
  }, [interviewId]);

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
    initialCode: interview?.code,
    initialLanguage: interview?.language,
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

    // Realtime listener for interview state changes (status, etc.)
    const channel = supabase
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
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
      const updated = await updateInterviewStatus(interview.id, 'active', user.id);
      setInterview(updated);
    } catch (err) {
      alert('Failed to start interview: ' + err.message);
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
      <div className="container" style={{ padding: '4rem 1.5rem', maxWidth: '720px' }}>
        <div className="card" style={{ padding: '3rem 2.5rem', textAlign: 'center' }}>
          <div className="badge badge-warning" style={{ margin: '0 auto 1rem auto' }}>
            Waiting Room
          </div>

          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
            {interview.interview_type} Interview
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
            Join Code: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{interview.join_code}</strong> | Difficulty: <strong>{interview.difficulty}</strong>
          </p>

          <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: '1.5rem', marginBottom: '2rem', textAlign: 'left', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Candidate:</span>
                <div style={{ fontWeight: 700 }}>{interview.candidate_name}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Interviewer:</span>
                <div style={{ fontWeight: 700 }}>{interview.interviewer_name}</div>
              </div>
            </div>

            {/* Device Pre-Check */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
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
        padding: '0 1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
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
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {interview.interview_type} &bull; {interview.difficulty}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
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

      {/* Main Room Split View */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', flex: 1, overflow: 'hidden' }}>
        {/* LEFT / MAIN AREA: Question & Synchronized Code Editor */}
        <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
          {/* Question Banner */}
          <div style={{ padding: '1rem 1.5rem', background: '#131b2e', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <h3 style={{ fontSize: '1.05rem', color: '#f9fafb' }}>
                Technical Problem: Algorithm Implementation
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setActiveTab('editor')}
                  className={`btn btn-sm ${activeTab === 'editor' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
                >
                  <Code2 size={13} />
                  <span>Code Editor</span>
                </button>
                <button
                  onClick={() => setActiveTab('notes')}
                  className={`btn btn-sm ${activeTab === 'notes' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
                >
                  <FileText size={13} />
                  <span>Solution Notes</span>
                </button>
                <button
                  onClick={() => setActiveTab('submissions')}
                  className={`btn btn-sm ${activeTab === 'submissions' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <History size={13} />
                  <span>Submissions</span>
                  {submissions.length > 0 && (
                    <span style={{
                      background: 'rgba(255,255,255,0.15)',
                      padding: '1px 5px',
                      borderRadius: 10,
                      fontSize: '0.7rem'
                    }}>
                      {submissions.length}
                    </span>
                  )}
                </button>
              </div>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Code keystrokes and language changes are synchronized in real time. Run code to execute against test cases.
            </p>
          </div>

          {/* Editor / Notes / Submissions Display Area */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {activeTab === 'editor' ? (
              <CollaborativeCodeEditor
                code={collaborativeCode.code}
                language={collaborativeCode.language}
                syncStatus={collaborativeCode.syncStatus}
                onCodeChange={collaborativeCode.setCode}
                onLanguageChange={collaborativeCode.setLanguage}
                onResetTemplate={collaborativeCode.resetToTemplate}
                interviewId={interviewId}
                onRunSuccess={loadSubmissions}
              />
            ) : activeTab === 'notes' ? (
              <div style={{ padding: '1.5rem', height: '100%', background: '#090d16' }}>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Candidate notes: Discuss time & space complexity, edge cases, trade-offs, and conceptual approaches..."
                  style={{
                    width: '100%',
                    height: '100%',
                    background: 'transparent',
                    border: 'none',
                    color: '#e2e8f0',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.95rem',
                    lineHeight: '1.6',
                    resize: 'none',
                    outline: 'none',
                  }}
                />
              </div>
            ) : (
              <div style={{ padding: '1.5rem', height: '100%', background: '#090d16', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ fontSize: '1rem', color: '#f9fafb' }}>Run & Submission History</h4>
                  <button onClick={loadSubmissions} className="btn btn-outline btn-sm" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
                    <RotateCw size={12} />
                    <span>Refresh</span>
                  </button>
                </div>

                {submissions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                    <Terminal size={32} style={{ margin: '0 auto 0.75rem auto', opacity: 0.4 }} />
                    <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>No code submissions recorded yet.</p>
                    <p style={{ fontSize: '0.8rem' }}>Click "Run Code" in the Code Editor to test and record your solution.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {submissions.map((sub, idx) => (
                      <div
                        key={sub.id || idx}
                        style={{
                          background: '#111827',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          padding: '1rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{
                              padding: '0.2rem 0.6rem',
                              borderRadius: 9999,
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: sub.verdict === 'AC' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              color: sub.verdict === 'AC' ? '#34d399' : '#f87171',
                              border: `1px solid ${sub.verdict === 'AC' ? '#10b981' : '#ef4444'}`,
                            }}>
                              {sub.verdict}
                            </span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0', textTransform: 'capitalize' }}>
                              {sub.language}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {sub.execution_time_ms != null && (
                              <span>{sub.execution_time_ms} ms</span>
                            )}
                            <span>{new Date(sub.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                          </div>
                        </div>

                        {sub.error ? (
                          <div style={{
                            background: 'rgba(239, 68, 68, 0.08)',
                            color: '#fca5a5',
                            padding: '0.5rem 0.75rem',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.8rem',
                            fontFamily: 'var(--font-mono)',
                            whiteSpace: 'pre-wrap',
                            marginBottom: '0.5rem'
                          }}>
                            {sub.error}
                          </div>
                        ) : sub.output ? (
                          <div style={{
                            background: '#090d16',
                            color: '#cbd5e1',
                            padding: '0.5rem 0.75rem',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.8rem',
                            fontFamily: 'var(--font-mono)',
                            whiteSpace: 'pre-wrap',
                            marginBottom: '0.5rem'
                          }}>
                            {sub.output}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT / SIDE AREA: WebRTC Video Panels & Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', background: '#111827', overflowY: 'auto' }}>
          {/* Remote Video Tile (Peer) */}
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{
              height: '180px',
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
                  <Video size={36} style={{ margin: '0 auto 0.4rem auto' }} />
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    {userRole === 'interviewer' ? interview.candidate_name : interview.interviewer_name}
                  </div>
                  <div style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>
                    {webrtc.connectionState === 'connected' ? 'Peer camera is off' : 'Waiting for peer to connect...'}
                  </div>
                </div>
              )}

              {/* Role badge */}
              <span className="badge badge-secondary" style={{ position: 'absolute', bottom: 8, left: 8, fontSize: '0.65rem' }}>
                {userRole === 'interviewer' ? 'Candidate' : 'Interviewer'}
              </span>

              {/* Remote mic & screen share badges */}
              <div style={{ position: 'absolute', bottom: 8, right: 8, display: 'flex', gap: '0.35rem' }}>
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
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{
              height: '180px',
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
                  <VideoOff size={32} color="#6b7280" />
                  <div style={{ marginTop: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Your Camera is Off
                  </div>
                </>
              )}

              <span className="badge badge-primary" style={{ position: 'absolute', bottom: 8, left: 8, fontSize: '0.65rem' }}>
                You ({userRole})
              </span>

              {/* Self Mic Indicator */}
              <div style={{ position: 'absolute', bottom: 8, right: 8 }}>
                {!webrtc.isMicOn && (
                  <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>
                    Muted
                  </span>
                )}
                {webrtc.isScreenSharing && (
                  <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>
                    Sharing Screen
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Media Controls Bar */}
          <div style={{ padding: '1rem', display: 'flex', justifyContent: 'center', gap: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
            <button
              onClick={webrtc.toggleCamera}
              className={`btn btn-sm ${webrtc.isCameraOn ? 'btn-secondary' : 'btn-danger'}`}
              title={webrtc.isCameraOn ? 'Turn off camera' : 'Turn on camera'}
            >
              {webrtc.isCameraOn ? <Video size={16} /> : <VideoOff size={16} />}
            </button>

            <button
              onClick={webrtc.toggleMic}
              className={`btn btn-sm ${webrtc.isMicOn ? 'btn-secondary' : 'btn-danger'}`}
              title={webrtc.isMicOn ? 'Mute microphone' : 'Unmute microphone'}
            >
              {webrtc.isMicOn ? <Mic size={16} /> : <MicOff size={16} />}
            </button>

            <button
              onClick={webrtc.toggleScreenShare}
              className={`btn btn-sm ${webrtc.isScreenSharing ? 'btn-primary' : 'btn-secondary'}`}
              title={webrtc.isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
            >
              <Monitor size={16} />
            </button>
          </div>

          {/* Status & Action Area */}
          <div style={{ padding: '1rem', marginTop: 'auto' }}>
            <div style={{ background: '#161f30', borderRadius: 'var(--radius-sm)', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', marginBottom: '0.25rem' }}>
                <CheckCircle2 size={14} />
                <span>Synchronized Realtime Channel Active</span>
              </div>
              <span>Code & audio/video are connected</span>
            </div>

            {userRole === 'interviewer' && (
              <button
                onClick={handleEndInterview}
                className="btn btn-primary btn-sm"
                style={{ width: '100%' }}
              >
                <CheckCircle2 size={16} />
                <span>Complete & Evaluate</span>
              </button>
            )}
          </div>
        </div>
      </div>

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
