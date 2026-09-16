import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { 
  User, 
  Briefcase, 
  Globe, 
  Code2, 
  Award, 
  BarChart2, 
  Calendar, 
  Copy, 
  Check, 
  ExternalLink,
  ArrowLeft
} from 'lucide-react';

export default function PublicProfilePage() {
  const { username } = useParams();
  const { user: currentUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({
    completedInterviews: 0,
    averageScore: null,
    bestScore: null,
    recentInterviews: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadPublicProfile() {
      if (!isSupabaseConfigured || !supabase || !username) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        // Query by username or fallback to ID
        let query = supabase
          .from('profiles')
          .select('id, full_name, role, headline, bio, experience, skills, github, linkedin, portfolio, leetcode, codeforces, codechef, username, avatar_url, created_at');

        // Check if username is a UUID
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(username);
        if (isUuid) {
          query = query.eq('id', username);
        } else {
          query = query.eq('username', username);
        }

        const { data: userProfile, error: profileErr } = await query.maybeSingle();

        if (profileErr) throw profileErr;
        if (!userProfile) {
          setError('User profile not found.');
          setLoading(false);
          return;
        }

        setProfile(userProfile);

        // Load public interview statistics (aggregates only, no private notes)
        const { data: interviews } = await supabase
          .from('interviews')
          .select('id, interview_type, difficulty, status, score, completion_time, created_at')
          .eq('candidate_id', userProfile.id)
          .eq('status', 'completed')
          .order('completion_time', { ascending: false });

        if (interviews && interviews.length > 0) {
          const scored = interviews.filter((i) => i.score != null);
          const totalScore = scored.reduce((acc, curr) => acc + Number(curr.score), 0);
          const avg = scored.length > 0 ? (totalScore / scored.length).toFixed(1) : null;
          const best = scored.length > 0 ? Math.max(...scored.map((i) => Number(i.score))).toFixed(1) : null;

          setStats({
            completedInterviews: interviews.length,
            averageScore: avg,
            bestScore: best,
            recentInterviews: interviews.slice(0, 5),
          });
        }
      } catch (err) {
        console.error('[PublicProfilePage] Error loading profile:', err);
        setError('Failed to load profile data.');
      } finally {
        setLoading(false);
      }
    }

    loadPublicProfile();

    let channel = null;
    if (supabase) {
      channel = supabase
        .channel(`public_profile_${username}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
          },
          (payload) => {
            if (payload?.new) {
              setProfile((prev) => {
                if (!prev) return prev;
                if (prev.id === payload.new.id || prev.username === payload.new.username) {
                  return { ...prev, ...payload.new };
                }
                return prev;
              });
            }
          }
        )
        .subscribe();
    }

    return () => {
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [username]);

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '5rem 1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Loading public profile...
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="container" style={{ padding: '5rem 1.5rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>Profile Not Found</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          {error || "The requested user profile does not exist or has not been made public."}
        </p>
        <Link to="/" className="btn btn-primary btn-sm">
          Return Home
        </Link>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === profile.id;

  return (
    <div className="container" style={{ padding: '3.5rem 1.5rem', maxWidth: '900px' }}>
      {/* Top action bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <Link to={profile.role === 'interviewer' ? '/interviewer/dashboard' : '/candidate/dashboard'} className="btn btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <ArrowLeft size={16} />
          <span>Dashboard</span>
        </Link>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {isOwnProfile && (
            <Link to="/profile" className="btn btn-secondary btn-sm">
              Edit Profile
            </Link>
          )}
          <button onClick={handleCopyLink} className="btn btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            {copied ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
            <span>{copied ? 'Link Copied!' : 'Copy Profile Link'}</span>
          </button>
        </div>
      </div>

      {/* Main Profile Header Card */}
      <div className="card" style={{ padding: '2.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.full_name || 'User'}
              style={{
                width: '84px',
                height: '84px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '3px solid rgba(99, 102, 241, 0.4)',
                boxShadow: '0 0 20px rgba(99, 102, 241, 0.25)',
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: '84px',
                height: '84px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                fontWeight: 700,
                color: '#ffffff',
                flexShrink: 0,
              }}
            >
              {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : <User size={40} />}
            </div>
          )}

          <div style={{ flex: 1, minWidth: '260px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
              <h1 style={{ fontSize: '2rem', margin: 0 }}>{profile.full_name || 'Anonymous User'}</h1>
              <span className={`badge ${profile.role === 'interviewer' ? 'badge-primary' : 'badge-secondary'}`}>
                {profile.role === 'interviewer' ? 'Verified Interviewer' : 'Candidate'}
              </span>
            </div>

            {profile.headline && (
              <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0', fontWeight: 500 }}>
                {profile.headline}
              </p>
            )}

            {profile.bio && (
              <p style={{ fontSize: '0.95rem', color: '#cbd5e1', lineHeight: '1.6', margin: '0 0 1.25rem 0' }}>
                {profile.bio}
              </p>
            )}

            {/* Skills */}
            {profile.skills && profile.skills.length > 0 && (
              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                {profile.skills.map((skill, idx) => (
                  <span key={idx} className="badge badge-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}>
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Professional Coding & Social Links */}
        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {profile.leetcode && (
            <a
              href={profile.leetcode.startsWith('http') ? profile.leetcode : `https://leetcode.com/${profile.leetcode}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', borderColor: 'rgba(245, 158, 11, 0.4)' }}
            >
              <Code2 size={15} color="#f59e0b" />
              <span>LeetCode</span>
              <ExternalLink size={12} />
            </a>
          )}

          {profile.codeforces && (
            <a
              href={profile.codeforces.startsWith('http') ? profile.codeforces : `https://codeforces.com/profile/${profile.codeforces}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', borderColor: 'rgba(59, 130, 246, 0.4)' }}
            >
              <Code2 size={15} color="#3b82f6" />
              <span>Codeforces</span>
              <ExternalLink size={12} />
            </a>
          )}

          {profile.codechef && (
            <a
              href={profile.codechef.startsWith('http') ? profile.codechef : `https://www.codechef.com/users/${profile.codechef}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', borderColor: 'rgba(168, 85, 247, 0.4)' }}
            >
              <Code2 size={15} color="#a855f7" />
              <span>CodeChef</span>
              <ExternalLink size={12} />
            </a>
          )}

          {profile.github && (
            <a
              href={profile.github.startsWith('http') ? profile.github : `https://${profile.github}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Code2 size={15} />
              <span>GitHub</span>
              <ExternalLink size={12} />
            </a>
          )}

          {profile.linkedin && (
            <a
              href={profile.linkedin.startsWith('http') ? profile.linkedin : `https://${profile.linkedin}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Globe size={15} color="#0a66c2" />
              <span>LinkedIn</span>
              <ExternalLink size={12} />
            </a>
          )}

          {profile.portfolio && (
            <a
              href={profile.portfolio.startsWith('http') ? profile.portfolio : `https://${profile.portfolio}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Globe size={15} />
              <span>Portfolio</span>
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>

      {/* Public Interview Performance Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Interviews Completed</span>
            <Award size={18} color="#6366f1" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{stats.completedInterviews}</div>
        </div>

        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Average Score</span>
            <BarChart2 size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>
            {stats.averageScore ? `${stats.averageScore} / 10` : 'N/A'}
          </div>
        </div>

        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Best Score</span>
            <Award size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>
            {stats.bestScore ? `${stats.bestScore} / 10` : 'N/A'}
          </div>
        </div>
      </div>

      {/* Recent Public Performance History */}
      {stats.recentInterviews.length > 0 && (
        <div className="card" style={{ padding: '2rem' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={18} color="#818cf8" />
            <span>Verified Interview Track Record</span>
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Publicly visible aggregate milestones. Individual private feedback and evaluation notes remain confidential.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {stats.recentInterviews.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.85rem 1rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                    {item.interview_type || 'Technical'} Mock Interview
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Difficulty: {item.difficulty || 'Medium'} • {item.completion_time ? new Date(item.completion_time).toLocaleDateString() : 'Recent'}
                  </div>
                </div>

                {item.score != null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="badge badge-success" style={{ fontSize: '0.85rem', padding: '0.2rem 0.6rem' }}>
                      Score: {item.score} / 10
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
