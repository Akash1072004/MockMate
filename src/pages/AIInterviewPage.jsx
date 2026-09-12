import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { startAIInterview, saveCandidateAnswer, completeInterviewSession } from '../services/aiInterviewService';
import CollaborativeCodeEditor from '../components/interview/CollaborativeCodeEditor';
import { CODE_TEMPLATES } from '../utils/codeTemplates';
import { 
  Bot, 
  Sparkles, 
  Clock, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  ChevronRight, 
  ChevronLeft, 
  Code2, 
  FileText, 
  Play, 
  RotateCw,
  Send,
  Award
} from 'lucide-react';

const TRACK_OPTIONS = ['DSA', 'Technical', 'Frontend', 'Backend', 'Full Stack', 'HR', 'Behavioral'];
const DIFFICULTY_OPTIONS = ['Easy', 'Medium', 'Hard'];
const DURATION_OPTIONS = [
  { value: 15, label: '15 Mins (2 Questions)' },
  { value: 30, label: '30 Mins (3 Questions)' },
  { value: 45, label: '45 Mins (4 Questions)' },
  { value: 60, label: '60 Mins (5 Questions)' },
];

export default function AIInterviewPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  // Setup state
  const [inSession, setInSession] = useState(false);
  const [interviewType, setInterviewType] = useState('DSA');
  const [difficulty, setDifficulty] = useState('Medium');
  const [duration, setDuration] = useState(30);
  const [starting, setStarting] = useState(false);
  const [setupError, setSetupError] = useState('');

  // Active session state
  const [interview, setInterview] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { [questionId]: { text, code, language } }
  const [showHints, setShowHints] = useState(false);
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Timer
  useEffect(() => {
    if (!inSession) return;
    const timer = setInterval(() => setElapsedSeconds((p) => p + 1), 1000);
    return () => clearInterval(timer);
  }, [inSession]);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start interview handler
  const handleStart = async (e) => {
    e.preventDefault();
    if (!user) return;

    setStarting(true);
    setSetupError('');

    try {
      const { interview: newInterview, questions: newQuestions } = await startAIInterview({
        candidateId: user.id,
        candidateName: profile?.full_name || user.email?.split('@')[0] || 'Candidate',
        interviewType,
        difficulty,
        duration,
      });

      setInterview(newInterview);
      setQuestions(newQuestions);
      setCurrentIndex(0);

      // Initialize answer state for first question
      const initialMap = {};
      newQuestions.forEach((q) => {
        initialMap[q.id] = {
          text: '',
          code: CODE_TEMPLATES.python,
          language: 'python',
        };
      });
      setAnswers(initialMap);
      setInSession(true);
    } catch (err) {
      console.error('[AIInterviewPage] Start error:', err);
      setSetupError(err.message || 'Failed to start AI interview session.');
    } finally {
      setStarting(false);
    }
  };

  const currentQuestion = questions[currentIndex] || {};
  const currentAnswer = answers[currentQuestion.id] || { text: '', code: CODE_TEMPLATES.python, language: 'python' };

  // Update answer state
  const updateCurrentAnswer = (field, value) => {
    if (!currentQuestion.id) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        [field]: value,
      },
    }));
  };

  // Persist current question answer to Supabase
  const persistAnswer = async () => {
    if (!interview?.id || !currentQuestion?.id) return;
    setSavingAnswer(true);
    try {
      await saveCandidateAnswer({
        interviewId: interview.id,
        questionId: currentQuestion.id,
        candidateAnswer: currentAnswer.text,
        codeSnapshot: currentQuestion.question_type === 'coding' ? currentAnswer.code : '',
      });
    } catch (err) {
      console.warn('[AIInterviewPage] Error saving answer:', err);
    } finally {
      setSavingAnswer(false);
    }
  };

  // Navigation handlers
  const handleNext = async () => {
    await persistAnswer();
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setShowHints(false);
    }
  };

  const handlePrevious = async () => {
    await persistAnswer();
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setShowHints(false);
    }
  };

  const handleFinish = async () => {
    if (!window.confirm('Are you sure you want to finish and submit this interview?')) return;
    setFinishing(true);
    try {
      await persistAnswer();
      await completeInterviewSession(interview.id);
      navigate(`/interview/results/${interview.id}`);
    } catch (err) {
      console.error('[AIInterviewPage] Finish error:', err);
      alert('Failed to complete interview: ' + err.message);
    } finally {
      setFinishing(false);
    }
  };

  // 1. CONFIGURATION SCREEN
  if (!inSession) {
    return (
      <div className="container" style={{ padding: '3.5rem 1.5rem', maxWidth: '680px' }}>
        <div className="card" style={{ padding: '2.5rem 2rem' }}>
          <Link to="/candidate/dashboard" className="btn btn-outline btn-sm" style={{ marginBottom: '1.25rem', display: 'inline-flex' }}>
            <ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </Link>

          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div className="feature-icon-wrapper" style={{ width: 52, height: 52, margin: '0 auto 1rem auto', background: 'rgba(99, 102, 241, 0.2)' }}>
              <Bot size={28} color="#818cf8" />
            </div>
            <h1 style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>Configure AI Mock Interview</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Gemini AI generates tailored, real-world technical and behavioral questions based on your selections.
            </p>
          </div>

          {setupError && (
            <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{setupError}</span>
            </div>
          )}

          <form onSubmit={handleStart}>
            {/* Track Selection */}
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" style={{ marginBottom: '0.6rem' }}>Interview Track</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.5rem' }}>
                {TRACK_OPTIONS.map((track) => (
                  <button
                    type="button"
                    key={track}
                    onClick={() => setInterviewType(track)}
                    className={`btn btn-sm ${interviewType === track ? 'btn-primary' : 'btn-outline'}`}
                    style={{ fontSize: '0.85rem' }}
                  >
                    {track}
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty Selection */}
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" style={{ marginBottom: '0.6rem' }}>Difficulty Level</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                {DIFFICULTY_OPTIONS.map((diff) => (
                  <button
                    type="button"
                    key={diff}
                    onClick={() => setDifficulty(diff)}
                    className={`btn ${difficulty === diff ? 'btn-primary' : 'btn-outline'}`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration Selection */}
            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label className="form-label" htmlFor="duration">Interview Duration</label>
              <select
                id="duration"
                className="form-select"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                {DURATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
              disabled={starting}
            >
              {starting ? (
                <>
                  <RotateCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Generating Questions with Gemini AI...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Generate & Start AI Interview</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. IN-SESSION INTERVIEW FLOW
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 70px)', background: '#0b0f19' }}>
      {/* Top Session Bar */}
      <div style={{
        height: '56px',
        background: '#111827',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="nav-brand-icon" style={{ width: 28, height: 28 }}>
            <Bot size={16} />
          </div>
          <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>
            {interviewType} AI Simulation
          </span>
          <span className="badge badge-secondary">{difficulty}</span>
          <span className="badge badge-primary">
            Question {currentIndex + 1} of {questions.length}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'var(--font-mono)', fontSize: '0.95rem', color: '#38bdf8' }}>
            <Clock size={16} />
            <span>{formatTimer(elapsedSeconds)}</span>
          </div>

          <button
            onClick={handleFinish}
            disabled={finishing}
            className="btn btn-outline btn-sm"
            style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
          >
            <span>{finishing ? 'Finishing...' : 'End Interview'}</span>
          </button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.3fr', flex: 1, overflow: 'hidden' }}>
        {/* LEFT COLUMN: Question Details & Hints */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid var(--border-subtle)',
          padding: '1.5rem',
          background: '#0e1422',
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span className="badge badge-primary" style={{ textTransform: 'capitalize' }}>
              {currentQuestion.question_type || 'Problem'}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Order #{currentQuestion.question_order || currentIndex + 1}
            </span>
          </div>

          {/* Question Text */}
          <div style={{
            fontSize: '1rem',
            lineHeight: '1.6',
            color: '#f9fafb',
            marginBottom: '1.5rem',
            whiteSpace: 'pre-line'
          }}>
            {currentQuestion.question_text}
          </div>

          {/* Expected Topics Tags */}
          {currentQuestion.expected_topics && currentQuestion.expected_topics.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                Key Concepts Evaluated:
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {currentQuestion.expected_topics.map((t, idx) => (
                  <span key={idx} className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Collapsible Hints */}
          {currentQuestion.hints && currentQuestion.hints.length > 0 && (
            <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => setShowHints(!showHints)}
                className="btn btn-outline btn-sm"
                style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}
              >
                <HelpCircle size={14} />
                <span>{showHints ? 'Hide AI Hints' : 'View AI Hints'}</span>
              </button>

              {showHints && (
                <div style={{
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem 1rem',
                  fontSize: '0.875rem',
                  color: '#fef3c7'
                }}>
                  <ul style={{ paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {currentQuestion.hints.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Code Editor / Conceptual Answer Textarea */}
        <div style={{ display: 'flex', flexDirection: 'column', background: '#090d16', overflow: 'hidden' }}>
          {currentQuestion.question_type === 'coding' ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <CollaborativeCodeEditor
                code={currentAnswer.code}
                language={currentAnswer.language}
                syncStatus={savingAnswer ? 'syncing' : 'synced'}
                onCodeChange={(c) => updateCurrentAnswer('code', c)}
                onLanguageChange={(l) => updateCurrentAnswer('language', l)}
                onResetTemplate={() => updateCurrentAnswer('code', CODE_TEMPLATES[currentAnswer.language])}
                interviewId={interview?.id}
              />
            </div>
          ) : (
            <div style={{ flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Your Answer & Architectural Explanation:
              </div>
              <textarea
                value={currentAnswer.text}
                onChange={(e) => updateCurrentAnswer('text', e.target.value)}
                placeholder="Type your structured answer, design trade-offs, and examples here..."
                style={{
                  flex: 1,
                  background: '#111827',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: '#f9fafb',
                  padding: '1rem',
                  fontSize: '0.95rem',
                  lineHeight: '1.6',
                  fontFamily: 'var(--font-sans)',
                  resize: 'none',
                  outline: 'none',
                }}
              />
            </div>
          )}

          {/* Navigation Control Bar */}
          <div style={{
            height: '60px',
            background: '#111827',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 1.5rem',
          }}>
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0 || savingAnswer}
              className="btn btn-secondary btn-sm"
            >
              <ChevronLeft size={16} />
              <span>Previous</span>
            </button>

            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {savingAnswer ? 'Auto-saving answer...' : 'Answer progress saved'}
            </span>

            {currentIndex < questions.length - 1 ? (
              <button
                onClick={handleNext}
                disabled={savingAnswer}
                className="btn btn-primary btn-sm"
              >
                <span>Save & Next Question</span>
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={finishing || savingAnswer}
                className="btn btn-primary btn-sm"
                style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
              >
                <CheckCircle2 size={16} />
                <span>Submit & Complete Interview</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
