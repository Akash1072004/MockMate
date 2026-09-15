import React from 'react';
import {
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Code2,
  FileText,
  HelpCircle,
  MessageSquare,
  Sparkles,
  User,
  Award,
  Layers
} from 'lucide-react';

export default function InterviewStageSidebar({
  stages = [],
  currentStage = 'introduction',
  stageOrder = [],
  collapsed = false,
  onToggleCollapse = () => {},
  interviewType = 'DSA',
  difficulty = 'Medium',
  candidateHasResume = false,
}) {
  const currentIdx = stageOrder.indexOf(currentStage);

  return (
    <aside
      style={{
        width: collapsed ? '56px' : '230px',
        minWidth: collapsed ? '56px' : '230px',
        maxWidth: collapsed ? '56px' : '230px',
        height: '100%',
        background: '#090d16',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.2s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        zIndex: 20,
        flexShrink: 0,
        userSelect: 'none',
      }}
      aria-label="Interview Stages"
    >
      {/* Top Header / Branding & Collapse Toggle */}
      <div
        style={{
          height: '50px',
          padding: collapsed ? '0' : '0 0.85rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
          background: '#0c121e',
        }}
      >
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: '6px',
                background: 'linear-gradient(135deg, #6366f1 0%, #38bdf8 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                flexShrink: 0,
              }}
            >
              <Bot size={15} />
            </div>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.04em', color: '#f8fafc', textTransform: 'uppercase' }}>
                MockMate
              </span>
              <span style={{ fontSize: '0.7rem', color: '#818cf8', marginLeft: '0.35rem', fontWeight: 600 }}>
                AI
              </span>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onToggleCollapse}
          className="btn btn-ghost btn-xs"
          style={{
            padding: '0.35rem',
            color: 'var(--text-muted)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title={collapsed ? 'Expand interview stages panel' : 'Collapse stages panel'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Stage Timeline Navigation */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: collapsed ? '0.75rem 0.35rem' : '0.85rem 0.65rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
        }}
      >
        {!collapsed && (
          <div
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-muted)',
              padding: '0.2rem 0.5rem 0.4rem 0.5rem',
            }}
          >
            Stages ({currentIdx + 1}/{stages.length})
          </div>
        )}

        {stages.map((stage, idx) => {
          const isPast = idx < currentIdx;
          const isCurrent = idx === currentIdx;

          return (
            <div
              key={stage.key}
              title={`${stage.label}: ${stage.desc} ${isCurrent ? '(Current Stage)' : isPast ? '(Completed)' : '(Upcoming)'}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: collapsed ? '0' : '0.65rem',
                justifyContent: collapsed ? 'center' : 'flex-start',
                padding: collapsed ? '0.55rem 0' : '0.5rem 0.65rem',
                borderRadius: 'var(--radius-sm)',
                background: isCurrent
                  ? 'rgba(99, 102, 241, 0.14)'
                  : isPast
                  ? 'rgba(16, 185, 129, 0.04)'
                  : 'transparent',
                border: isCurrent
                  ? '1px solid rgba(99, 102, 241, 0.35)'
                  : '1px solid transparent',
                position: 'relative',
                transition: 'all 0.15s ease',
              }}
            >
              {isCurrent && !collapsed && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: '15%',
                    bottom: '15%',
                    width: '3px',
                    borderRadius: '0 2px 2px 0',
                    background: '#6366f1',
                    boxShadow: '0 0 8px #6366f1',
                  }}
                />
              )}

              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: isPast
                    ? '#10b981'
                    : isCurrent
                    ? '#6366f1'
                    : '#151d30',
                  color: isPast || isCurrent ? '#ffffff' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  flexShrink: 0,
                  boxShadow: isCurrent ? '0 0 10px rgba(99, 102, 241, 0.5)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                {isPast ? <Check size={13} strokeWidth={2.8} /> : <span>{idx + 1}</span>}
              </div>

              {!collapsed && (
                <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                  <div
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: isCurrent ? 700 : isPast ? 600 : 500,
                      color: isCurrent
                        ? '#a5b4fc'
                        : isPast
                        ? '#f1f5f9'
                        : 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {stage.label.replace(/^\d+\.\s*/, '')}
                  </div>
                  <div
                    style={{
                      fontSize: '0.68rem',
                      color: isCurrent ? '#94a3b8' : 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {isCurrent ? 'In progress...' : isPast ? 'Completed' : stage.desc}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Track & Difficulty Context Bar */}
      <div
        style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: collapsed ? '0.75rem 0.35rem' : '0.75rem 0.85rem',
          background: '#0c121e',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: collapsed ? 'center' : 'stretch',
          gap: '0.4rem',
        }}
      >
        {collapsed ? (
          <div
            title={`Track: ${interviewType} | Difficulty: ${difficulty}`}
            style={{
              width: 28,
              height: 28,
              borderRadius: '6px',
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              color: '#a5b4fc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.7rem',
              fontWeight: 800,
            }}
          >
            {interviewType.slice(0, 2).toUpperCase()}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Track:</span>
              <span className="badge badge-primary" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                {interviewType}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Level:</span>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: difficulty === 'Easy' ? '#34d399' : difficulty === 'Hard' ? '#f87171' : '#fbbf24',
                }}
              >
                {difficulty}
              </span>
            </div>
            {candidateHasResume && (
              <div
                style={{
                  marginTop: '0.2rem',
                  fontSize: '0.68rem',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <FileText size={11} />
                <span>Resume Loaded</span>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}