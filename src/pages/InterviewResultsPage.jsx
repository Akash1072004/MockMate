import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getInterviewEvaluation } from '../services/evaluationService';
import {
  Award,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  ArrowLeft,
  Printer,
  RotateCcw,
  Code2,
  FileText,
  Clock,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Target,
  Terminal,
  Cpu
} from 'lucide-react';

export default function InterviewResultsPage() {
  const { id: interviewId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadReport() {
      if (!interviewId) return;
      setLoading(true);
      setError('');
      try {
        const res = await getInterviewEvaluation(interviewId);
        if (res.error) {
          setError(res.error);
        } else {
          setReport(res);
        }
      } catch (err) {
        console.error('[InterviewResultsPage] Load error:', err);
        setError(err.message || 'Failed to generate interview report.');
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, [interviewId]);

  if (loading) {
    return (
      <div className="container" style={{ padding: '6rem 1.5rem', textAlign: 'center' }}>
        <div style={{
          maxWidth: '460px',
          margin: '0 auto',
          background: '#111827',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '3rem 2rem',
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'rgba(99, 102, 241, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem auto',
            border: '1px solid rgba(99, 102, 241, 0.3)',
          }}>
            <Sparkles size={28} color="#818cf8" style={{ animation: 'pulse 1.5s infinite' }} />
          </div>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '0.6rem' }}>Synthesizing Evaluation</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
            Gemini AI is analyzing your code submissions, architectural trade-offs, and communication clarity to generate your comprehensive debrief...
          </p>
        </div>
      </div>
    );
  }

  if (error || !report?.evaluation) {
    return (
      <div className="container" style={{ padding: '5rem 1.5rem', maxWidth: '600px' }}>
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <AlertTriangle size={38} color="#f87171" style={{ margin: '0 auto 1rem auto' }} />
          <h2 style={{ marginBottom: '0.5rem' }}>Unable to Load Evaluation</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.925rem' }}>
            {error || 'The requested evaluation report could not be found or processed.'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
            <Link to="/candidate/dashboard" className="btn btn-outline">
              <ArrowLeft size={16} />
              <span>Back to Dashboard</span>
            </Link>
            <button onClick={() => window.location.reload()} className="btn btn-primary">
              <RotateCcw size={16} />
              <span>Retry</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { interview, evaluation, questions = [], answers = [], submissions = [] } = report;
  const overall = evaluation.overallScore ?? report.score ?? 8.0;

  const getVerdictStyle = (v) => {
    switch (v) {
      case 'Strong Hire':
        return { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', text: '#34d399' };
      case 'Hire':
        return { bg: 'rgba(6, 182, 212, 0.15)', border: '#06b6d4', text: '#38bdf8' };
      case 'Leaning Hire':
        return { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', text: '#fbbf24' };
      default:
        return { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#f87171' };
    }
  };

  const verdictStyle = getVerdictStyle(evaluation.verdict);

  // Map answers by question_id
  const answerMap = new Map();
  answers.forEach((a) => answerMap.set(a.question_id, a));

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem 5rem 1.5rem', maxWidth: '1080px' }}>
      {/* Top Header Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <Link to="/candidate/dashboard" className="btn btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <ArrowLeft size={15} />
          <span>Dashboard</span>
        </Link>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => window.print()}
            className="btn btn-outline btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Printer size={15} />
            <span>Print Report</span>
          </button>
          <Link
            to="/interview/ai"
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RotateCcw size={15} />
            <span>New Session</span>
          </Link>
        </div>
      </div>

      {/* Main Scorecard Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #131b2e 0%, #0d1322 100%)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '2.5rem',
        marginBottom: '2rem',
        boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 240px) 1fr', gap: '2.5rem', alignItems: 'center' }}>
          {/* Radial Score Gauge Card */}
          <div style={{
            background: '#090d16',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 'var(--radius-md)',
            padding: '2rem 1.5rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{
              width: '110px',
              height: '110px',
              borderRadius: '50%',
              background: `conic-gradient(#6366f1 ${overall * 10}%, rgba(255,255,255,0.05) 0)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
            }}>
              <div style={{
                width: '90px',
                height: '90px',
                borderRadius: '50%',
                background: '#090d16',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: '#f9fafb', lineHeight: 1 }}>
                  {overall}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>out of 10</span>
              </div>
            </div>

            <div style={{
              padding: '0.35rem 0.9rem',
              borderRadius: 9999,
              fontSize: '0.825rem',
              fontWeight: 700,
              background: verdictStyle.bg,
              border: `1px solid ${verdictStyle.border}`,
              color: verdictStyle.text,
            }}>
              {evaluation.verdict || 'Completed'}
            </div>
          </div>

          {/* Executive Summary */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span className="badge badge-primary" style={{ fontSize: '0.8rem' }}>
                {interview?.interview_type || 'Technical'} Mock Interview
              </span>
              <span className="badge badge-secondary" style={{ fontSize: '0.8rem' }}>
                {interview?.difficulty || 'Medium'}
              </span>
              {interview?.duration && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.5rem' }}>
                  <Clock size={13} />
                  <span>{interview.duration} mins</span>
                </span>
              )}
            </div>

            <h1 style={{ fontSize: '1.85rem', marginBottom: '0.85rem', color: '#f9fafb' }}>
              AI Interview Evaluation Debrief
            </h1>

            <p style={{ color: '#cbd5e1', fontSize: '0.95rem', lineHeight: '1.7', margin: 0 }}>
              {evaluation.summary}
            </p>
          </div>
        </div>
      </div>

      {/* Competency Breakdown Cards */}
      {evaluation.categoryScores && (
        <div style={{ marginBottom: '2.5rem' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: '#f9fafb', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={20} color="#818cf8" />
            <span>Core Competencies Breakdown</span>
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            {[
              { label: 'Problem Solving', score: evaluation.categoryScores.problemSolving, desc: 'Decomposition & logic' },
              { label: 'Code Quality', score: evaluation.categoryScores.codeQuality, desc: 'Structure & syntax' },
              { label: 'Communication', score: evaluation.categoryScores.communication, desc: 'Clarity & explanation' },
              { label: 'Technical Accuracy', score: evaluation.categoryScores.technicalAccuracy, desc: 'Correctness & depth' },
              { label: 'Complexity Analysis', score: evaluation.categoryScores.complexityAnalysis, desc: 'Time & space bounds' },
            ].map((cat, idx) => (
              <div
                key={idx}
                style={{
                  background: '#111827',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                }}
              >
                <div style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '0.25rem' }}>
                  {cat.label}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  {cat.desc}
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f9fafb' }}>
                    {cat.score ?? '—'}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/ 10</span>
                </div>

                <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, Math.max(0, (cat.score || 0) * 10))}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #6366f1, #06b6d4)',
                    borderRadius: '3px',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strengths & Targeted Improvements */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2.5rem' }}>
        {/* Strengths Card */}
        <div style={{
          background: '#111827',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.75rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#34d399' }}>
            <ShieldCheck size={22} />
            <h3 style={{ fontSize: '1.15rem', margin: 0, color: '#f9fafb' }}>Key Strengths Demonstrated</h3>
          </div>

          <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {(evaluation.strengths || []).map((s, idx) => (
              <li key={idx} style={{ color: '#cbd5e1', fontSize: '0.925rem', lineHeight: '1.5' }}>
                {s}
              </li>
            ))}
          </ul>
        </div>

        {/* Areas for Improvement */}
        <div style={{
          background: '#111827',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.75rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#fbbf24' }}>
            <Target size={22} />
            <h3 style={{ fontSize: '1.15rem', margin: 0, color: '#f9fafb' }}>Focus Areas for Growth</h3>
          </div>

          <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {(evaluation.improvements || []).map((imp, idx) => (
              <li key={idx} style={{ color: '#cbd5e1', fontSize: '0.925rem', lineHeight: '1.5' }}>
                {imp}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Question-by-Question Deep Dive */}
      {questions && questions.length > 0 && (
        <div style={{ marginBottom: '2.5rem' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '1.25rem', color: '#f9fafb', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={20} color="#818cf8" />
            <span>Question-by-Question Evaluation</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {questions.map((q, idx) => {
              const ans = answerMap.get(q.id);
              const fb = (evaluation.questionFeedback || []).find((f) => f.questionOrder === (q.question_order || idx + 1));

              return (
                <div
                  key={q.id || idx}
                  style={{
                    background: '#111827',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1.5rem',
                  }}
                >
                  {/* Question Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <span className="badge badge-secondary" style={{ marginRight: '0.5rem', textTransform: 'capitalize' }}>
                        {q.question_type || 'Problem'} #{q.question_order || idx + 1}
                      </span>
                    </div>

                    {fb?.score != null && (
                      <div style={{
                        padding: '0.2rem 0.65rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(99, 102, 241, 0.15)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        color: '#a5b4fc',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                      }}>
                        Score: {fb.score} / 10
                      </div>
                    )}
                  </div>

                  {/* Problem Statement */}
                  <div style={{ fontSize: '0.95rem', color: '#f9fafb', fontWeight: 500, marginBottom: '1rem', lineHeight: '1.5' }}>
                    {q.question_text}
                  </div>

                  {/* Candidate Answer / Code Snapshot */}
                  {q.question_type === 'coding' ? (
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                        Candidate Code Submission:
                      </div>
                      <pre style={{
                        background: '#090d16',
                        padding: '0.85rem 1rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        color: '#e2e8f0',
                        fontSize: '0.825rem',
                        fontFamily: 'var(--font-mono)',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                      }}>
                        {ans?.code_snapshot || interview?.code || '// No code written'}
                      </pre>
                    </div>
                  ) : ans?.candidate_answer ? (
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                        Candidate Answer:
                      </div>
                      <div style={{
                        background: '#090d16',
                        padding: '0.85rem 1rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        color: '#cbd5e1',
                        fontSize: '0.9rem',
                        lineHeight: '1.5',
                      }}>
                        {ans.candidate_answer}
                      </div>
                    </div>
                  ) : null}

                  {/* Evaluator Feedback */}
                  {fb && (
                    <div style={{
                      background: 'rgba(99, 102, 241, 0.05)',
                      border: '1px solid rgba(99, 102, 241, 0.2)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '1rem',
                    }}>
                      <div style={{ fontSize: '0.825rem', fontWeight: 600, color: '#818cf8', marginBottom: '0.35rem' }}>
                        AI Evaluator Feedback:
                      </div>
                      <p style={{ fontSize: '0.875rem', color: '#cbd5e1', lineHeight: '1.5', margin: '0 0 0.5rem 0' }}>
                        {fb.feedback}
                      </p>

                      {fb.optimalApproach && (
                        <div style={{ fontSize: '0.825rem', color: '#94a3b8', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                          <span style={{ fontWeight: 600, color: '#38bdf8' }}>Optimal Strategy: </span>
                          <span>{fb.optimalApproach}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom Practice CTA */}
      <div style={{
        textAlign: 'center',
        padding: '3rem 2rem',
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(6, 182, 212, 0.05) 100%)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
      }}>
        <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>Continue Your Interview Preparation</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginBottom: '1.5rem', maxWidth: '500px', margin: '0 auto 1.5rem auto' }}>
          Consistent deliberate practice is the key to passing top technical screens. Try another AI mock session or connect with a peer interviewer.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
          <Link to="/interview/ai" className="btn btn-primary">
            Start Another AI Interview
          </Link>
          <Link to="/candidate/find-interviewer" className="btn btn-outline">
            Schedule Peer Mock
          </Link>
        </div>
      </div>
    </div>
  );
}
