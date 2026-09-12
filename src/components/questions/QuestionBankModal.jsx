import React, { useState, useEffect } from 'react';
import { 
  X, 
  Search, 
  Filter, 
  Plus, 
  BookOpen, 
  Check, 
  ChevronRight, 
  Code2, 
  Tag, 
  RotateCw,
  Eye,
  FileCode2,
  Sparkles
} from 'lucide-react';
import { getQuestions } from '../../services/questionService';
import CreateQuestionModal from './CreateQuestionModal';

export default function QuestionBankModal({ 
  isOpen, 
  onClose, 
  onSelectQuestion = null, 
  interviewId = null,
  alreadySelectedIds = [] 
}) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState('All');
  const [topic, setTopic] = useState('All');
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const data = await getQuestions({ difficulty, topic, search });
      setQuestions(data || []);
      if (data?.length > 0 && !selectedQuestion) {
        setSelectedQuestion(data[0]);
      }
    } catch (err) {
      console.error('[QuestionBankModal] Error loading questions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadQuestions();
    }
  }, [isOpen, difficulty, topic]);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      loadQuestions();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  if (!isOpen) return null;

  const topicsList = [
    'All',
    'Arrays & Hashing',
    'Strings',
    'Two Pointers',
    'Binary Search',
    'Dynamic Programming',
    'Stacks & Strings',
    'Trees',
    'Algorithms'
  ];

  const getDifficultyBadge = (diff) => {
    switch (diff) {
      case 'Easy':
        return { color: '#34d399', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)' };
      case 'Medium':
        return { color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)' };
      case 'Hard':
        return { color: '#f87171', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)' };
      default:
        return { color: '#818cf8', bg: 'rgba(99, 102, 241, 0.15)', border: 'rgba(99, 102, 241, 0.3)' };
    }
  };

  return (
    <>
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1040,
        padding: '1.5rem',
      }}>
        <div style={{
          background: '#111827',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '1050px',
          height: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#0e1422',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#818cf8',
              }}>
                <BookOpen size={20} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Question Bank</h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Browse LeetCode-style algorithmic coding problems
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="btn btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Plus size={15} />
                <span>Create Question</span>
              </button>

              <button
                onClick={onClose}
                className="btn btn-outline btn-sm"
                style={{ padding: '0.35rem', borderRadius: '50%' }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div style={{
            padding: '0.85rem 1.5rem',
            borderBottom: '1px solid var(--border-subtle)',
            background: '#131b2e',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
          }}>
            {/* Search Input */}
            <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search problems by title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '2.25rem', paddingRight: '0.75rem', height: '36px', fontSize: '0.85rem' }}
              />
            </div>

            {/* Difficulty Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Difficulty:</span>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="form-select"
                style={{ width: 'auto', height: '36px', padding: '0.2rem 0.65rem', fontSize: '0.85rem' }}
              >
                <option value="All">All Levels</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>

            {/* Topic Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Topic:</span>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="form-select"
                style={{ width: 'auto', height: '36px', padding: '0.2rem 0.65rem', fontSize: '0.85rem' }}
              >
                {topicsList.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <button
              onClick={loadQuestions}
              className="btn btn-outline btn-sm"
              title="Reload questions"
              style={{ height: '36px', padding: '0 0.65rem' }}
            >
              <RotateCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>

          {/* Body: Split View (List on left, Preview on right) */}
          <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', flex: 1, overflow: 'hidden' }}>
            {/* Left: Questions List */}
            <div style={{ borderRight: '1px solid var(--border-subtle)', background: '#0b101b', overflowY: 'auto' }}>
              {loading && questions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                  <RotateCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 0.5rem auto' }} />
                  <p style={{ fontSize: '0.85rem' }}>Loading question bank...</p>
                </div>
              ) : questions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                  <p style={{ fontWeight: 600 }}>No matching questions found.</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Try adjusting your search or create a new question.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {questions.map((q) => {
                    const isSelected = selectedQuestion?.id === q.id;
                    const isAlreadyAdded = alreadySelectedIds.includes(q.id);
                    const badge = getDifficultyBadge(q.difficulty);

                    return (
                      <div
                        key={q.id}
                        onClick={() => setSelectedQuestion(q)}
                        style={{
                          padding: '1rem 1.25rem',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                          borderLeft: isSelected ? '3px solid var(--accent-primary)' : '3px solid transparent',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                          <span style={{
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            color: isSelected ? '#a5b4fc' : 'var(--text-primary)',
                            lineHeight: 1.3
                          }}>
                            {q.title}
                          </span>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: badge.color,
                            background: badge.bg,
                            border: `1px solid ${badge.border}`,
                            padding: '1px 6px',
                            borderRadius: 4,
                            marginLeft: '0.5rem',
                            flexShrink: 0
                          }}>
                            {q.difficulty}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {q.topic || 'Algorithms'}
                          </span>
                          {isAlreadyAdded && (
                            <span style={{ fontSize: '0.7rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                              <Check size={12} />
                              <span>Added</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: Selected Question Preview */}
            <div style={{ padding: '1.5rem', background: '#0e1422', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {selectedQuestion ? (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  {/* Title & Metadata */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.4rem' }}>
                        {selectedQuestion.title}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: getDifficultyBadge(selectedQuestion.difficulty).color,
                          background: getDifficultyBadge(selectedQuestion.difficulty).bg,
                          border: `1px solid ${getDifficultyBadge(selectedQuestion.difficulty).border}`,
                          padding: '2px 8px',
                          borderRadius: 9999
                        }}>
                          {selectedQuestion.difficulty}
                        </span>
                        <span style={{
                          fontSize: '0.75rem',
                          color: '#94a3b8',
                          background: 'rgba(255, 255, 255, 0.05)',
                          padding: '2px 8px',
                          borderRadius: 9999
                        }}>
                          {selectedQuestion.topic}
                        </span>
                      </div>
                    </div>

                    {/* Add to Interview Action Button */}
                    {onSelectQuestion && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectQuestion(selectedQuestion);
                          onClose();
                        }}
                        className="btn btn-primary btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        <Plus size={15} />
                        <span>Select This Question</span>
                      </button>
                    )}
                  </div>

                  {/* Problem Description */}
                  <div style={{
                    fontSize: '0.9rem',
                    color: '#e2e8f0',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    marginBottom: '1.5rem',
                    background: '#090d16',
                    padding: '1.25rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    {selectedQuestion.description}
                  </div>

                  {/* Input / Output Format */}
                  {(selectedQuestion.input_description || selectedQuestion.output_description) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                      {selectedQuestion.input_description && (
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Input Format</span>
                          <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '0.25rem', margin: 0 }}>
                            {selectedQuestion.input_description}
                          </p>
                        </div>
                      )}
                      {selectedQuestion.output_description && (
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Output Format</span>
                          <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '0.25rem', margin: 0 }}>
                            {selectedQuestion.output_description}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Examples */}
                  {selectedQuestion.examples?.length > 0 && (
                    <div style={{ marginBottom: '1.25rem' }}>
                      <h4 style={{ fontSize: '0.95rem', color: '#f8fafc', marginBottom: '0.65rem' }}>Examples</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        {selectedQuestion.examples.map((ex, idx) => (
                          <div
                            key={idx}
                            style={{
                              background: '#090d16',
                              border: '1px solid rgba(255,255,255,0.08)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '0.85rem',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.8rem'
                            }}
                          >
                            <div>
                              <strong style={{ color: '#818cf8' }}>Input: </strong>
                              <span style={{ color: '#cbd5e1' }}>{ex.input}</span>
                            </div>
                            <div style={{ marginTop: '0.25rem' }}>
                              <strong style={{ color: '#34d399' }}>Output: </strong>
                              <span style={{ color: '#cbd5e1' }}>{ex.output}</span>
                            </div>
                            {ex.explanation && (
                              <div style={{ marginTop: '0.35rem', fontFamily: 'var(--font-sans)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                <em>Explanation: {ex.explanation}</em>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Constraints */}
                  {selectedQuestion.constraints && (
                    <div style={{ marginBottom: '1.25rem' }}>
                      <h4 style={{ fontSize: '0.95rem', color: '#f8fafc', marginBottom: '0.5rem' }}>Constraints</h4>
                      <div style={{
                        background: 'rgba(255,255,255,0.02)',
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-sm)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.8rem',
                        color: '#94a3b8',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {selectedQuestion.constraints}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--text-muted)' }}>
                  <Code2 size={40} style={{ opacity: 0.3, margin: '0 auto 0.75rem auto' }} />
                  <p>Select a question on the left to preview its details.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Question Modal */}
      {showCreateModal && (
        <CreateQuestionModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onQuestionCreated={(created) => {
            loadQuestions();
            if (created) setSelectedQuestion(created);
          }}
        />
      )}
    </>
  );
}
