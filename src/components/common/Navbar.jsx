import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Bot, LogOut, User, LayoutDashboard, Trophy, Award } from 'lucide-react';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, role, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (err) {
      console.error('[Navbar] Sign out error:', err);
    }
  };

  const dashboardPath = role === 'interviewer' ? '/interviewer/dashboard' : '/candidate/dashboard';
  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="nav-brand">
          <div className="nav-brand-icon">
            <Bot size={20} />
          </div>
          <span>Mock<span className="text-gradient">Mate</span></span>
        </Link>

        {user ? (
          // Authenticated Navigation
          <>
            <nav className="nav-links">
              <Link 
                to={dashboardPath} 
                className={`nav-link ${location.pathname.includes('/dashboard') ? 'active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <LayoutDashboard size={16} />
                <span>Dashboard</span>
              </Link>
              <Link 
                to="/leaderboard" 
                className={`nav-link ${location.pathname === '/leaderboard' ? 'active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Trophy size={16} />
                <span>Leaderboard</span>
              </Link>
              <Link 
                to="/profile" 
                className={`nav-link ${location.pathname === '/profile' ? 'active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <User size={16} />
                <span>Profile</span>
              </Link>
            </nav>

            <div className="nav-actions">
              <span className={`badge ${role === 'interviewer' ? 'badge-success' : 'badge-primary'}`}>
                {role === 'interviewer' ? 'Interviewer' : 'Candidate'}
              </span>

              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayName}
              </span>

              <button 
                onClick={handleSignOut} 
                className="btn btn-outline btn-sm"
                title="Sign out of MockMate"
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          </>
        ) : (
          // Unauthenticated Navigation
          <>
            <nav className="nav-links">
              <Link 
                to="/#features" 
                className="nav-link"
              >
                Features
              </Link>
              <Link 
                to="/#ai-interview" 
                className="nav-link"
              >
                AI Practice
              </Link>
              <Link 
                to="/#live-interview" 
                className="nav-link"
              >
                Peer Interview
              </Link>
              <Link 
                to="/leaderboard" 
                className={`nav-link ${location.pathname === '/leaderboard' ? 'active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Trophy size={16} />
                <span>Leaderboard</span>
              </Link>
            </nav>

            <div className="nav-actions">
              <Link to="/login" className="btn btn-outline btn-sm">
                Sign In
              </Link>
              <Link to="/signup" className="btn btn-primary btn-sm">
                Get Started
              </Link>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
