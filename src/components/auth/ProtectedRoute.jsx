import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute({ children, allowedRole }) {
  const { user, profile, role, loading } = useAuth();
  const location = useLocation();

  if (loading || (user && !profile)) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '1rem',
        color: 'var(--text-secondary)'
      }}>
        <Loader2 size={36} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
        <p>Loading your session...</p>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!user) {
    // Redirect unauthenticated user to login with original intended destination
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const effectiveRole = profile?.role || role || 'candidate';

  // If a specific role is required and user has different role, redirect to their proper dashboard
  if (allowedRole && effectiveRole !== allowedRole) {
    const targetDashboard = effectiveRole === 'interviewer' ? '/interviewer/dashboard' : '/candidate/dashboard';
    return <Navigate to={targetDashboard} replace />;
  }

  return children;
}
