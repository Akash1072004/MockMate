import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  startAIInterview, 
  saveCandidateAnswer, 
  completeInterviewSession, 
  sendAITurn 
} from '../services/aiInterviewService';
import { getCandidateResume, hasResume } from '../services/resumeService';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import CollaborativeCodeEditor from '../components/interview/CollaborativeCodeEditor';
import LeetCodeQuestionPanel from '../components/interview/LeetCodeQuestionPanel';
import { CODE_TEMPLATES } from '../utils/codeTemplates';
import { 
  Bot, 
  Sparkles, 
  Clock, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Code2, 
  FileText, 
  Play, 
  RotateCw,
  Send,
  Volume2,
  VolumeX,
  Award,
  ChevronRight,
  Mic,
  MicOff,
  Keyboard,
  Edit3,
  Check,
  User,
  MessageSquare,
  Maximize2
} from 'lucide-react';

const TRACK_OPTIONS = ['DSA', 'Technical', 'Frontend', 'Backend', 'Full Stack', 'Behavioral'];
const DIFFICULTY_OPTIONS = ['Easy', 'Medium', 'Hard'];
const DURATION_OPTIONS = [
  { value: 15, label: '15 Mins (Fast Track)' },
  { value: 30, label: '30 Mins (Standard Mock)' },
  { value: 45, label: '45 Mins (In-Depth Mock)' },
];

const STAGES = [
  { key: 'introduction', label: '1. Introduction', desc: 'Greeting & format overview' },
  { key: 'personal', label: '2. Background', desc: 'Tell me about yourself' },
  { key: 'resume_dive', label: '3. Resume Discussion', desc: 'Deep dive into projects' },
  { key: 'technical', label: '4. Technical Concepts', desc: 'Architecture & trade-offs' },
  { key: 'coding', label: '5. Live Coding', desc: 'Algorithm challenge' },
  { key: 'followup', label: '6. Complexity & Scaling', desc: 'Time, space & optimizations' },
  { key: 'evaluation', label: '7. Final Evaluation', desc: 'Performance debrief' },
];

