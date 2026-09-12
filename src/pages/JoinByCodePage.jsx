import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getInterviewByJoinCode } from '../services/interviewService';
import { Hash, ArrowRight, AlertCircle, ArrowLeft, Video, ShieldCheck } from 'lucide-react';

export default function JoinByCodePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmed = joinCode.trim().toUpperCase();
    if (!trimmed) {
      setError('Please enter your interview join code.');
      return;
    }

    setLoading(true);
    try {
      const { interview } = await getInterviewByJoinCode(trimmed, user.id);
      navigate(`/interview/${interview.id}`);
    } catch (err) {
      console.error('[JoinByCodePage] Join error:', err);
      setError(err.message || 'Failed to join interview session. Please check your join code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: '5rem 1.5rem', maxWidth: '480px' }}>
      <div className="card" style={{ padding: '2.5rem 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="nav-brand-icon" style={{ width: 44, height: 44, margin: '0 auto 1rem auto' }}>
            <Hash size={24} />
          </div>
          <h1 style={{ fontSize: '1.8rem', marginBottom: '0.35rem' }}>Join Live Interview</h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Enter the unique 8-character code generated for your accepted session.
          </p>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="joinCode">Interview Join Code</label>
            <input
              id="joinCode"
              type="text"
              className="form-input"
              placeholder="e.g. MM-7X8Y9Z"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', letterSpacing: '0.1em', textAlign: 'center' }}
              maxLength={12}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1rem' }}
            disabled={loading}
          >
            <Video size={18} />
            <span>{loading ? 'Validating Session...' : 'Enter Interview Room'}</span>
          </button>
        </form>

        <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
            <ShieldCheck size={16} color="#10b981" />
            <span>Secure Database Authorization Verified</span>
          </div>
          <Link to="/dashboard" style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <ArrowLeft size={14} />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
