import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Bot, UserPlus, UserCheck, Shield, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

export default function SignupPage() {
  const { signUp, isConfigured } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [role, setRole] = useState(searchParams.get('role') === 'interviewer' ? 'interviewer' : 'candidate');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [github, setGithub] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [error, setError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const paramRole = searchParams.get('role');
    if (paramRole === 'interviewer' || paramRole === 'candidate') {
      setRole(paramRole);
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessNotice('');

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (!email.trim()) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const data = await signUp({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        role,
        github: github.trim(),
        linkedin: linkedin.trim(),
      });

      // If user session is immediate (email confirmation disabled in Supabase)
      if (data?.session) {
        const dest = role === 'interviewer' ? '/interviewer/dashboard' : '/candidate/dashboard';
        navigate(dest, { replace: true });
      } else {
        // Email confirmation is required by project
        setSuccessNotice('Account created successfully! Please check your email inbox to verify your account before logging in.');
      }
    } catch (err) {
      console.error('[SignupPage] Sign up error:', err);
      let msg = err.message || 'Failed to create account. Please try again.';
      if (err.message?.toLowerCase().includes('already registered')) {
        msg = 'An account with this email address already exists. Please sign in instead.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: '3.5rem 1.5rem', maxWidth: '540px' }}>
      <div className="card" style={{ padding: '2.5rem 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="nav-brand-icon" style={{ width: 44, height: 44, margin: '0 auto 1rem auto' }}>
            <Bot size={24} />
          </div>
          <h1 style={{ fontSize: '1.85rem', marginBottom: '0.35rem' }}>Join MockMate</h1>
          <p style={{ fontSize: '0.9rem' }}>Create your account to start practice or conducting interviews</p>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        {successNotice && (
          <div className="alert alert-info" style={{ marginBottom: '1.25rem' }}>
            <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#10b981' }} />
            <span>{successNotice}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Role Selection Toggle */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="form-label" style={{ display: 'block', marginBottom: '0.6rem' }}>
              Select Your Primary Role
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div
                onClick={() => setRole('candidate')}
                style={{
                  border: `2px solid ${role === 'candidate' ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                  background: role === 'candidate' ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-input)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem 0.75rem',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ fontWeight: 700, color: role === 'candidate' ? '#a5b4fc' : 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  Candidate
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Practice with AI & Live Peers
                </div>
              </div>

              <div
                onClick={() => setRole('interviewer')}
                style={{
                  border: `2px solid ${role === 'interviewer' ? 'var(--accent-secondary)' : 'var(--border-subtle)'}`,
                  background: role === 'interviewer' ? 'rgba(6, 182, 212, 0.12)' : 'var(--bg-input)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem 0.75rem',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ fontWeight: 700, color: role === 'interviewer' ? '#67e8f9' : 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  Interviewer
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Conduct Mocks & Evaluate
                </div>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="fullName">Full Name</label>
            <input
              id="fullName"
              type="text"
              className="form-input"
              placeholder="Alex Johnson"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="alex@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="Min 6 chars"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirmPassword">Confirm</label>
              <input
                id="confirmPassword"
                type="password"
                className="form-input"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="github">GitHub Profile (Optional)</label>
              <input
                id="github"
                type="text"
                className="form-input"
                placeholder="github.com/username"
                value={github}
                onChange={(e) => setGithub(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="linkedin">LinkedIn (Optional)</label>
              <input
                id="linkedin"
                type="text"
                className="form-input"
                placeholder="linkedin.com/in/username"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1rem' }}
            disabled={loading}
          >
            {loading ? (
              <span>Creating Account...</span>
            ) : (
              <>
                <UserPlus size={18} />
                <span>Create {role === 'interviewer' ? 'Interviewer' : 'Candidate'} Account</span>
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.9rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Already have an account? </span>
          <Link to="/login" style={{ fontWeight: 600 }}>Sign in</Link>
        </div>
      </div>
    </div>
  );
}
