import React, { useState } from 'react';
import { Star, X, CheckCircle2, AlertCircle, Sparkles, MessageSquare } from 'lucide-react';
import { submitReview } from '../../services/reviewService';

const RATING_LABELS = {
  1: 'Needs Significant Improvement',
  2: 'Below Expectations',
  3: 'Satisfactory & Fair',
  4: 'Very Helpful & Professional',
  5: 'Exceptional Interview Experience!',
};

const QUICK_TAGS = [
  'Constructive Feedback',
  'Punctual & Prepared',
  'Patient & Encouraging',
  'Great Explanations',
  'Realistic Technical Depth',
  'Helpful Hints',
];

export default function ReviewModal({
  isOpen,
  onClose,
  interview,
  candidateId,
  onReviewSubmitted,
}) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen || !interview) return null;

  const handleTagToggle = (tag) => {
    let updated;
    if (selectedTags.includes(tag)) {
      updated = selectedTags.filter((t) => t !== tag);
    } else {
      updated = [...selectedTags, tag];
    }
    setSelectedTags(updated);

    // Update review text with tag context if empty or append
    if (updated.length > 0 && !reviewText.includes(tag)) {
      setReviewText((prev) => (prev ? `${prev}\nHighlights: ${updated.join(', ')}` : `Highlights: ${updated.join(', ')}`));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating) {
      setError('Please select a star rating between 1 and 5.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await submitReview({
        interviewId: interview.id,
        candidateId: interview.candidate_id || candidateId,
        interviewerId: interview.interviewer_id,
        rating,
        reviewText,
      });

      setSubmitted(true);
      if (onReviewSubmitted) {
        onReviewSubmitted();
      }

      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err) {
      console.error('[ReviewModal] Submit error:', err);
      setError(err.message || 'Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(3, 7, 18, 0.8)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1.5rem',
    }}>
      <div style={{
        background: '#111827',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        width: '100%',
        maxWidth: '520px',
        padding: '2rem',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        position: 'relative',
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={submitting}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <X size={20} />
        </button>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <div style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem auto',
              border: '1px solid #10b981',
            }}>
              <CheckCircle2 size={32} color="#34d399" />
            </div>
            <h2 style={{ fontSize: '1.4rem', marginBottom: '0.4rem', color: '#f9fafb' }}>Thank You!</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Your rating and feedback have been permanently recorded.
            </p>
          </div>
        ) : (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'rgba(245, 158, 11, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 0.75rem auto',
                border: '1px solid rgba(245, 158, 11, 0.3)',
              }}>
                <Star size={24} color="#f59e0b" fill="#f59e0b" />
              </div>
              <h2 style={{ fontSize: '1.4rem', marginBottom: '0.25rem', color: '#f9fafb' }}>
                Rate Your Interviewer
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                How was your session with <strong style={{ color: '#e0e7ff' }}>{interview.interviewer_name || 'your peer interviewer'}</strong>?
              </p>
            </div>

            {error && (
              <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Star Rating Selector */}
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(star)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '0.25rem',
                        transition: 'transform 0.15s ease',
                        transform: (hoverRating || rating) >= star ? 'scale(1.15)' : 'scale(1)',
                      }}
                    >
                      <Star
                        size={32}
                        color={(hoverRating || rating) >= star ? '#f59e0b' : '#374151'}
                        fill={(hoverRating || rating) >= star ? '#f59e0b' : 'transparent'}
                      />
                    </button>
                  ))}
                </div>

                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f59e0b', height: '20px' }}>
                  {RATING_LABELS[hoverRating || rating]}
                </div>
              </div>

              {/* Quick Feedback Chips */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                  Quick Feedback Tags
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {QUICK_TAGS.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleTagToggle(tag)}
                        style={{
                          background: isSelected ? 'rgba(99, 102, 241, 0.2)' : '#1f293d',
                          border: `1px solid ${isSelected ? '#6366f1' : 'var(--border-subtle)'}`,
                          color: isSelected ? '#a5b4fc' : '#cbd5e1',
                          padding: '0.25rem 0.65rem',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        {isSelected ? '✓ ' : '+ '}{tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Written Review Text */}
              <div className="form-group" style={{ marginBottom: '1.75rem' }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>
                  Detailed Written Review (Optional)
                </label>
                <textarea
                  className="form-textarea"
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Share details about the interviewer's technical depth, problem selection, and demeanor..."
                  rows={4}
                  style={{
                    fontSize: '0.875rem',
                    background: '#090d16',
                    borderColor: 'var(--border-subtle)',
                    color: '#f9fafb',
                    resize: 'none',
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="btn btn-outline btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !rating}
                  className="btn btn-primary btn-sm"
                  style={{ minWidth: '130px' }}
                >
                  {submitting ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
