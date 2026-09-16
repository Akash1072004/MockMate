import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  User, 
  LogOut, 
  LayoutDashboard, 
  ChevronDown, 
  Sparkles, 
  Trophy, 
  Edit3,
  ShieldCheck,
  Code2
} from 'lucide-react';

export default function ProfileDropdown() {
  const { user, profile, role, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      setIsOpen(false);
      await signOut();
      navigate('/login');
    } catch (err) {
      console.error('[ProfileDropdown] Sign out error:', err);
    }
  };

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const email = user?.email || '';
  const initial = displayName.charAt(0).toUpperCase();
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url;
  const dashboardPath = role === 'interviewer' ? '/interviewer/dashboard' : '/candidate/dashboard';
  const publicUsername = profile?.username;

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          background: isOpen ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-full)',
          padding: '0.3rem 0.75rem 0.3rem 0.35rem',
          cursor: 'pointer',
          transition: 'all var(--transition-fast)',
          outline: 'none',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '1px solid rgba(255, 255, 255, 0.15)',
            }}
          />
        ) : (
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent-primary) 0%, #4338ca 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.8rem',
              fontWeight: 700,
            }}
          >
            {initial}
          </div>
        )}

        <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <span style={{ 
            fontSize: '0.825rem', 
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
            fontSize: '0.68rem', 
            color: role === 'interviewer' ? '#34d399' : '#a5b4fc', 
            textTransform: 'capitalize',
            fontWeight: 500 
          }}>
            {role}
          </span>
        </div>

        <ChevronDown 
          size={13} 
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
            background: '#0d1322',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            backdropFilter: 'blur(16px)',
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          {/* Header Info */}
          <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.02)' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f8fafc' }}>
              {displayName}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {email}
            </div>
            <div style={{ marginTop: '0.4rem' }}>
              <span className={`badge ${role === 'interviewer' ? 'badge-success' : 'badge-primary'}`} style={{ fontSize: '0.7rem' }}>
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
                padding: '0.55rem 1rem',
                color: 'var(--text-secondary)',
                fontSize: '0.84rem',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <LayoutDashboard size={14} style={{ color: '#818cf8' }} />
              <span>Dashboard</span>
            </Link>

            <Link
              to="/profile"
              onClick={() => setIsOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.55rem 1rem',
                color: 'var(--text-secondary)',
                fontSize: '0.84rem',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <User size={14} style={{ color: '#38bdf8' }} />
              <span>View Profile</span>
            </Link>

            <Link
              to="/profile?edit=true"
              onClick={() => setIsOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.55rem 1rem',
                color: 'var(--text-secondary)',
                fontSize: '0.84rem',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <Edit3 size={14} style={{ color: '#818cf8' }} />
              <span>Edit Profile</span>
            </Link>

            {publicUsername && (
              <Link
                to={`/candidates/${publicUsername}`}
                onClick={() => setIsOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.55rem 1rem',
                  color: 'var(--text-secondary)',
                  fontSize: '0.84rem',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                <User size={14} style={{ color: '#a855f7' }} />
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
                padding: '0.55rem 1rem',
                color: 'var(--text-secondary)',
                fontSize: '0.84rem',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <Trophy size={14} style={{ color: '#fbbf24' }} />
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
                  padding: '0.55rem 1rem',
                  color: 'var(--text-secondary)',
                  fontSize: '0.84rem',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                <Sparkles size={14} style={{ color: '#f43f5e' }} />
                <span>AI Mock Interview</span>
              </Link>
            )}
          </div>

          {/* Sign Out Footer */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '0.35rem 0' }}>
            <button
              type="button"
              onClick={handleSignOut}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                width: '100%',
                padding: '0.55rem 1rem',
                color: '#f87171',
                fontSize: '0.84rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
