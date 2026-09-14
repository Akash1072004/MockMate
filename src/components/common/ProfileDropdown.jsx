import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  User, 
  LayoutDashboard, 
  LogOut, 
  ChevronDown, 
  Trophy, 
  Sparkles, 
  FileText, 
  ExternalLink,
  Edit3,
  Shield,
  Layers,
  History
} from 'lucide-react';

export default function ProfileDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { user, profile, role, signOut } = useAuth();
  const navigate = useNavigate();

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSignOut = async () => {
    setIsOpen(false);
    try {
      await signOut();
      navigate('/login');
    } catch (err) {
      console.error('[ProfileDropdown] Sign out error:', err);
    }
  };

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const email = profile?.email || user?.email || '';
  const initial = displayName.charAt(0).toUpperCase();
  const dashboardPath = role === 'interviewer' ? '/interviewer/dashboard' : '/candidate/dashboard';
  const publicUsername = profile?.username || user?.id;

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Avatar Button Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          background: isOpen ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.05)',
          border: isOpen ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
          borderRadius: '9999px',
          padding: '0.35rem 0.75rem 0.35rem 0.4rem',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          outline: 'none',
        }}
        className="profile-dropdown-trigger"
      >
        {/* Avatar or Initials */}
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={displayName}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: role === 'interviewer' 
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.875rem',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            }}
          >
            {initial}
          </div>
        )}

        <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <span style={{ 
            fontSize: '0.85rem', 
            fontWeight: 600, 
            color: 'var(--text-primary)', 
            maxWidth: '120px', 
            overflow: 'hidden', 
            textOverflow: 'ellipsis', 
            whiteSpace: 'nowrap' 
          }}>
            {displayName}
          </span>
          <span style={{ 
            fontSize: '0.7rem', 
            color: role === 'interviewer' ? '#34d399' : '#818cf8', 
            textTransform: 'capitalize',
            fontWeight: 500 
          }}>
            {role}
          </span>
        </div>

        <ChevronDown 
          size={14} 
          style={{ 
            color: 'var(--text-muted)', 
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
          }} 
        />
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '240px',
            background: '#0f172a',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(16px)',
            zIndex: 1000,
            overflow: 'hidden',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          {/* Header Info */}
          <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(255, 255, 255, 0.02)' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f8fafc' }}>
              {displayName}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {email}
            </div>
            <div style={{ marginTop: '0.4rem' }}>
              <span className={`badge ${role === 'interviewer' ? 'badge-success' : 'badge-primary'}`} style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}>
                {role === 'interviewer' ? 'Verified Interviewer' : 'Candidate'}
              </span>
            </div>
          </div>

          {/* Nav List */}
          <div style={{ padding: '0.4rem 0' }}>
            <Link
              to={dashboardPath}
              onClick={() => setIsOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.6rem 1rem',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <LayoutDashboard size={15} style={{ color: '#818cf8' }} />
              <span>Dashboard</span>
            </Link>

            <Link
              to="/profile"
              onClick={() => setIsOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.6rem 1rem',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <Edit3 size={15} style={{ color: '#38bdf8' }} />
              <span>Edit Profile & Resume</span>
            </Link>

            {publicUsername && (
              <Link
                to={`/candidates/${publicUsername}`}
                onClick={() => setIsOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.6rem 1rem',
                  color: 'var(--text-secondary)',
                  fontSize: '0.85rem',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                <User size={15} style={{ color: '#a855f7' }} />
                <span>View Public Profile</span>
              </Link>
            )}

            <Link
              to="/leaderboard"
              onClick={() => setIsOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.6rem 1rem',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <Trophy size={15} style={{ color: '#fbbf24' }} />
              <span>Leaderboard</span>
            </Link>

            {role === 'candidate' && (
              <Link
                to="/interview/ai"
                onClick={() => setIsOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.6rem 1rem',
                  color: 'var(--text-secondary)',
                  fontSize: '0.85rem',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                <Sparkles size={15} style={{ color: '#f43f5e' }} />
                <span>AI Mock Interview</span>
              </Link>
            )}
          </div>

          {/* Sign Out Footer */}
          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', padding: '0.4rem 0' }}>
            <button
              type="button"
              onClick={handleSignOut}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                width: '100%',
                padding: '0.6rem 1rem',
                color: '#f87171',
                fontSize: '0.85rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <LogOut size={15} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
