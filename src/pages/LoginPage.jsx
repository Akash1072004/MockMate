import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Bot, LogIn, Mail, Lock, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const { signIn, isConfigured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(location.state?.error || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please fill in both your email and password.');
      return;
    }

    setLoading(true);
    try {
      const authResult = await signIn({ email: email.trim(), password });
      
      // Determine destination route using authenticated user's profile/role stored in Supabase
      const resolvedRole = authResult?.profile?.role || authResult?.role || 'candidate';
      const targetDashboard = resolvedRole === 'interviewer' ? '/interviewer/dashboard' : '/candidate/dashboard';
      
      // Only redirect to original location if compatible with user's role
      const fromPath = location.state?.from?.pathname;
      let redirectPath = targetDashboard;
      if (fromPath) {
        if (resolvedRole === 'interviewer' && fromPath.startsWith('/candidate')) {
          redirectPath = targetDashboard;
        } else if (resolvedRole === 'candidate' && fromPath.startsWith('/interviewer')) {
          redirectPath = targetDashboard;
        } else {
          redirectPath = fromPath;
        }
      }
      
      navigate(redirectPath, { replace: true });
    } catch (err) {
      console.error('[LoginPage] Sign in failed:', err);
      let message = err.message || 'Failed to sign in. Please check your credentials.';
      if (err.message?.toLowerCase().includes('invalid login credentials')) {
        message = 'Invalid email or password. Please verify your credentials.';
      } else if (err.message?.toLowerCase().includes('email not confirmed')) {
        message = 'Your email address has not been confirmed yet. Please check your inbox.';
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: '4rem 1.5rem', maxWidth: '460px' }}>
      <div className="card" style={{ padding: '2.5rem 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="nav-brand-icon" style={{ width: 44, height: 44, margin: '0 auto 1rem auto' }}>
            <Bot size={24} />
          </div>
          <h1 style={{ fontSize: '1.85rem', marginBottom: '0.35rem' }}>Welcome Back</h1>
          <p style={{ fontSize: '0.9rem' }}>Sign in to continue your mock interview sessions</p>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <div style={{ position: 'relative' }}>
              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="developer@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" htmlFor="password">Password</label>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
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
              <span>Signing In...</span>
            ) : (
              <>
                <LogIn size={18} />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.9rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Don't have an account? </span>
          <Link to="/signup" style={{ fontWeight: 600 }}>Create an account</Link>
        </div>
      </div>
    </div>
  );
}
