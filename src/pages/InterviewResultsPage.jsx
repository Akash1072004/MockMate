import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getInterviewEvaluation, requestEvaluation } from '../services/evaluationService';
import { supabase } from '../lib/supabase';
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
  Cpu,
  Star
} from 'lucide-react';
import ReviewModal from '../components/interview/ReviewModal';
import { getReviewByInterviewId } from '../services/reviewService';

export default function InterviewResultsPage() {
  const { id: interviewId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [existingReview, setExistingReview] = useState(null);
  const [retryingAiEval, setRetryingAiEval] = useState(false);

  const handleRetryAiEval = async () => {
    if (!interviewId || retryingAiEval) return;
    setRetryingAiEval(true);
    setError('');
    try {
      const res = await requestEvaluation(interviewId);
      if (res && res.evaluation) {
        setReport((prev) => ({
          ...prev,
          evaluation: res.evaluation,
          score: res.score ?? res.evaluation?.overallScore,
          isPending: false,
        }));
      } else {
        await loadReport();
      }
    } catch (err) {
      console.error('[InterviewResultsPage] Retry evaluation error:', err);
      setError(err.message || 'Failed to generate evaluation report.');
    } finally {
      setRetryingAiEval(false);
    }
  };

  const loadReport = async () => {
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
      setError(err.message || 'Failed to load interview report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
    if (interviewId) {
      getReviewByInterviewId(interviewId).then(setExistingReview).catch(() => {});
    }
  }, [interviewId]);

  // Realtime subscription: update evaluation immediately when interviewer submits
  useEffect(() => {
    if (!interviewId || !supabase) return;

    const channel = supabase
      .channel(`interview_results_sync_${interviewId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'interviews',
          filter: `id=eq.${interviewId}`,
        },
        (payload) => {
          if (payload.new?.evaluation) {
            setReport((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                interview: { ...prev.interview, ...payload.new },
                evaluation: payload.new.evaluation,
                score: payload.new.score,
                isPending: false,
              };
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
          <h2 style={{ fontSize: '1.4rem', marginBottom: '0.6rem' }}>Loading Interview Evaluation</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
            Fetching verified evaluation report and candidate debrief from database...
          </p>
        </div>
      </div>
    );
  }

  const isInterviewer = user?.id === report?.interview?.interviewer_id;
  const dashboardPath = isInterviewer ? '/interviewer/dashboard' : '/candidate/dashboard';

  const isAiSession = Boolean(report?.interview?.is_ai);

  // EVALUATION PENDING / IN-FLIGHT STATE
  if (report?.isPending || (!report?.evaluation && report?.interview?.status === 'completed')) {
    // 1. Peer interview pending human evaluation
    if (!isAiSession) {
      return (
        <div className="container" style={{ padding: '5rem 1.5rem', maxWidth: '640px' }}>
          <div
            className="card"
            style={{
              padding: '3rem 2.5rem',
              textAlign: 'center',
              background: '#111827',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(245, 158, 11, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem auto',
                border: '1px solid rgba(245, 158, 11, 0.3)',
              }}
            >
              <Clock size={32} color="#f59e0b" />
            </div>

            <div className="badge badge-success" style={{ margin: '0 auto 1rem auto' }}>
              Interview Completed
            </div>

            <h2 style={{ fontSize: '1.6rem', marginBottom: '0.5rem', color: '#f9fafb' }}>
              Evaluation: <span style={{ color: '#f59e0b' }}>Pending</span>
            </h2>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.975rem', lineHeight: '1.6', marginBottom: '1.75rem' }}>
              The interviewer has not submitted the final evaluation yet.
            </p>

            <div
              style={{
                background: 'rgba(0,0,0,0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                marginBottom: '2rem',
                border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.6rem',
                fontSize: '0.85rem',
                color: '#94a3b8',
              }}
            >
              <Sparkles size={16} color="#818cf8" style={{ animation: 'pulse 1.5s infinite' }} />
              <span>This page updates automatically in real-time when the interviewer submits the evaluation.</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
              <Link to={dashboardPath} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ArrowLeft size={16} />
                <span>Back to Past Interviews</span>
              </Link>
            </div>
          </div>
        </div>
      );
    }

    // 2. AI interview evaluation finalizing / ready to generate
    return (
      <div className="container" style={{ padding: '5rem 1.5rem', maxWidth: '640px' }}>
        <div
          className="card"
          style={{
            padding: '3rem 2.5rem',
            textAlign: 'center',
            background: '#111827',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem auto',
              border: '1px solid rgba(99, 102, 241, 0.4)',
            }}
          >
            <Sparkles size={32} color="#818cf8" style={{ animation: retryingAiEval ? 'spin 1.5s linear infinite' : 'pulse 1.5s infinite' }} />
          </div>

          <div className="badge badge-success" style={{ margin: '0 auto 1rem auto' }}>
            Interview Completed
          </div>

          <h2 style={{ fontSize: '1.6rem', marginBottom: '0.5rem', color: '#f9fafb' }}>
            AI Evaluation Report
          </h2>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.975rem', lineHeight: '1.6', marginBottom: '1.75rem' }}>
            Your interview has concluded. The AI evaluation is finalizing its evidence-based scoring and feedback.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
            <Link to={dashboardPath} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <ArrowLeft size={16} />
              <span>Back to Dashboard</span>
            </Link>
            <button
              onClick={handleRetryAiEval}
              disabled={retryingAiEval}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <RotateCcw size={16} className={retryingAiEval ? 'spin' : ''} />
              <span>{retryingAiEval ? 'Generating Evaluation...' : 'Load / Generate Evaluation'}</span>
            </button>
          </div>
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
            <Link to={dashboardPath} className="btn btn-outline">
              <ArrowLeft size={16} />
              <span>Back to Dashboard</span>
            </Link>
            <button onClick={loadReport} className="btn btn-primary">
              <RotateCcw size={16} />
              <span>Retry</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { interview, evaluation, questions = [], answers = [], submissions = [] } = report;
  const isPeer = interview?.is_ai === false;

  // Calculate overall score cleanly (scale out of 10)
  const rawScore = evaluation.overallScore ?? report.score ?? interview?.score;
  const overall = rawScore !== null && rawScore !== undefined 
    ? (rawScore > 10 ? (rawScore / 10).toFixed(1) : Number(rawScore).toFixed(1)) 
    : 'N/A';

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

  const verdictStyle = getVerdictStyle(evaluation.verdict || evaluation.recommendation);

  // Derive authentic problem resolution without fabricating Solved states
  const getProblemResolution = (q) => {
    const qSubs = (submissions || []).filter((s) => s.question_id === q.id || s.question_id === q.question_id);
    const ans = (answers || []).find((a) => a.question_id === q.id || a.question_id === q.question_id);
    const code = ans?.code_snapshot || (qSubs.length > 0 ? qSubs[qSubs.length - 1]?.code : null) || interview?.code || null;
    const lang = (qSubs.length > 0 ? qSubs[qSubs.length - 1]?.language : null) || ans?.language || q.language || 'Python';

    const passedSub = qSubs.find((s) => s.status === 'Accepted' || (s.total_tests > 0 && s.tests_passed === s.total_tests));

    if (passedSub) {
      return {
        status: 'Solved',
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.15)',
        code,
        language: lang,
        result: `All ${passedSub.total_tests} test cases passed`,
      };
    }

    if (qSubs.length > 0 || (code && code.trim().length > 25)) {
      const lastSub = qSubs[qSubs.length - 1];
      return {
        status: 'Attempted',
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.15)',
        code,
        language: lang,
        result: lastSub ? `${lastSub.tests_passed || 0}/${lastSub.total_tests || 0} tests passed` : 'Solution attempted',
      };
    }

    return {
      status: 'Result unavailable',
      color: '#94a3b8',
      bg: 'rgba(148, 163, 184, 0.15)',
      code: null,
      language: lang,
      result: 'No code submitted',
    };
  };

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem 5rem 1.5rem', maxWidth: '1080px' }}>
      {/* Top Header Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <Link to={dashboardPath} className="btn btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <ArrowLeft size={15} />
          <span>Back to Dashboard</span>
        </Link>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {isPeer && !isInterviewer && interview?.interviewer_id && (
            <button
              type="button"
              onClick={() => setShowReviewModal(true)}
              className="btn btn-outline btn-sm"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                borderColor: existingReview ? '#10b981' : '#f59e0b',
                color: existingReview ? '#34d399' : '#fbbf24',
              }}
            >
              <Star size={15} fill={existingReview ? '#34d399' : '#fbbf24'} />
              <span>{existingReview ? `Rated ${existingReview.rating}★` : 'Rate Interviewer'}</span>
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="btn btn-outline btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Printer size={15} />
            <span>Print Report</span>
          </button>
          {!isInterviewer && (
            <Link
              to="/interview/ai"
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <RotateCcw size={15} />
              <span>Practice AI</span>
            </Link>
          )}
        </div>
      </div>

      {/* PAST INTERVIEW HEADER CARD */}
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
              background: `conic-gradient(#6366f1 ${overall !== 'N/A' ? Number(overall) * 10 : 0}%, rgba(255,255,255,0.05) 0)`,
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
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  out of 10
                </span>
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
              {evaluation.verdict || evaluation.recommendation || 'Completed'}
            </div>
          </div>

          {/* Header Metadata */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <span className="badge badge-primary" style={{ fontSize: '0.8rem' }}>
                {interview?.interview_type || 'Technical'} {isPeer ? 'Peer Interview' : 'AI Interview'}
              </span>
              <span className="badge badge-secondary" style={{ fontSize: '0.8rem' }}>
                {interview?.difficulty || 'Medium'}
              </span>
              <span className="badge badge-success" style={{ fontSize: '0.8rem' }}>
                Past Interview
              </span>
            </div>

            <h1 style={{ fontSize: '1.85rem', marginBottom: '0.75rem', color: '#f9fafb' }}>
              Historical Interview Debrief
            </h1>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.25rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {isInterviewer ? 'Candidate' : 'Interviewer'}
                </div>
                <div style={{ fontWeight: 700, color: '#f9fafb', fontSize: '1rem' }}>
                  {isInterviewer ? (interview?.candidate_name || 'Candidate') : (interview?.interviewer_name || (isPeer ? 'Peer Interviewer' : 'MockMate AI'))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Date
                </div>
                <div style={{ fontWeight: 600, color: '#f9fafb', fontSize: '0.95rem' }}>
                  {new Date(interview?.completion_time || interview?.created_at || Date.now()).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Duration
                </div>
                <div style={{ fontWeight: 600, color: '#f9fafb', fontSize: '0.95rem' }}>
                  {interview?.duration || 45} minutes
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Overall Score
                </div>
                <div style={{ fontWeight: 800, color: '#818cf8', fontSize: '1rem' }}>
                  {overall} / 10
                </div>
              </div>
            </div>

            <p style={{ color: '#cbd5e1', fontSize: '0.925rem', lineHeight: '1.6', margin: 0 }}>
              {evaluation.summary || evaluation.interviewerFeedback || 'Comprehensive evaluation archived in Supabase for this completed interview.'}
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

      {/* Approach & Reasoning (if provided by peer interviewer) */}
      {evaluation.approachReasoning && (
        <div style={{
          background: '#111827',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.75rem',
          marginBottom: '2.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: '#818cf8' }}>
            <Cpu size={20} />
            <h3 style={{ fontSize: '1.15rem', margin: 0, color: '#f9fafb' }}>Approach & Algorithmic Reasoning</h3>
          </div>
          <p style={{ color: '#cbd5e1', fontSize: '0.925rem', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap' }}>
            {evaluation.approachReasoning}
          </p>
        </div>
      )}

      {/* Detailed Interviewer Feedback & Mentorship Advice */}
      {evaluation.interviewerFeedback && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(6, 182, 212, 0.04) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.75rem',
          marginBottom: '2.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: '#38bdf8' }}>
            <Sparkles size={20} />
            <h3 style={{ fontSize: '1.15rem', margin: 0, color: '#f9fafb' }}>Interviewer Evaluation & Feedback</h3>
          </div>
          <p style={{ color: '#e2e8f0', fontSize: '0.95rem', lineHeight: '1.7', margin: 0, whiteSpace: 'pre-wrap' }}>
            {evaluation.interviewerFeedback}
          </p>
        </div>
      )}

      {/* PROBLEMS SOLVED / ATTEMPTED */}
      {questions && questions.length > 0 && (
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', margin: 0, color: '#f9fafb', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Code2 size={20} color="#818cf8" />
              <span>Problems Solved & Attempted</span>
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {questions.length} {questions.length === 1 ? 'Problem' : 'Problems'} Evaluated
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {questions.map((q, idx) => {
              const res = getProblemResolution(q);
              const fb = (evaluation.questionFeedback || []).find((f) => f.questionOrder === (q.question_order || idx + 1));
              const title = q.title || q.question_text?.split('\n')[0] || `Problem ${idx + 1}`;

              return (
                <div
                  key={q.id || idx}
                  style={{
                    background: '#111827',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1.75rem',
                  }}
                >
                  {/* Problem Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, fontSize: '1.15rem', color: '#f9fafb' }}>
                          {idx + 1}. {title}
                        </span>
                        <span className="badge badge-secondary" style={{ textTransform: 'capitalize' }}>
                          {q.difficulty || 'Medium'}
                        </span>
                        {q.topic && (
                          <span className="badge badge-secondary">
                            {q.topic}
                          </span>
                        )}
                        <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 600 }}>
                          Language: {res.language}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                        {res.result}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span
                        style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '9999px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          background: res.bg,
                          color: res.color,
                          border: `1px solid ${res.color}40`,
                        }}
                      >
                        Status: {res.status}
                      </span>
                      {fb?.score != null && (
                        <span style={{
                          padding: '0.25rem 0.65rem',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(99, 102, 241, 0.15)',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                          color: '#a5b4fc',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                        }}>
                          Score: {fb.score} / 10
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Problem Description Excerpt */}
                  {q.description && (
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '1rem', lineHeight: 1.5, maxHeight: '80px', overflowY: 'auto' }}>
                      {q.description}
                    </div>
                  )}

                  {/* Candidate Code Submission */}
                  {res.code ? (
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                          Final Submitted Code:
                        </span>
                        <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                          {res.language}
                        </span>
                      </div>
                      <pre style={{
                        background: '#090d16',
                        padding: '1rem 1.25rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: '#e2e8f0',
                        fontSize: '0.825rem',
                        fontFamily: 'var(--font-mono)',
                        maxHeight: '260px',
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                      }}>
                        {res.code}
                      </pre>
                    </div>
                  ) : (
                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                      No code snapshot recorded for this problem.
                    </div>
                  )}

                  {/* Evaluator Feedback */}
                  {fb && (
                    <div style={{
                      background: 'rgba(99, 102, 241, 0.06)',
                      border: '1px solid rgba(99, 102, 241, 0.25)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '1rem',
                    }}>
                      <div style={{ fontSize: '0.825rem', fontWeight: 700, color: '#818cf8', marginBottom: '0.35rem' }}>
                        Evaluator Problem Feedback:
                      </div>
                      <p style={{ fontSize: '0.875rem', color: '#cbd5e1', lineHeight: '1.5', margin: '0 0 0.5rem 0' }}>
                        {fb.feedback}
                      </p>
                      {fb.optimalApproach && (
                        <div style={{ fontSize: '0.825rem', color: '#94a3b8', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.4rem' }}>
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

      {/* Peer Interviewer Review Modal */}
      {showReviewModal && interview && (
        <ReviewModal
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          interview={interview}
          candidateId={interview.candidate_id}
          onReviewSubmitted={() => {
            getReviewByInterviewId(interviewId).then(setExistingReview).catch(() => {});
          }}
        />
      )}
    </div>
  );
}
