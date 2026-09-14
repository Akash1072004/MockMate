import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { getInterviewById } from '../services/interviewService';
import { getInterviewQuestions } from '../services/questionService';
import { submitPeerEvaluation } from '../services/evaluationService';
import {
  Award,
  Star,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Send,
  User,
  Clock,
  Code2,
  FileText,
  ThumbsUp,
  Target,
  ShieldCheck,
  RotateCw,
  ExternalLink,
  Globe,
  Terminal,
  Cpu,
  BookOpen
} from 'lucide-react';

const RECOMMENDATION_OPTIONS = [
  { value: 'Strong Hire', label: 'Strong Hire — Exceeds technical and communication standards' },
  { value: 'Hire', label: 'Hire — Meets standard bar with solid problem solving & coding' },
  { value: 'Consider', label: 'Consider — Shows potential, minor gaps in edge cases or reasoning' },
  { value: 'No Hire', label: 'No Hire — Requires fundamental practice with algorithms and syntax' },
];

export default function EvaluationFormPage() {
  const { id: interviewId } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [interview, setInterview] = useState(null);
  const [candidateProfile, setCandidateProfile] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittedResult, setSubmittedResult] = useState(null);
  const [error, setError] = useState('');

  // 5 Core Category Scores (0.0 to 10.0 scale)
  const [problemSolving, setProblemSolving] = useState(8.0);
  const [codingAbility, setCodingAbility] = useState(8.0);
  const [communication, setCommunication] = useState(8.5);
  const [technicalKnowledge, setTechnicalKnowledge] = useState(8.0);
  const [approachReasoning, setApproachReasoning] = useState(8.0);

  // Overall Score (0.0 to 10.0) — auto-calculated from categories by default
  const [isManualOverall, setIsManualOverall] = useState(false);
  const [manualOverallScore, setManualOverallScore] = useState(8.1);

  // Qualitative Feedback
  const [strengthsText, setStrengthsText] = useState('');
  const [improvementsText, setImprovementsText] = useState('');
  const [interviewerFeedback, setInterviewerFeedback] = useState('');
  const [recommendation, setRecommendation] = useState('Hire');

  // Computed average of the 5 categories
  const calculatedAverage = useMemo(() => {
    const sum = Number(problemSolving) + Number(codingAbility) + Number(communication) + Number(technicalKnowledge) + Number(approachReasoning);
    return Math.round((sum / 5) * 10) / 10;
  }, [problemSolving, codingAbility, communication, technicalKnowledge, approachReasoning]);

  const effectiveOverallScore = isManualOverall ? manualOverallScore : calculatedAverage;

  useEffect(() => {
    async function loadData() {
      if (!interviewId || !user?.id) return;
      setLoading(true);
      setError('');
      try {
        // 1. Fetch interview with authenticated user verification
        const res = await getInterviewById(interviewId, user.id);
        if (!res.isAuthorized || !res.interview) {
          throw new Error(res.error || 'Unauthorized: Only the assigned interviewer can evaluate this candidate.');
        }

        const intData = res.interview;

        // Verify caller is the assigned interviewer
        if (intData.interviewer_id !== user.id) {
          throw new Error('Unauthorized: Only the assigned interviewer can evaluate this candidate.');
        }

        setInterview(intData);

        // 2. Fetch candidate's profile for comprehensive review
        if (intData.candidate_id && supabase) {
          const { data: cProf } = await supabase
            .from('profiles')
            .select(`
              id,
              full_name,
              username,
              avatar_url,
              headline,
              leetcode,
              codeforces,
              codechef,
              github,
              linkedin,
              portfolio,
              experience,
              skills
            `)
            .eq('id', intData.candidate_id)
            .maybeSingle();

          if (cProf) {
            setCandidateProfile(cProf);
          }
        }

        // 3. Fetch questions assigned to this interview
        const qList = await getInterviewQuestions(interviewId);
        setQuestions(qList || []);

        // 4. Fetch submissions made during this interview
        if (supabase) {
          const { data: subs } = await supabase
            .from('code_submissions')
            .select('*')
            .eq('interview_id', interviewId)
            .order('created_at', { ascending: false });

          if (subs) {
            setSubmissions(subs);
          }
        }

        // 5. Pre-fill existing evaluation if previously saved
        if (intData.evaluation) {
          const ev = intData.evaluation;
          if (ev.problemSolving != null) setProblemSolving(Number(ev.problemSolving));
          if (ev.codeQuality != null || ev.codingAbility != null) {
            setCodingAbility(Number(ev.codingAbility ?? ev.codeQuality));
          }
          if (ev.communication != null) setCommunication(Number(ev.communication));
          if (ev.technicalSkills != null || ev.technicalKnowledge != null) {
            setTechnicalKnowledge(Number(ev.technicalKnowledge ?? ev.technicalSkills));
          }
          if (typeof ev.approachReasoning === 'number') {
            setApproachReasoning(Number(ev.approachReasoning));
          } else if (ev.categoryScores?.complexityAnalysis) {
            setApproachReasoning(Number(ev.categoryScores.complexityAnalysis));
          }

          if (ev.overallScore != null || ev.overall_score != null) {
            const rawScore = Number(ev.overallScore ?? ev.overall_score);
            const scoreVal = rawScore > 10 ? Math.round((rawScore / 10) * 10) / 10 : rawScore;
            setManualOverallScore(scoreVal);
            setIsManualOverall(true);
          }

          if (ev.strengths) {
            setStrengthsText(Array.isArray(ev.strengths) ? ev.strengths.join('\n') : ev.strengths);
          }
          if (ev.improvements || ev.areas_to_improve) {
            const imps = ev.improvements || ev.areas_to_improve;
            setImprovementsText(Array.isArray(imps) ? imps.join('\n') : imps);
          }
          if (ev.interviewerFeedback || ev.feedback) {
            setInterviewerFeedback(ev.interviewerFeedback || ev.feedback);
          }
          if (ev.verdict || ev.recommendation) {
            setRecommendation(ev.verdict || ev.recommendation);
          }
        } else if (intData.score != null) {
          const s = Number(intData.score);
          setManualOverallScore(s > 10 ? Math.round((s / 10) * 10) / 10 : s);
          setIsManualOverall(true);
        }
      } catch (err) {
        console.error('[EvaluationFormPage] Load error:', err);
        setError(err.message || 'Failed to load interview session.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [interviewId, user?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!interviewId) return;

    if (!interviewerFeedback.trim()) {
      setError('Please provide detailed feedback for the candidate before submitting.');
      return;
    }

    const finalOverall = Math.min(10, Math.max(0, effectiveOverallScore));

    setSubmitting(true);
    setError('');

    try {
      const strengthsArray = strengthsText
        .split('\n')
        .map((s) => s.trim().replace(/^[-•*]\s*/, ''))
        .filter(Boolean);

      const improvementsArray = improvementsText
        .split('\n')
        .map((s) => s.trim().replace(/^[-•*]\s*/, ''))
        .filter(Boolean);

      await submitPeerEvaluation({
        interviewId,
        overallScore: finalOverall,
        technicalSkills: Number(technicalKnowledge),
        problemSolving: Number(problemSolving),
        codeQuality: Number(codingAbility),
        communication: Number(communication),
        approachReasoning: Number(approachReasoning),
        strengths: strengthsArray,
        improvements: improvementsArray,
        interviewerFeedback: interviewerFeedback.trim(),
        recommendation,
        evaluatorName: profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Interviewer',
      });

      // Show success modal/summary state
      setSubmittedResult({
        overallScore: finalOverall,
        recommendation,
        summary: interviewerFeedback.trim(),
      });
    } catch (err) {
      console.error('[EvaluationFormPage] Submit error:', err);
      setError(err.message || 'Failed to submit evaluation.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '6rem 1.5rem', textAlign: 'center' }}>
        <RotateCw size={36} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem auto', color: '#818cf8' }} />
        <h2>Loading Candidate Evaluation...</h2>
      </div>
    );
  }

  if (error && !interview) {
    return (
      <div className="container" style={{ padding: '5rem 1.5rem', maxWidth: '600px' }}>
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <AlertCircle size={40} color="#f87171" style={{ margin: '0 auto 1rem auto' }} />
          <h2>Cannot Access Evaluation</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.6' }}>{error}</p>
          <Link to="/interviewer/dashboard" className="btn btn-primary">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // If successfully submitted, show final score and summary
  if (submittedResult) {
    return (
      <div className="container" style={{ padding: '4rem 1.5rem', maxWidth: '680px' }}>
        <div className="card" style={{ padding: '3rem 2.5rem', textAlign: 'center' }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem auto',
            border: '2px solid #10b981',
          }}>
            <CheckCircle2 size={36} color="#10b981" />
          </div>

          <h2 style={{ fontSize: '1.8rem', color: '#f9fafb', marginBottom: '0.5rem' }}>
            Evaluation Submitted Successfully
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '2rem' }}>
            The candidate report has been saved and is immediately accessible to both you and the candidate.
          </p>

          <div style={{
            background: '#090d16',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '2rem',
            marginBottom: '2rem',
          }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              Final Overall Score
            </div>
            <div style={{ fontSize: '3rem', fontWeight: 800, color: submittedResult.overallScore >= 7 ? '#10b981' : '#f59e0b', lineHeight: 1 }}>
              {submittedResult.overallScore} <span style={{ fontSize: '1.5rem', color: 'var(--text-muted)' }}>/ 10</span>
            </div>
            <div style={{ marginTop: '1rem' }}>
              <span className="badge badge-primary" style={{ fontSize: '0.9rem', padding: '0.35rem 0.85rem' }}>
                Recommendation: {submittedResult.recommendation}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <Link to={`/interview/results/${interviewId}`} className="btn btn-primary">
              <FileText size={16} />
              <span>View Full Report</span>
            </Link>
            <Link to="/interviewer/dashboard" className="btn btn-outline">
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Derive interview summary stats
  const solvedCount = submissions.filter(
    (s) => s.status === 'Accepted' || (s.total_tests > 0 && s.tests_passed === s.total_tests)
  ).length;

  const languagesUsed = Array.from(
    new Set([
      ...submissions.map((s) => s.language).filter(Boolean),
      interview?.language || 'Python',
    ])
  );

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem 5rem 1.5rem', maxWidth: '1020px' }}>
      {/* Top Breadcrumb Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <Link
          to="/interviewer/dashboard"
          className="btn btn-outline btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <ArrowLeft size={16} />
          <span>Dashboard</span>
        </Link>

        <span className="badge badge-success">
          Post-Interview Evaluation
        </span>
      </div>

      {/* CANDIDATE PROFILE & INTERVIEW INFO CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Candidate Profile Card */}
        <div className="card" style={{ padding: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
            {candidateProfile?.avatar_url ? (
              <img
                src={candidateProfile.avatar_url}
                alt={candidateProfile.full_name}
                style={{ width: 54, height: 54, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-subtle)' }}
              />
            ) : (
              <div style={{
                width: 54,
                height: 54,
                borderRadius: '50%',
                background: 'rgba(99, 102, 241, 0.2)',
                color: '#818cf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '1.25rem',
              }}>
                {(interview?.candidate_name || 'C')[0]}
              </div>
            )}

            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#f9fafb' }}>
                {candidateProfile?.full_name || interview?.candidate_name || 'Candidate'}
              </h3>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                @{candidateProfile?.username || 'candidate'}
              </div>
              {candidateProfile?.headline && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  {candidateProfile.headline}
                </div>
              )}
            </div>
          </div>

          {/* Social Profiles & Competitive Programming Links */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
            {candidateProfile?.leetcode && (
              <a
                href={candidateProfile.leetcode.startsWith('http') ? candidateProfile.leetcode : `https://leetcode.com/${candidateProfile.leetcode}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline btn-sm"
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
              >
                <span>LeetCode</span>
                <ExternalLink size={11} />
              </a>
            )}
            {candidateProfile?.codeforces && (
              <a
                href={candidateProfile.codeforces.startsWith('http') ? candidateProfile.codeforces : `https://codeforces.com/profile/${candidateProfile.codeforces}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline btn-sm"
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
              >
                <span>Codeforces</span>
                <ExternalLink size={11} />
              </a>
            )}
            {candidateProfile?.codechef && (
              <a
                href={candidateProfile.codechef.startsWith('http') ? candidateProfile.codechef : `https://www.codechef.com/users/${candidateProfile.codechef}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline btn-sm"
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
              >
                <span>CodeChef</span>
                <ExternalLink size={11} />
              </a>
            )}
            {candidateProfile?.github && (
              <a
                href={candidateProfile.github.startsWith('http') ? candidateProfile.github : `https://github.com/${candidateProfile.github}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline btn-sm"
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
              >
                <span>GitHub</span>
                <ExternalLink size={11} />
              </a>
            )}
            {candidateProfile?.linkedin && (
              <a
                href={candidateProfile.linkedin.startsWith('http') ? candidateProfile.linkedin : `https://linkedin.com/in/${candidateProfile.linkedin}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline btn-sm"
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
              >
                <span>LinkedIn</span>
                <ExternalLink size={11} />
              </a>
            )}
          </div>
        </div>

        {/* Interview Information Card */}
        <div className="card" style={{ padding: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#818cf8' }}>
            <Clock size={18} />
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f9fafb' }}>Interview Session Info</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Date:</span>{' '}
              <strong style={{ color: '#f9fafb' }}>
                {interview?.start_time ? new Date(interview.start_time).toLocaleDateString() : 'Today'}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Duration:</span>{' '}
              <strong style={{ color: '#f9fafb' }}>{interview?.duration || 45} mins</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Questions Asked:</span>{' '}
              <strong style={{ color: '#818cf8' }}>{questions.length}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Questions Solved:</span>{' '}
              <strong style={{ color: '#10b981' }}>{solvedCount}</strong>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <span style={{ color: 'var(--text-muted)' }}>Languages Used:</span>{' '}
              <strong style={{ color: '#38bdf8' }}>{languagesUsed.join(', ')}</strong>
            </div>
          </div>

          {/* Submissions summary */}
          {submissions.length > 0 && (
            <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                Submissions ({submissions.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {submissions.slice(0, 4).map((sub) => (
                  <span
                    key={sub.id}
                    className="badge"
                    style={{
                      fontSize: '0.75rem',
                      background: sub.status === 'Accepted' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: sub.status === 'Accepted' ? '#34d399' : '#f87171',
                      border: `1px solid ${sub.status === 'Accepted' ? '#10b981' : '#ef4444'}`,
                    }}
                  >
                    {sub.language} &bull; {sub.status} {sub.total_tests ? `(${sub.tests_passed}/${sub.total_tests})` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* EVALUATION FORM */}
      <div className="card" style={{ padding: '2.5rem 2rem' }}>
        <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#818cf8',
            }}>
              <Award size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.8rem', margin: 0, color: '#f9fafb' }}>
                Evaluate Candidate Performance
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0.2rem 0 0 0' }}>
                Score the candidate across 5 core technical categories (0–10 scale) and deliver actionable post-interview feedback.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* 1. Category Scores (0 to 10 scale) */}
          <div style={{
            background: '#0e1422',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.75rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.15rem', color: '#f9fafb', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={20} color="#38bdf8" />
                <span>Technical & Behavioral Categories (0 – 10)</span>
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Auto-calculated average: <strong style={{ color: '#10b981' }}>{calculatedAverage} / 10</strong>
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
              {/* Category 1: Problem Solving */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>Problem Solving</label>
                  <strong style={{ color: '#38bdf8' }}>{problemSolving} / 10</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={problemSolving}
                  onChange={(e) => setProblemSolving(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#38bdf8' }}
                />
              </div>

              {/* Category 2: Coding Ability */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>Coding Ability</label>
                  <strong style={{ color: '#38bdf8' }}>{codingAbility} / 10</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={codingAbility}
                  onChange={(e) => setCodingAbility(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#38bdf8' }}
                />
              </div>

              {/* Category 3: Communication */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>Communication</label>
                  <strong style={{ color: '#38bdf8' }}>{communication} / 10</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={communication}
                  onChange={(e) => setCommunication(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#38bdf8' }}
                />
              </div>

              {/* Category 4: Technical Knowledge */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>Technical Knowledge</label>
                  <strong style={{ color: '#38bdf8' }}>{technicalKnowledge} / 10</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={technicalKnowledge}
                  onChange={(e) => setTechnicalKnowledge(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#38bdf8' }}
                />
              </div>

              {/* Category 5: Approach & Reasoning */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>Approach & Reasoning</label>
                  <strong style={{ color: '#38bdf8' }}>{approachReasoning} / 10</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={approachReasoning}
                  onChange={(e) => setApproachReasoning(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#38bdf8' }}
                />
              </div>
            </div>
          </div>

          {/* 2. Overall Score & Recommendation */}
          <div style={{
            background: '#0e1422',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.75rem',
          }}>
            <h3 style={{ fontSize: '1.15rem', color: '#f9fafb', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Award size={20} color="#818cf8" />
              <span>Overall Score & Final Recommendation</span>
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.75rem' }}>
              {/* Overall Score */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>
                    Overall Score (0–10):
                  </label>
                  <strong style={{ color: '#818cf8', fontSize: '1.3rem' }}>
                    {effectiveOverallScore} / 10
                  </strong>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.1"
                    value={effectiveOverallScore}
                    onChange={(e) => {
                      setIsManualOverall(true);
                      setManualOverallScore(Number(e.target.value));
                    }}
                    style={{ flex: 1, accentColor: '#6366f1' }}
                  />
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    className="form-input"
                    value={effectiveOverallScore}
                    onChange={(e) => {
                      setIsManualOverall(true);
                      setManualOverallScore(Math.min(10, Math.max(0, Number(e.target.value))));
                    }}
                    style={{ width: '75px', textAlign: 'center' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsManualOverall(false);
                      setManualOverallScore(calculatedAverage);
                    }}
                    className={`btn btn-sm ${!isManualOverall ? 'btn-secondary' : 'btn-outline'}`}
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                  >
                    Sync with Category Average ({calculatedAverage})
                  </button>
                  {isManualOverall && (
                    <span style={{ fontSize: '0.75rem', color: '#f59e0b', alignSelf: 'center' }}>
                      Manual Override
                    </span>
                  )}
                </div>
              </div>

              {/* Recommendation */}
              <div>
                <label className="form-label" htmlFor="recommendation">
                  Hiring Recommendation *
                </label>
                <select
                  id="recommendation"
                  className="form-select"
                  value={recommendation}
                  onChange={(e) => setRecommendation(e.target.value)}
                  style={{ width: '100%' }}
                >
                  {RECOMMENDATION_OPTIONS.map((rec) => (
                    <option key={rec.value} value={rec.value}>
                      {rec.label}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Decision will be reflected in the candidate's verified interview report.
                </div>
              </div>
            </div>
          </div>

          {/* 3. Qualitative Assessment Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#34d399' }}>
                  <ThumbsUp size={16} />
                  <span>Strengths (one per line)</span>
                </label>
                <textarea
                  className="form-input"
                  rows={4}
                  placeholder="• Clear algorithmic thought process&#10;• Proactively handled boundary cases&#10;• Clean modular code organization"
                  value={strengthsText}
                  onChange={(e) => setStrengthsText(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#fbbf24' }}>
                  <Target size={16} />
                  <span>Areas to Improve (one per line)</span>
                </label>
                <textarea
                  className="form-input"
                  rows={4}
                  placeholder="• Discuss time/space complexities earlier&#10;• Practice sliding window edge cases&#10;• Articulate trade-offs between approaches"
                  value={improvementsText}
                  onChange={(e) => setImprovementsText(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                Detailed Feedback & Actionable Guidance *
              </label>
              <textarea
                className="form-input"
                rows={6}
                placeholder="Provide constructive, comprehensive feedback detailing problem decomposition, debugging agility, and specific areas for preparation before real company loops..."
                value={interviewerFeedback}
                onChange={(e) => setInterviewerFeedback(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Candidate Final Code Snapshot (if available) */}
          {interview?.code && (
            <div style={{
              background: '#090d16',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
                <Code2 size={16} />
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Candidate Final Code Snapshot</span>
              </div>
              <pre style={{
                margin: 0,
                padding: '0.75rem 1rem',
                background: '#060911',
                borderRadius: 'var(--radius-sm)',
                color: '#e2e8f0',
                fontSize: '0.8rem',
                fontFamily: 'var(--font-mono)',
                maxHeight: '180px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
              }}>
                {interview.code}
              </pre>
            </div>
          )}

          {/* Submit Actions */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '1.5rem',
            flexWrap: 'wrap',
            gap: '1rem',
          }}>
            <Link to="/interviewer/dashboard" className="btn btn-outline">
              Cancel
            </Link>

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
              style={{
                padding: '0.65rem 1.75rem',
                fontSize: '0.95rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <Send size={16} />
              <span>{submitting ? 'Submitting Evaluation...' : 'Submit Evaluation'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
