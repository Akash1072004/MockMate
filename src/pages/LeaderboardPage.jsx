import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getLeaderboard } from '../services/leaderboardService';
import { 
  Trophy, 
  Medal, 
  Award, 
  Star, 
  RotateCw, 
  Search, 
  ExternalLink, 
  ArrowRight, 
  User, 
  Sparkles,
  Bot,
  Users
} from 'lucide-react';

export default function LeaderboardPage() {
  const { user, profile } = useAuth();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { data } = await getLeaderboard();
      setCandidates(data || []);
    } catch (err) {
      console.error('[LeaderboardPage] Error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter candidates by search term
  const filteredCandidates = candidates.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const nameMatch = c.candidate_name?.toLowerCase().includes(q);
    const skillsMatch = Array.isArray(c.skills) && c.skills.some((s) => s.toLowerCase().includes(q));
    return nameMatch || skillsMatch;
  });

  // Current user's ranking if in list
  const userRankEntry = user ? candidates.find((c) => c.candidate_id === user.id) : null;

  const getRankBadge = (rank) => {
    switch (rank) {
      case 1:
        return (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)',
            color: '#111827',
            fontWeight: 800,
            fontSize: '0.95rem',
            boxShadow: '0 0 12px rgba(251, 191, 36, 0.4)',
          }}>
            1
          </div>
        );
      case 2:
        return (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #e2e8f0 0%, #94a3b8 100%)',
            color: '#111827',
            fontWeight: 800,
            fontSize: '0.95rem',
            boxShadow: '0 0 10px rgba(226, 232, 240, 0.3)',
          }}>
            2
          </div>
        );
      case 3:
        return (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: '0.95rem',
            boxShadow: '0 0 10px rgba(249, 115, 22, 0.3)',
          }}>
            3
          </div>
        );
      default:
        return (
          <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-muted)', width: 34, textAlign: 'center' }}>
            #{rank}
          </span>
        );
    }
  };

  return (
    <div className="container" style={{ padding: '3.5rem 1.5rem 5rem 1.5rem', maxWidth: '1000px' }}>
      {/* Header Banner */}
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.35rem 0.9rem',
          borderRadius: 9999,
          background: 'rgba(245, 158, 11, 0.12)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          color: '#fbbf24',
          fontSize: '0.8rem',
          fontWeight: 600,
          marginBottom: '1rem',
        }}>
          <Trophy size={14} />
          <span>Global Benchmarks</span>
        </div>

        <h1 style={{ fontSize: '2.4rem', marginBottom: '0.75rem', fontWeight: 800 }}>
          Candidate <span className="text-gradient">Leaderboard</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: '600px', margin: '0 auto', lineHeight: '1.6' }}>
          Real-time performance rankings based on verified completed mock interviews and AI evaluation scores.
        </p>
      </div>

      {/* Logged-in Candidate Highlight Banner */}
      {userRankEntry && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(6, 182, 212, 0.1) 100%)',
          border: '1px solid #6366f1',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem 1.75rem',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: '0 4px 20px rgba(99, 102, 241, 0.15)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {getRankBadge(userRankEntry.rank)}
            <div>
              <div style={{ fontSize: '0.75rem', color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                Your Current Standing
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f9fafb' }}>
                {userRankEntry.candidate_name} (Rank #{userRankEntry.rank})
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Interviews</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f9fafb' }}>
                {userRankEntry.interview_count}
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Average Score</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>
                {userRankEntry.average_score} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/ 10</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Control Bar: Search & Refresh */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidate name or skill..."
            style={{ paddingLeft: '2.5rem', fontSize: '0.875rem' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => loadData(true)}
            disabled={refreshing || loading}
            className="btn btn-outline btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RotateCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Leaderboard Table / Cards */}
      {loading ? (
        <div className="card" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
          <RotateCw size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem auto', color: 'var(--accent-primary)' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Loading leaderboard rankings...</p>
        </div>
      ) : candidates.length === 0 ? (
        /* Empty State: Database has no completed interviews yet */
        <div className="card" style={{
          padding: '4rem 2rem',
          textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.8) 0%, rgba(9, 13, 22, 0.9) 100%)',
          border: '1px solid var(--border-subtle)',
        }}>
          <div style={{
            width: 68,
            height: 68,
            borderRadius: '50%',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem auto',
          }}>
            <Trophy size={34} color="#f59e0b" />
          </div>

          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#f9fafb' }}>
            The Leaderboard Is Warming Up
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '480px', margin: '0 auto 2rem auto', lineHeight: '1.6' }}>
            No mock interviews have been completed yet. Be the first candidate to complete an AI simulation or peer interview to claim the #1 spot!
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <Link to="/interview/ai" className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Bot size={15} />
              <span>Start AI Practice</span>
            </Link>
            <Link to="/candidate/find-interviewer" className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Users size={15} />
              <span>Find a Peer Interviewer</span>
            </Link>
          </div>
        </div>
      ) : filteredCandidates.length === 0 ? (
        <div className="card" style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <p>No candidates found matching "{searchQuery}".</p>
        </div>
      ) : (
        /* Candidates Table */
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#0e1422', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '1rem 1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, width: '70px' }}>
                    Rank
                  </th>
                  <th style={{ padding: '1rem 1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Candidate
                  </th>
                  <th style={{ padding: '1rem 1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }}>
                    Interviews
                  </th>
                  <th style={{ padding: '1rem 1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>
                    Average Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCandidates.map((c) => {
                  const isCurrentUser = user && c.candidate_id === user.id;

                  return (
                    <tr
                      key={c.candidate_id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        background: isCurrentUser ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      {/* Rank */}
                      <td style={{ padding: '1.1rem 1.25rem' }}>
                        {getRankBadge(c.rank)}
                      </td>

                      {/* Candidate Name & Skills */}
                      <td style={{ padding: '1.1rem 1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <Link
                            to={`/candidates/${c.username || c.candidate_id}`}
                            style={{ fontWeight: 700, color: isCurrentUser ? '#a5b4fc' : '#f9fafb', fontSize: '0.95rem', textDecoration: 'none' }}
                            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                          >
                            {c.candidate_name}
                          </Link>
                          {isCurrentUser && (
                            <span className="badge badge-primary" style={{ fontSize: '0.7rem', padding: '1px 6px' }}>
                              You
                            </span>
                          )}
                        </div>

                        {/* Skills and GitHub */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                          {c.skills && c.skills.length > 0 && (
                            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                              {c.skills.slice(0, 3).map((s, idx) => (
                                <span key={idx} className="badge badge-secondary" style={{ fontSize: '0.68rem', padding: '1px 5px' }}>
                                  {s}
                                </span>
                              ))}
                            </div>
                          )}

                          {c.github && (
                            <a
                              href={c.github.startsWith('http') ? c.github : `https://${c.github}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                            >
                              <span>GitHub</span>
                              <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Interview Count */}
                      <td style={{ padding: '1.1rem 1.25rem', textAlign: 'center' }}>
                        <span style={{
                          background: '#1e293b',
                          padding: '0.25rem 0.65rem',
                          borderRadius: 9999,
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          color: '#e2e8f0',
                        }}>
                          {c.interview_count} completed
                        </span>
                      </td>

                      {/* Average Score */}
                      <td style={{ padding: '1.1rem 1.25rem', textAlign: 'right' }}>
                        <div style={{
                          fontSize: '1.25rem',
                          fontWeight: 800,
                          color: c.average_score >= 8.5 ? '#10b981' : c.average_score >= 7.0 ? '#38bdf8' : '#f59e0b',
                        }}>
                          {c.average_score} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/ 10</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
