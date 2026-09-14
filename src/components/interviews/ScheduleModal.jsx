import React, { useState } from 'react';
import { Calendar, Clock, Play, X, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ScheduleModal({
  isOpen,
  onClose,
  request,
  onSchedule,
  onStartNow,
}) {
  if (!isOpen || !request) return null;

  // Initialize date to today's date in YYYY-MM-DD format
  const todayStr = new Date().toISOString().split('T')[0];
  
  // Initialize time to 1 hour from now, rounded to nearest 15/30 min
  const defaultTime = () => {
    const d = new Date();
    d.setHours(d.getHours() + 1);
    d.setMinutes(d.getMinutes() > 30 ? 0 : 30);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const [date, setDate] = useState(todayStr);
  const [time, setTime] = useState(defaultTime());
  const [duration, setDuration] = useState('60');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const candidateName = request.candidate_name || request.candidate?.full_name || 'Candidate';

  const handleScheduleSubmit = async (e) => {
    e?.preventDefault();
    if (!date || !time) {
      setError('Please select both a date and time.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      // Build ISO string from date and time
      const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
      await onSchedule({ scheduledAt, duration: Number(duration) });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to schedule interview.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartNowClick = async () => {
    try {
      setSubmitting(true);
      setError('');
      await onStartNow({ duration: Number(duration) });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to start interview immediately.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '520px',
          background: '#0d1321',
          border: '1px solid rgba(99, 102, 241, 0.4)',
          borderRadius: 'var(--radius-lg)',
          padding: '2rem',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={submitting}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#818cf8',
              border: '1px solid rgba(99, 102, 241, 0.3)',
            }}
          >
            <Calendar size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Schedule Mock Interview</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
              Candidate: <strong style={{ color: '#f9fafb' }}>{candidateName}</strong>
            </p>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} />
            <span style={{ fontSize: '0.85rem' }}>{error}</span>
          </div>
        )}

        {/* Form Controls */}
        <form onSubmit={handleScheduleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label className="form-label" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Calendar size={14} color="#818cf8" />
              <span>Interview Date</span>
            </label>
            <input
              type="date"
              className="form-control"
              value={date}
              min={todayStr}
              onChange={(e) => setDate(e.target.value)}
              required
              style={{ background: '#151d30', color: '#f9fafb', borderColor: 'var(--border-subtle)' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Clock size={14} color="#818cf8" />
                <span>Start Time</span>
              </label>
              <input
                type="time"
                className="form-control"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                style={{ background: '#151d30', color: '#f9fafb', borderColor: 'var(--border-subtle)' }}
              />
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '0.85rem' }}>
                Duration
              </label>
              <select
                className="form-select"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                style={{ background: '#151d30', color: '#f9fafb', borderColor: 'var(--border-subtle)' }}
              >
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">60 minutes</option>
                <option value="90">90 minutes</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%' }}
            >
              <CheckCircle2 size={16} />
              <span>{submitting ? 'Scheduling...' : 'Schedule Interview'}</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.25rem 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }}></div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>OR</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }}></div>
            </div>

            <button
              type="button"
              onClick={handleStartNowClick}
              disabled={submitting}
              className="btn btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                width: '100%',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10b981',
                color: '#34d399',
              }}
            >
              <Play size={16} />
              <span>Start Now (Instant Live Session)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
