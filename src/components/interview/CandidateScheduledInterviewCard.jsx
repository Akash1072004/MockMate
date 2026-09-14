import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, Play, CheckCircle2, Video } from 'lucide-react';

/**
 * Formats difference between target timestamp and current timestamp into a readable countdown string.
 */
export function formatScheduledCountdown(targetMs, nowMs) {
  const diff = targetMs - nowMs;
  if (diff <= 0) return '00 : 00 : 00';

  const totalSecs = Math.floor(diff / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  const pad = (n) => String(n).padStart(2, '0');
  if (days > 0) {
    return `${days}d ${pad(hours)} : ${pad(minutes)} : ${pad(seconds)}`;
  }
  return `${pad(hours)} : ${pad(minutes)} : ${pad(seconds)}`;
}

/**
 * Authoritative Candidate Scheduled Interview Card
 * Uses database start_time timestamp, calculates real countdown every second,
 * and displays zero/ready state when time arrives without automatically changing status to active.
 */
export default function CandidateScheduledInterviewCard({ item, now }) {
  if (!item) return null;

  const currentNow = now || Date.now();
  const startTimeMs = item.start_time ? new Date(item.start_time).getTime() : null;
  const isInvalidDate = !startTimeMs || isNaN(startTimeMs);

  const remainingMs = !isInvalidDate ? startTimeMs - currentNow : null;
  const isReady = remainingMs !== null && remainingMs <= 0;
  const countdownText = !isInvalidDate ? formatScheduledCountdown(startTimeMs, currentNow) : '-- : -- : --';

  const startDate = !isInvalidDate ? new Date(item.start_time) : null;
  const formattedDate = startDate
    ? startDate.toLocaleDateString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Pending Schedule';

  const formattedTime = startDate
    ? startDate.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : '';

  return (
    <div
      className="card"
      style={{
        background: isReady
          ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(16, 185, 129, 0.08) 100%)'
          : 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(99, 102, 241, 0.06) 100%)',
        border: isReady ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(168, 85, 247, 0.4)',
        boxShadow: isReady ? '0 0 24px rgba(16, 185, 129, 0.15)' : '0 0 24px rgba(168, 85, 247, 0.15)',
        padding: '1.5rem',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.25rem',
        }}
      >
        {/* Left: Metadata & Status Details */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', minWidth: 260 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 'var(--radius-md)',
              background: isReady ? 'rgba(16, 185, 129, 0.2)' : 'rgba(168, 85, 247, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isReady ? '#34d399' : '#c084fc',
              flexShrink: 0,
            }}
          >
            {isReady ? <CheckCircle2 size={26} /> : <Calendar size={24} />}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
              <span
                style={{
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  color: isReady ? '#34d399' : '#c084fc',
                }}
              >
                {isReady ? 'Interview Ready' : 'Interview Scheduled'}
              </span>
              <span
                className="badge"
                style={{
                  background: isReady ? 'rgba(16, 185, 129, 0.2)' : 'rgba(168, 85, 247, 0.2)',
                  color: isReady ? '#6ee7b7' : '#d8b4fe',
                  border: isReady ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(168, 85, 247, 0.4)',
                }}
              >
                {isReady ? 'Waiting Room Open' : 'Scheduled'}
              </span>
            </div>

            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', marginBottom: '0.4rem' }}>
              Interviewer: <span style={{ color: isReady ? '#6ee7b7' : '#e9d5ff' }}>{item.interviewer_name || 'Assigned Interviewer'}</span>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
              <span>
                Date: <strong style={{ color: 'var(--text-primary)' }}>{formattedDate}</strong>
              </span>
              {formattedTime && (
                <span>
                  Time: <strong style={{ color: 'var(--text-primary)' }}>{formattedTime}</strong>
                </span>
              )}
              {item.duration && (
                <span>
                  Duration: <strong style={{ color: 'var(--text-primary)' }}>{item.duration} mins</strong>
                </span>
              )}
              {item.join_code && (
                <span>
                  Code: <strong style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>{item.join_code}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Authoritative Live Countdown & Waiting Room Entry */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div
            style={{
              textAlign: 'center',
              background: 'rgba(0,0,0,0.4)',
              padding: '0.6rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              border: isReady ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(168, 85, 247, 0.4)',
              minWidth: 160,
            }}
          >
            <div
              style={{
                fontSize: '0.72rem',
                color: isReady ? '#34d399' : '#c084fc',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '0.2rem',
              }}
            >
              {isReady ? 'Status' : 'Starts in'}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: isReady ? '1.15rem' : '1.35rem',
                fontWeight: 800,
                color: isReady ? '#34d399' : '#e9d5ff',
                letterSpacing: isReady ? 'normal' : '0.05em',
              }}
            >
              {isReady ? 'Interview is ready' : countdownText}
            </div>
            {formattedTime && !isReady && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Scheduled for {formattedTime}
              </div>
            )}
          </div>

          <Link
            to={`/interview/${item.id}`}
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.75rem 1.35rem',
              fontWeight: 700,
              boxShadow: isReady ? '0 0 15px rgba(99, 102, 241, 0.4)' : 'none',
            }}
          >
            <Play size={16} />
            <span>Enter Waiting Room</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
