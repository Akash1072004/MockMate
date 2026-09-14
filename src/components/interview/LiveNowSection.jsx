import React, { useState, useEffect } from 'react';
import { Radio, Users, Clock, Video, Activity } from 'lucide-react';
import { fetchLiveSessions, subscribeToLiveSessions } from '../../services/interviewService';

/**
 * Format elapsed time into mm:ss or hh:mm:ss
 */
function formatElapsed(startTimeStr) {
  if (!startTimeStr) return '00:00';
  const start = new Date(startTimeStr).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - start) / 1000));
  const hrs = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * LiveSessionItem: Renders a single active session with a running ticker.
 * STRICT PRODUCT RULE: ABSOLUTELY NO ENTER / JOIN BUTTON.
 */
function LiveSessionItem({ session }) {
  const [elapsed, setElapsed] = useState(() => formatElapsed(session.startTime));

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(formatElapsed(session.startTime));
    }, 1000);
    return () => clearInterval(timer);
  }, [session.startTime]);

  const formattedStartTime = session.startTime
    ? new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Just now';

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.04) 0%, rgba(20, 24, 39, 0.85) 100%)',
        borderRadius: 'var(--radius-md)',
        padding: '1.25rem 1.5rem',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top row: Status & Elapsed ticker */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: '#ef4444',
              boxShadow: '0 0 10px #ef4444',
              animation: 'pulse 1.5s infinite',
            }}
          />
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 800,
              color: '#f87171',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            IN SESSION
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            background: 'rgba(239, 68, 68, 0.1)',
            padding: '0.2rem 0.6rem',
            borderRadius: 9999,
            border: '1px solid rgba(239, 68, 68, 0.2)',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: '#fca5a5',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <Clock size={12} />
          <span>{elapsed}</span>
        </div>
      </div>

      {/* Main details: Interviewer & Candidate */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <div>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            Interviewer
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
            {session.interviewerName}
          </div>
        </div>

        <div style={{ marginTop: '0.25rem' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            Interviewing
          </div>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#93c5fd' }}>
            {session.candidateName}
          </div>
        </div>
      </div>

      {/* Footer metadata */}
      <div
        style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          paddingTop: '0.65rem',
          marginTop: '0.2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <span>Started: <strong style={{ color: '#cbd5e1' }}>{formattedStartTime}</strong></span>
        <span style={{ fontStyle: 'italic', color: '#64748b' }}>Informational view</span>
      </div>
    </div>
  );
}

/**
 * LiveNowSection: Displays genuine platform active sessions.
 * Realtime updates: automatically adds active interviews, removes completed ones.
 * NO ENTER / JOIN BUTTON ALLOWED.
 */
export default function LiveNowSection({ title = 'Live Now', subtitle = 'Interviews currently in progress on MockMate' }) {
  const [liveSessions, setLiveSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    fetchLiveSessions().then((sessions) => {
      if (isMounted) {
        setLiveSessions(sessions);
        setLoading(false);
      }
    });

    const unsubscribe = subscribeToLiveSessions((updaterOrSessions) => {
      if (!isMounted) return;
      if (typeof updaterOrSessions === 'function') {
        setLiveSessions(updaterOrSessions);
      } else if (Array.isArray(updaterOrSessions)) {
        setLiveSessions(updaterOrSessions);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return (
    <div style={{ marginBottom: '2.5rem' }}>
      {/* Section Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444',
            }}
          >
            <Radio size={18} style={{ animation: 'pulse 1.8s infinite' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 800, letterSpacing: '0.02em', color: '#f8fafc' }}>
                {title}
              </h2>
              {liveSessions.length > 0 && (
                <span
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: '#f87171',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 9999,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.55rem',
                  }}
                >
                  {liveSessions.length}
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.15rem 0 0 0' }}>
              {subtitle}
            </p>
          </div>
        </div>

        <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Activity size={13} color="#10b981" />
          <span>Realtime platform feed &bull; Read-only</span>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Checking live platform activity...
        </div>
      ) : liveSessions.length === 0 ? (
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: 'var(--radius-md)',
            padding: '2rem',
            textAlign: 'center',
            border: '1px dashed var(--border-subtle)',
          }}
        >
          <Video size={28} color="var(--text-muted)" style={{ margin: '0 auto 0.5rem auto', opacity: 0.6 }} />
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
            No live sessions currently in progress on MockMate.
          </p>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            When interviewers and candidates begin an active session, it will appear here in real time.
          </span>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {liveSessions.map((session) => (
            <LiveSessionItem key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}