export default function AIInterviewPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  // Resume state & pre-flight
  const [hasCandidateResume, setHasCandidateResume] = useState(null);
  const [candidateResume, setCandidateResume] = useState(null);
  const [checkingResume, setCheckingResume] = useState(true);

  // Setup state
  const [inSession, setInSession] = useState(false);
  const [interviewType, setInterviewType] = useState('DSA');
  const [difficulty, setDifficulty] = useState('Medium');
  const [duration, setDuration] = useState(30);
  const [starting, setStarting] = useState(false);
  const [setupError, setSetupError] = useState('');

  // Active session conversational state
  const [interview, setInterview] = useState(null);
  const [currentStage, setCurrentStage] = useState('introduction');
  const [messages, setMessages] = useState([]); // [{ role: 'assistant' | 'user', content: string, timestamp: string }]
  const [userInput, setUserInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [inputMode, setInputMode] = useState('speak'); // 'speak' | 'type'

  // Coding stage state
  const [activeCodingProblem, setActiveCodingProblem] = useState(null);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [showAiChatInCoding, setShowAiChatInCoding] = useState(true);

  // Speech-to-text hook
  const {
    isSupported: isSpeechSupported,
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    setTranscript,
  } = useSpeechRecognition();

  const messagesEndRef = useRef(null);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiTyping]);

  // Check resume pre-flight requirement on mount
  useEffect(() => {
    if (user?.id) {
      hasResume(user.id)
        .then((ok) => {
          setHasCandidateResume(ok);
          if (ok) {
            getCandidateResume(user.id).then((res) => setCandidateResume(res));
          }
        })
        .finally(() => setCheckingResume(false));
    }
  }, [user?.id]);

  // Timer
  useEffect(() => {
    if (!inSession) return;
    const timer = setInterval(() => setElapsedSeconds((p) => p + 1), 1000);
    return () => clearInterval(timer);
  }, [inSession]);

  const remainingSeconds = Math.max(0, duration * 60 - elapsedSeconds);
  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Text-to-speech helper
  const speakText = (text) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('[AIInterviewPage] Speech synthesis warning:', e);
    }
  };

  // Start interview session
  const handleStartInterview = async (e) => {
    if (e) e.preventDefault();
    if (!user) return;

    if (!hasCandidateResume) {
      setSetupError('Please upload your resume before starting an AI interview.');
      return;
    }

    setStarting(true);
    setSetupError('');

    try {
      const candidateName = profile?.full_name || user.email?.split('@')[0] || 'Candidate';
      const resumeSummary = candidateResume?.rawText || `Skills: ${(profile?.skills || []).join(', ')}. Bio: ${profile?.bio || ''}`;

      const { interview: newInterview } = await startAIInterview({
        candidateId: user.id,
        candidateName,
        interviewType,
        difficulty,
        duration,
      });

      setInterview(newInterview);
      setInSession(true);
      setCurrentStage('introduction');
      setIsAiTyping(true);

      const firstTurn = await sendAITurn({
        stage: 'introduction',
        candidateName,
        resumeText: resumeSummary,
        history: [],
        interviewType,
        difficulty,
      });

      const initialMessage = {
        role: 'assistant',
        content: firstTurn.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages([initialMessage]);
      speakText(firstTurn.reply);
      if (firstTurn.nextStage) {
        setCurrentStage(firstTurn.nextStage);
      }
    } catch (err) {
      console.error('[AIInterviewPage] Start error:', err);
      setSetupError(err.message || 'Failed to initialize AI interview.');
    } finally {
      setStarting(false);
      setIsAiTyping(false);
    }
  };

  // Candidate sends response (from typing or voice transcript)
  const handleSendResponse = async (textToSend) => {
    const trimmed = (textToSend || userInput || '').trim();
    if (!trimmed || isAiTyping) return;

    if (isListening) {
      stopListening();
    }
    resetTranscript();

    const userMsg = {
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setUserInput('');
    setIsAiTyping(true);

    try {
      const candidateName = profile?.full_name || user.email?.split('@')[0] || 'Candidate';
      const resumeSummary = candidateResume?.rawText || `Skills: ${(profile?.skills || []).join(', ')}`;

      const turn = await sendAITurn({
        stage: currentStage,
        candidateName,
        resumeText: resumeSummary,
        history: updatedHistory,
        lastUserMessage: trimmed,
        interviewType,
        difficulty,
        codingProblem: activeCodingProblem,
        code,
      });

      const aiMsg = {
        role: 'assistant',
        content: turn.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages([...updatedHistory, aiMsg]);
      speakText(turn.reply);

      if (turn.nextStage) {
        setCurrentStage(turn.nextStage);
      }

      if (turn.codingProblem) {
        setActiveCodingProblem(turn.codingProblem);
        const starter = turn.codingProblem.starter_code?.[language] || CODE_TEMPLATES[language] || '';
        setCode(starter);
      }
    } catch (err) {
      console.error('[AIInterviewPage] Turn error:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "I noted your response. Let's proceed forward with the next part of our discussion.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsAiTyping(false);
    }
  };

  // Complete session & evaluate
  const handleCompleteInterview = async () => {
    if (!interview?.id || completing) return;
    if (!window.confirm('Finish this interview and generate your AI evaluation report?')) return;

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    setCompleting(true);
    try {
      if (activeCodingProblem) {
        await saveCandidateAnswer({
          interviewId: interview.id,
          questionId: activeCodingProblem.id || 'ai-q1',
          candidateAnswer: messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n'),
          codeSnapshot: code,
        });
      }

      const completed = await completeInterviewSession(interview.id);
      navigate(`/interview/results/${completed.id || interview.id}`);
    } catch (err) {
      console.error('[AIInterviewPage] Complete error:', err);
      alert('Failed to complete interview: ' + err.message);
      setCompleting(false);
    }
  };

  // 1. RESUME REQUIRED SCREEN (PART 20 PRE-FLIGHT)
  if (!checkingResume && hasCandidateResume === false) {
    return (
      <div className="container" style={{ padding: '5rem 1.5rem', maxWidth: '640px' }}>
        <div className="card" style={{ padding: '3rem 2.5rem', textAlign: 'center', borderTop: '4px solid #f59e0b' }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'rgba(245, 158, 11, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem auto',
          }}>
            <FileText size={32} color="#f59e0b" />
          </div>

          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.75rem', color: '#f9fafb' }}>
            Resume Required
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.975rem', lineHeight: '1.6', marginBottom: '2rem' }}>
            Upload your resume before starting an AI interview. MockMate uses your resume to personalize questions, explore your real projects, and evaluate your architectural decisions.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <Link to="/profile" className="btn btn-primary btn-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={18} />
              <span>Go to Profile & Upload Resume</span>
            </Link>
            <Link to="/candidate/dashboard" className="btn btn-outline btn-lg">
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. SETUP SCREEN (Resume verified)
  if (!inSession) {
    return (
      <div className="container" style={{ padding: '3.5rem 1.5rem', maxWidth: '780px' }}>
        <Link to="/candidate/dashboard" className="btn btn-outline btn-sm" style={{ marginBottom: '1.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </Link>

        <div className="card" style={{ padding: '2.5rem', borderTop: '4px solid var(--accent-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={24} color="#818cf8" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.85rem' }}>Start AI Voice Interview</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                7-Stage Resume-Aware Technical Mock with Two-Way Voice & Live Coding
              </p>
            </div>
          </div>

          {/* Resume Verified Banner */}
          {hasCandidateResume && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              margin: '1.5rem 0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <CheckCircle2 size={18} color="#10b981" />
                <div>
                  <strong style={{ color: '#34d399', fontSize: '0.9rem' }}>Resume Ready & Parsed ✓</strong>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {candidateResume?.fileName || 'Resume on file'} &bull; AI will ask context-aware questions
                  </div>
                </div>
              </div>
              <Link to="/profile" style={{ fontSize: '0.8rem', color: '#38bdf8' }}>Change</Link>
            </div>
          )}

          {setupError && (
            <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
              <AlertCircle size={18} />
              <span>{setupError}</span>
            </div>
          )}

          <form onSubmit={handleStartInterview}>
            {/* Track Selection */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Interview Track
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.5rem' }}>
                {TRACK_OPTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setInterviewType(t)}
                    className={`btn btn-sm ${interviewType === t ? 'btn-primary' : 'btn-outline'}`}
                    style={{ textAlign: 'center' }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Target Difficulty
              </label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {DIFFICULTY_OPTIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    className={`btn btn-sm ${difficulty === d ? 'btn-primary' : 'btn-outline'}`}
                    style={{ flex: 1 }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Session Duration
              </label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDuration(opt.value)}
                    className={`btn btn-sm ${duration === opt.value ? 'btn-primary' : 'btn-outline'}`}
                    style={{ flex: 1 }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={starting}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              {starting ? (
                <>
                  <RotateCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Preparing AI Interview Session...</span>
                </>
              ) : (
                <>
                  <Play size={18} />
                  <span>Start AI Interview</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 3. CODING STAGE VIEW (STAGE 5)
  if (currentStage === 'coding' && activeCodingProblem) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 70px)', background: '#0b0f19' }}>
        {/* Coding Stage Header Bar */}
        <div style={{
          height: '56px',
          background: '#111827',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1.25rem',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>
              Mock<span className="text-gradient">Mate</span> AI Interview
            </span>
            <span className="badge badge-primary">Stage 5: Live Coding</span>
            <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
              {formatTimer(remainingSeconds)} remaining
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => setVoiceEnabled((v) => !v)}
              className="btn btn-outline btn-sm"
              title={voiceEnabled ? 'AI Voice Enabled' : 'AI Voice Muted'}
            >
              {voiceEnabled ? <Volume2 size={15} color="#34d399" /> : <VolumeX size={15} color="#94a3b8" />}
              <span>{voiceEnabled ? 'AI Voice On' : 'AI Voice Muted'}</span>
            </button>

            <button
              onClick={() => setShowAiChatInCoding((s) => !s)}
              className="btn btn-outline btn-sm"
            >
              <MessageSquare size={15} />
              <span>{showAiChatInCoding ? 'Hide AI Chat' : 'Show AI Chat'}</span>
            </button>

            <button
              onClick={handleCompleteInterview}
              disabled={completing}
              className="btn btn-primary btn-sm"
            >
              <Award size={15} />
              <span>{completing ? 'Evaluating...' : 'Complete Interview'}</span>
            </button>
          </div>
        </div>

        {/* 2-Column Split: LeetCode Question Panel + Monaco Editor (+ Collapsible AI Sidebar) */}
        <div style={{ display: 'grid', gridTemplateColumns: showAiChatInCoding ? '420px 1fr 340px' : '480px 1fr', flex: 1, overflow: 'hidden' }}>
          {/* Column 1: LeetCode-style Question Panel */}
          <div style={{ borderRight: '1px solid var(--border-subtle)', height: '100%', overflow: 'hidden' }}>
            <LeetCodeQuestionPanel
              questions={[activeCodingProblem]}
              activeQuestion={activeCodingProblem}
              role="candidate"
            />
          </div>

          {/* Column 2: Monaco Editor */}
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CollaborativeCodeEditor
              interviewId={interview?.id || 'ai-session'}
              initialCode={code}
              initialLanguage={language}
              availableLanguages={['python', 'cpp', 'java']}
              onCodeChange={(newCode) => setCode(newCode)}
              onLanguageChange={(newLang) => {
                setLanguage(newLang);
                if (activeCodingProblem?.starter_code?.[newLang]) {
                  setCode(activeCodingProblem.starter_code[newLang]);
                }
              }}
              readOnly={false}
              userId={user?.id}
              role="candidate"
            />
          </div>

          {/* Column 3: AI Interviewer Conversation Sidebar */}
          {showAiChatInCoding && (
            <div style={{ borderLeft: '1px solid var(--border-subtle)', background: '#0d1321', display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ padding: '0.75rem 1rem', background: '#111827', borderBottom: '1px solid var(--border-subtle)', fontWeight: 700, fontSize: '0.85rem', color: '#f9fafb' }}>
                AI Interviewer Discussion
              </div>

              {/* Chat Stream */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {messages.slice(-6).map((msg, idx) => (
                  <div key={idx} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%' }}>
                    <div style={{
                      background: msg.role === 'user' ? '#6366f1' : '#1e293b',
                      color: '#f9fafb',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.825rem',
                      lineHeight: 1.5,
                    }}>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Input Bar */}
              <div style={{ padding: '0.75rem', background: '#111827', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Explain your approach..."
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendResponse(userInput)}
                  style={{ flex: 1, fontSize: '0.825rem', padding: '0.4rem 0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: '#fff', borderRadius: 'var(--radius-sm)' }}
                />
                <button onClick={() => handleSendResponse(userInput)} className="btn btn-primary btn-sm">
                  <Send size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 4. MAIN CONVERSATIONAL INTERVIEW VIEW (STAGES 1 - 4 & 6 - 7)
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
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontWeight: 800, fontSize: '1.15rem' }}>
            Mock<span className="text-gradient">Mate</span> AI Interview
          </span>
          <span className="badge badge-primary">
            {interviewType} &bull; {difficulty}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'var(--font-mono)', fontSize: '0.95rem', color: '#38bdf8' }}>
            <Clock size={16} />
            <span>{formatTimer(remainingSeconds)} remaining</span>
          </div>

          <button
            onClick={() => setVoiceEnabled((v) => !v)}
            className="btn btn-outline btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            {voiceEnabled ? <Volume2 size={15} color="#34d399" /> : <VolumeX size={15} color="#94a3b8" />}
            <span>{voiceEnabled ? 'AI Voice On' : 'AI Voice Off'}</span>
          </button>

          <button
            onClick={handleCompleteInterview}
            disabled={completing}
            className="btn btn-primary btn-sm"
          >
            <Award size={15} />
            <span>{completing ? 'Evaluating...' : 'Finish & Evaluate'}</span>
          </button>
        </div>
      </div>

      {/* Main Split Layout: Left Conversation + Right Stepper */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', flex: 1, overflow: 'hidden' }}>
        {/* LEFT / MAIN CONVERSATION PANEL */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          {/* Chat Messages Stream */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.75rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  gap: '1rem',
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                }}
              >
                {msg.role === 'assistant' && (
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                  }}>
                    <Bot size={22} color="#fff" />
                  </div>
                )}

                <div>
                  <div style={{
                    background: msg.role === 'user' 
                      ? 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)' 
                      : '#111827',
                    border: msg.role === 'user' ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1.1rem 1.4rem',
                    color: '#f9fafb',
                    fontSize: '0.95rem',
                    lineHeight: '1.65',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
                  }}>
                    {msg.content}
                  </div>

                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem', textAlign: msg.role === 'user' ? 'right' : 'left', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <span>{msg.timestamp}</span>
                    {msg.role === 'assistant' && (
                      <button
                        onClick={() => speakText(msg.content)}
                        style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                        title="Replay Audio"
                      >
                        <Volume2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {msg.role === 'user' && (
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    background: 'var(--accent-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: '#000',
                    fontWeight: 700,
                    fontSize: '0.85rem'
                  }}>
                    {profile?.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'C'}
                  </div>
                )}
              </div>
            ))}

            {isAiTyping && (
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', alignSelf: 'flex-start' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bot size={20} color="#818cf8" />
                </div>
                <div style={{ background: '#111827', padding: '0.8rem 1.25rem', borderRadius: 'var(--radius-lg)', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#818cf8', animation: 'pulse 1s infinite' }}></span>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#818cf8', animation: 'pulse 1s 0.2s infinite' }}></span>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#818cf8', animation: 'pulse 1s 0.4s infinite' }}></span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>AI Interviewer is analyzing...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* BOTTOM CONTROLS & INTERACTION AREA */}
          <div style={{
            background: '#111827',
            borderTop: '1px solid var(--border-subtle)',
            padding: '1.25rem 2rem',
          }}>
            {/* Mode Switcher */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setInputMode('speak')}
                  className={`btn btn-sm ${inputMode === 'speak' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Mic size={14} />
                  <span>🎙 Speak</span>
                </button>
                <button
                  onClick={() => { setInputMode('type'); if (isListening) stopListening(); }}
                  className={`btn btn-sm ${inputMode === 'type' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Keyboard size={14} />
                  <span>⌨ Type</span>
                </button>
              </div>

              {!isSpeechSupported && inputMode === 'speak' && (
                <span style={{ fontSize: '0.8rem', color: '#f59e0b' }}>
                  Voice input is not supported in this browser. You can continue using text.
                </span>
              )}
            </div>

            {/* SPEAK MODE: Real Live Voice Transcription & Microphone Button */}
            {inputMode === 'speak' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{
                  background: '#090d16',
                  border: isListening ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  minHeight: '72px',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', color: isListening ? '#10b981' : 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                      {isListening ? '🎙 Listening... Speak Now' : 'Voice Transcript Preview'}
                    </div>
                    <div style={{ fontSize: '0.95rem', color: transcript || interimTranscript ? '#f9fafb' : 'var(--text-muted)' }}>
                      {transcript || interimTranscript || 'Click the microphone button to speak your answer...'}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={isListening ? stopListening : startListening}
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      background: isListening ? '#ef4444' : '#10b981',
                      border: 'none',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: isListening ? '0 0 16px rgba(239, 68, 68, 0.6)' : '0 0 12px rgba(16, 185, 129, 0.4)',
                      transition: 'all 0.2s ease',
                      flexShrink: 0,
                    }}
                    title={isListening ? 'Stop Listening' : 'Click to Speak'}
                  >
                    {isListening ? <MicOff size={22} /> : <Mic size={22} />}
                  </button>
                </div>

                {/* Transcript Action Controls */}
                {transcript && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <button
                      onClick={() => {
                        stopListening();
                        setUserInput(transcript);
                        setInputMode('type');
                      }}
                      className="btn btn-outline btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <Edit3 size={13} />
                      <span>Edit Transcript</span>
                    </button>
                    <button
                      onClick={() => handleSendResponse(transcript)}
                      className="btn btn-primary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <Send size={13} />
                      <span>Send Answer</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TYPE MODE: Direct Text Input Bar (Also accessible anytime) */}
            {inputMode === 'type' && (
              <form onSubmit={(e) => { e.preventDefault(); handleSendResponse(userInput); }} style={{ display: 'flex', gap: '0.75rem' }}>
                <textarea
                  rows={2}
                  placeholder="Type your response to the interviewer..."
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendResponse(userInput);
                    }
                  }}
                  style={{
                    flex: 1,
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.75rem 1rem',
                    color: '#f9fafb',
                    fontSize: '0.925rem',
                    resize: 'none',
                  }}
                />
                <button
                  type="submit"
                  disabled={!userInput.trim() || isAiTyping}
                  className="btn btn-primary"
                  style={{ padding: '0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Send size={16} />
                  <span>Send</span>
                </button>
              </form>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: 7-STAGE PROGRESS & RESUME CONTEXT */}
        <div style={{
          background: '#0e1422',
          borderLeft: '1px solid var(--border-subtle)',
          padding: '1.75rem 1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.75rem',
          overflowY: 'auto',
        }}>
          {/* Stepper Header */}
          <div>
            <h3 style={{ fontSize: '1rem', color: '#f9fafb', marginBottom: '0.25rem' }}>
              Interview Progress
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Adaptive structured evaluation
            </p>
          </div>

          {/* Stepper Progress List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {STAGES.map((s, idx) => {
              const stageOrder = STAGES.findIndex((x) => x.key === currentStage);
              const isPast = idx < stageOrder;
              const isCurrent = idx === stageOrder;

              return (
                <div
                  key={s.key}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    background: isCurrent ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                    border: isCurrent ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid transparent',
                  }}
                >
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: isPast ? '#10b981' : isCurrent ? '#6366f1' : 'rgba(255, 255, 255, 0.08)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    {isPast ? <Check size={13} /> : idx + 1}
                  </div>

                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: isCurrent ? 700 : 500, color: isCurrent ? '#a5b4fc' : isPast ? '#94a3b8' : 'var(--text-muted)' }}>
                      {s.label}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {s.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Resume Analyzed Card */}
          <div style={{
            background: 'rgba(99, 102, 241, 0.05)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#10b981' }}>
              <CheckCircle2 size={16} />
              <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Resume: Analyzed</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.4, margin: '0 0 0.65rem 0' }}>
              Alex is examining projects and tech stacks extracted from your verified resume.
            </p>

            {profile?.skills && profile.skills.length > 0 && (
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {(Array.isArray(profile.skills) ? profile.skills : profile.skills.split(',')).slice(0, 4).map((sk, skIdx) => (
                  <span key={skIdx} className="badge badge-secondary" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>
                    {typeof sk === 'string' ? sk.trim() : sk}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Current Topic Indicator */}
          <div style={{ marginTop: 'auto', background: 'rgba(255, 255, 255, 0.02)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.2rem', fontWeight: 600 }}>
              Current Focus
            </div>
            <div style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: 600 }}>
              {currentStage === 'introduction' ? 'Candidate Introduction'
                : currentStage === 'personal' ? 'Experience & Passion'
                : currentStage === 'resume_dive' ? 'Project Architecture'
                : currentStage === 'technical' ? 'Core Concepts & Trade-offs'
                : currentStage === 'coding' ? 'Live Coding Solution'
                : currentStage === 'followup' ? 'Time & Space Complexity'
                : 'Session Wrap-up'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
