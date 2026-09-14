import React, { useState } from 'react';
import { 
  BookOpen, 
  ChevronRight, 
  Code2, 
  Tag, 
  Layers, 
  Check, 
  Info,
  Clock,
  Sparkles,
  Plus
} from 'lucide-react';

export default function LeetCodeQuestionPanel({
  questions = [],
  activeQuestion = null,
  onSelectQuestion,
  onAddQuestion,
  canAddQuestion = false,
  role = 'candidate',
  isSynced = true,
}) {
  const [activeTab, setActiveTab] = useState('description'); // 'description' | 'examples' | 'constraints'

  const currentQ = activeQuestion || questions[0];

  const getDifficultyStyle = (diff) => {
    switch (diff?.toLowerCase()) {
      case 'easy':
        return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)' };
      case 'hard':
        return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)' };
      default:
        return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)' };
    }
  };

  if (!currentQ) {
    return (
      <div style={{ flex: 1, padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <BookOpen size={36} style={{ margin: '0 auto 0.75rem auto', opacity: 0.4 }} />
        <p>No coding problem selected.</p>
        {canAddQuestion && onAddQuestion && (
          <button onClick={onAddQuestion} className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>
            <Plus size={14} />
            <span>Select Problem from Bank</span>
          </button>
        )}
      </div>
    );
  }

  const diffStyle = getDifficultyStyle(currentQ.difficulty);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0d1321', overflow: 'hidden' }}>
      {/* Top Question Tabs (if multiple problems assigned) */}
      {questions.length > 1 && (
        <div style={{
          padding: '0.5rem 0.75rem',
          background: '#111827',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          overflowX: 'auto',
          flexShrink: 0,
        }}>
          {questions.map((q, idx) => {
            const isSelected = (q.id === currentQ.id) || (q.question_id && q.question_id === currentQ.question_id);
            return (
              <button
                key={q.id || idx}
                onClick={() => onSelectQuestion && onSelectQuestion(q)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.3rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.78rem',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.02)',
                  color: isSelected ? '#a5b4fc' : '#94a3b8',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>Problem {idx + 1}</span>
              </button>
            );
          })}

          {canAddQuestion && onAddQuestion && (
            <button
              onClick={onAddQuestion}
              className="btn btn-outline btn-sm"
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: 'auto' }}
              title="Add Problem"
            >
              <Plus size={12} />
              <span>Add</span>
            </button>
          )}
        </div>
      )}

      {/* Sub-Header Section Navigation Tabs */}
      <div style={{
        padding: '0 1rem',
        background: '#090d16',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        flexShrink: 0,
      }}>
        {[
          { key: 'description', label: 'Description' },
          { key: 'examples', label: `Examples (${currentQ.examples?.length || 0})` },
          { key: 'constraints', label: 'Constraints' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '0.65rem 0.2rem',
              fontSize: '0.825rem',
              fontWeight: activeTab === tab.key ? 700 : 500,
              color: activeTab === tab.key ? '#f9fafb' : 'var(--text-muted)',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent-primary)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {tab.label}
          </button>
        ))}

        {role === 'interviewer' && isSynced && (
          <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Check size={12} /> Sync Active
          </span>
        )}
      </div>

      {/* Scrollable Problem Content Container */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Title & Metadata Badges */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.2rem 0.6rem',
                borderRadius: '9999px',
                background: diffStyle.bg,
                color: diffStyle.color,
                border: `1px solid ${diffStyle.border}`,
              }}
            >
              {currentQ.difficulty || 'Medium'}
            </span>

            {currentQ.topic && (
              <span className="badge badge-secondary" style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Tag size={11} />
                <span>{currentQ.topic}</span>
              </span>
            )}

            {currentQ.time_limit_ms && (
              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                <Clock size={11} />
                <span>{currentQ.time_limit_ms}ms</span>
              </span>
            )}
          </div>

          <h2 style={{ fontSize: '1.3rem', color: '#f9fafb', fontWeight: 800, lineHeight: 1.3 }}>
            {currentQ.title}
          </h2>
        </div>

        {/* Tab 1: Description */}
        {(activeTab === 'description' || activeTab === 'all') && (
          <div>
            <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>
              Problem Description
            </div>
            <div style={{ fontSize: '0.9rem', color: '#cbd5e1', lineHeight: '1.65', whiteSpace: 'pre-wrap' }}>
              {currentQ.description || currentQ.question_text}
            </div>

            {/* Input & Output Specifications if provided */}
            {(currentQ.input_format || currentQ.input_description) && (
              <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Input Format
                </div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: '1.5' }}>
                  {currentQ.input_format || currentQ.input_description}
                </div>
              </div>
            )}

            {(currentQ.output_format || currentQ.output_description) && (
              <div style={{ marginTop: '0.75rem', background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Output Format
                </div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: '1.5' }}>
                  {currentQ.output_format || currentQ.output_description}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Examples */}
        {(activeTab === 'examples' || activeTab === 'description') && currentQ.examples && currentQ.examples.length > 0 && (
          <div>
            <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.6rem', fontWeight: 600 }}>
              Examples
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {currentQ.examples.map((ex, exIdx) => (
                <div
                  key={exIdx}
                  style={{
                    background: '#090d16',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem 1rem',
                  }}
                >
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.4rem' }}>
                    Example {exIdx + 1}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.825rem', fontFamily: 'var(--font-mono)' }}>
                    {ex.input && (
                      <div style={{ color: '#cbd5e1' }}>
                        <strong style={{ color: '#94a3b8' }}>Input: </strong>
                        <span>{ex.input}</span>
                      </div>
                    )}
                    {ex.output && (
                      <div style={{ color: '#cbd5e1' }}>
                        <strong style={{ color: '#94a3b8' }}>Output: </strong>
                        <span style={{ color: '#34d399' }}>{ex.output}</span>
                      </div>
                    )}
                    {ex.explanation && (
                      <div style={{ color: '#94a3b8', fontFamily: 'var(--font-sans)', marginTop: '0.25rem', fontSize: '0.8rem', lineHeight: '1.4' }}>
                        <strong style={{ color: '#cbd5e1' }}>Explanation: </strong>
                        <span>{ex.explanation}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Constraints */}
        {(activeTab === 'constraints' || activeTab === 'description') && (
          <div>
            <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>
              Constraints
            </div>
            {currentQ.constraints ? (
              <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#94a3b8', fontSize: '0.85rem', lineHeight: '1.6', fontFamily: 'var(--font-mono)' }}>
                {typeof currentQ.constraints === 'string'
                  ? currentQ.constraints.split('\n').filter(Boolean).map((c, cIdx) => (
                      <li key={cIdx}>{c.replace(/^[•\-\*]\s*/, '')}</li>
                    ))
                  : Array.isArray(currentQ.constraints)
                  ? currentQ.constraints.map((c, cIdx) => <li key={cIdx}>{c}</li>)
                  : <li>No special constraints specified.</li>}
              </ul>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', margin: 0 }}>
                Standard algorithmic constraints apply.
              </p>
            )}
          </div>
        )}

        {/* Expected Complexity if provided */}
        {(currentQ.expected_time_complexity || currentQ.expected_space_complexity) && (
          <div style={{ background: 'rgba(99, 102, 241, 0.05)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
              Expected Complexity
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.825rem', fontFamily: 'var(--font-mono)' }}>
              {currentQ.expected_time_complexity && (
                <span>Time: <strong style={{ color: '#38bdf8' }}>{currentQ.expected_time_complexity}</strong></span>
              )}
              {currentQ.expected_space_complexity && (
                <span>Space: <strong style={{ color: '#38bdf8' }}>{currentQ.expected_space_complexity}</strong></span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
