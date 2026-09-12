import React, { useState, useRef } from 'react';
import { LANGUAGE_OPTIONS } from '../../utils/codeTemplates';
import { runCode } from '../../services/codeExecutionService';
import { 
  Code2, 
  RotateCcw, 
  CheckCircle2, 
  RefreshCw, 
  Play, 
  Terminal, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  XCircle,
  Cpu
} from 'lucide-react';

export default function CollaborativeCodeEditor({
  code,
  language,
  syncStatus,
  onCodeChange,
  onLanguageChange,
  onResetTemplate,
  readOnly = false,
  interviewId = null,
  testCases = [],
  onRunSuccess = null,
}) {
  const textareaRef = useRef(null);

  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [activeConsoleTab, setActiveConsoleTab] = useState('output'); // 'output' | 'input' | 'tests'
  const [customInput, setCustomInput] = useState('');
  const [execResult, setExecResult] = useState(null);
  const [selectedTestIdx, setSelectedTestIdx] = useState(0);

  // Split into lines for line counter gutter
  const lines = (code || '').split('\n');
  const lineCount = Math.max(lines.length, 1);

  // Handle Tab indentation & Ctrl+Enter to run
  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRun();
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      // Insert 4 spaces
      const updated = code.substring(0, start) + '    ' + code.substring(end);
      onCodeChange(updated);

      // Re-position cursor after inserted spaces
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 4;
      }, 0);
    }
  };

  const handleRun = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setConsoleOpen(true);
    setActiveConsoleTab('output');

    try {
      const res = await runCode({
        language,
        code,
        testCases,
        customInput: customInput ? customInput : null,
        interviewId,
      });

      setExecResult(res);
      if (res.testResults && res.testResults.length > 1) {
        setActiveConsoleTab('tests');
      }
      if (onRunSuccess) {
        onRunSuccess(res);
      }
    } catch (err) {
      setExecResult({
        success: false,
        verdict: 'RE',
        passedCount: 0,
        totalCount: Math.max(testCases.length, 1),
        executionTimeMs: 0,
        output: '',
        error: err.message || 'Execution failed',
        testResults: [],
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getVerdictBadge = (verdict) => {
    switch (verdict) {
      case 'AC':
        return { label: 'Accepted (Passed)', bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', text: '#34d399', icon: <CheckCircle2 size={13} /> };
      case 'WA':
        return { label: 'Wrong Answer', bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', text: '#fbbf24', icon: <XCircle size={13} /> };
      case 'TLE':
        return { label: 'Time Limit Exceeded', bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#f87171', icon: <Clock size={13} /> };
      case 'CE':
        return { label: 'Compilation Error', bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#f87171', icon: <AlertCircle size={13} /> };
      case 'RE':
        return { label: 'Runtime Error', bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#f87171', icon: <AlertCircle size={13} /> };
      default:
        return { label: verdict || 'Completed', bg: 'rgba(99, 102, 241, 0.15)', border: '#6366f1', text: '#818cf8', icon: <Cpu size={13} /> };
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#090d16',
      overflow: 'hidden',
    }}>
      {/* Editor Control Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.45rem 1rem',
        background: '#0e1422',
        borderBottom: '1px solid var(--border-subtle)',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        {/* Left: Language Selection & Template Reset */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#818cf8', fontSize: '0.85rem', fontWeight: 600 }}>
            <Code2 size={16} />
            <span>Language:</span>
          </div>
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            disabled={readOnly || isRunning}
            className="form-select"
            style={{
              padding: '0.3rem 0.75rem',
              fontSize: '0.85rem',
              background: '#151d30',
              borderColor: 'var(--border-subtle)',
              color: '#f9fafb',
              width: 'auto',
              borderRadius: 'var(--radius-sm)'
            }}
          >
            {LANGUAGE_OPTIONS.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.label}
              </option>
            ))}
          </select>

          <button
            onClick={onResetTemplate}
            disabled={readOnly || isRunning}
            className="btn btn-outline btn-sm"
            style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
            title="Reset code to default template"
          >
            <RotateCcw size={12} />
            <span>Boilerplate</span>
          </button>
        </div>

        {/* Center/Right: Run Code Button & Terminal Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {/* Realtime Synchronization Status Pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', marginRight: '0.5rem' }}>
            {syncStatus === 'syncing' ? (
              <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Saving...</span>
              </span>
            ) : syncStatus === 'remote' ? (
              <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8', animation: 'pulse 1s infinite' }}></span>
                <span>Peer Editing...</span>
              </span>
            ) : (
              <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <CheckCircle2 size={13} />
                <span>Synced</span>
              </span>
            )}
          </div>

          {/* Terminal Toggle Button */}
          <button
            onClick={() => setConsoleOpen(!consoleOpen)}
            className="btn btn-outline btn-sm"
            style={{
              padding: '0.3rem 0.65rem',
              fontSize: '0.75rem',
              borderColor: consoleOpen ? '#6366f1' : 'var(--border-subtle)',
              color: consoleOpen ? '#a5b4fc' : 'var(--text-secondary)'
            }}
          >
            <Terminal size={13} />
            <span>Console</span>
            {execResult && (
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: execResult.success ? '#10b981' : '#ef4444',
                }}
              />
            )}
          </button>

          {/* Run Code Button */}
          <button
            onClick={handleRun}
            disabled={isRunning || !code?.trim()}
            className="btn btn-primary btn-sm"
            style={{
              padding: '0.35rem 0.95rem',
              fontSize: '0.8rem',
              background: isRunning ? '#4338ca' : 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
              border: 'none',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
            title="Execute Code (Ctrl + Enter)"
          >
            {isRunning ? (
              <>
                <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Executing...</span>
              </>
            ) : (
              <>
                <Play size={13} fill="currentColor" />
                <span>Run Code</span>
                <kbd style={{
                  background: 'rgba(0,0,0,0.25)',
                  padding: '1px 4px',
                  borderRadius: 3,
                  fontSize: '0.68rem',
                  marginLeft: '2px',
                  color: '#e0e7ff',
                }}>
                  Ctrl+↵
                </kbd>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editor Body with Line Numbers */}
      <div style={{
        display: 'flex',
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.925rem',
        lineHeight: '1.6',
      }}>
        {/* Line Numbers Gutter */}
        <div style={{
          width: '44px',
          padding: '1rem 0.5rem',
          background: '#0b101b',
          borderRight: '1px solid rgba(255, 255, 255, 0.05)',
          color: '#475569',
          textAlign: 'right',
          userSelect: 'none',
          overflowY: 'hidden',
          fontSize: '0.8rem',
        }}>
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i + 1} style={{ height: '24px' }}>
              {i + 1}
            </div>
          ))}
        </div>

        {/* Code Textarea */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            onKeyDown={handleKeyDown}
            readOnly={readOnly}
            spellCheck={false}
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            placeholder={`// Write your ${language.toUpperCase()} code here...`}
            style={{
              width: '100%',
              height: '100%',
              padding: '1rem',
              background: 'transparent',
              border: 'none',
              color: '#e2e8f0',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.925rem',
              lineHeight: '24px',
              resize: 'none',
              outline: 'none',
              whiteSpace: 'pre',
              tabSize: 4,
            }}
          />
        </div>
      </div>

      {/* Interactive Execution Console Drawer */}
      {consoleOpen && (
        <div style={{
          height: '240px',
          background: '#0b0f19',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 10,
          boxShadow: '0 -4px 16px rgba(0,0,0,0.4)',
        }}>
          {/* Console Header Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.4rem 1rem',
            background: '#111726',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {/* Tab Switchers */}
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button
                  type="button"
                  onClick={() => setActiveConsoleTab('output')}
                  style={{
                    padding: '0.25rem 0.65rem',
                    fontSize: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    background: activeConsoleTab === 'output' ? '#1f293d' : 'transparent',
                    color: activeConsoleTab === 'output' ? '#f9fafb' : '#94a3b8',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: activeConsoleTab === 'output' ? 600 : 400,
                  }}
                >
                  Output
                </button>

                {execResult?.testResults && execResult.testResults.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveConsoleTab('tests')}
                    style={{
                      padding: '0.25rem 0.65rem',
                      fontSize: '0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      background: activeConsoleTab === 'tests' ? '#1f293d' : 'transparent',
                      color: activeConsoleTab === 'tests' ? '#f9fafb' : '#94a3b8',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: activeConsoleTab === 'tests' ? 600 : 400,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    <span>Test Cases</span>
                    <span style={{
                      fontSize: '0.7rem',
                      padding: '1px 5px',
                      borderRadius: 10,
                      background: execResult.passedCount === execResult.totalCount ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: execResult.passedCount === execResult.totalCount ? '#34d399' : '#f87171'
                    }}>
                      {execResult.passedCount}/{execResult.totalCount}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActiveConsoleTab('input')}
                  style={{
                    padding: '0.25rem 0.65rem',
                    fontSize: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    background: activeConsoleTab === 'input' ? '#1f293d' : 'transparent',
                    color: activeConsoleTab === 'input' ? '#f9fafb' : '#94a3b8',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: activeConsoleTab === 'input' ? 600 : 400,
                  }}
                >
                  Custom Stdin
                </button>
              </div>

              {/* Verdict Indicator Pill */}
              {execResult && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.2rem 0.6rem',
                  borderRadius: 9999,
                  background: getVerdictBadge(execResult.verdict).bg,
                  border: `1px solid ${getVerdictBadge(execResult.verdict).border}`,
                  color: getVerdictBadge(execResult.verdict).text,
                  fontSize: '0.72rem',
                  fontWeight: 600,
                }}>
                  {getVerdictBadge(execResult.verdict).icon}
                  <span>{getVerdictBadge(execResult.verdict).label}</span>
                </div>
              )}

              {execResult?.executionTimeMs > 0 && (
                <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Clock size={11} />
                  <span>{execResult.executionTimeMs}ms</span>
                </span>
              )}
            </div>

            {/* Close / Collapse button */}
            <button
              onClick={() => setConsoleOpen(false)}
              className="btn btn-outline btn-sm"
              style={{ padding: '0.2rem 0.4rem', border: 'none', color: '#94a3b8' }}
              title="Close Console"
            >
              <ChevronDown size={14} />
            </button>
          </div>

          {/* Console Content Body */}
          <div style={{ flex: 1, padding: '0.75rem 1rem', overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
            {/* Tab: Output */}
            {activeConsoleTab === 'output' && (
              <div>
                {isRunning ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#818cf8', padding: '1rem 0' }}>
                    <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Compiling and running {language.toUpperCase()} solution...</span>
                  </div>
                ) : !execResult ? (
                  <div style={{ color: '#64748b', fontStyle: 'italic', padding: '0.5rem 0' }}>
                    Click "Run Code" or press Ctrl+Enter to execute your solution.
                  </div>
                ) : (
                  <div>
                    {execResult.error && (
                      <div style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        color: '#f87171',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.75rem',
                        marginBottom: '0.75rem',
                        whiteSpace: 'pre-wrap',
                      }}>
                        <div style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <AlertCircle size={14} />
                          <span>{execResult.verdict === 'CE' ? 'Compilation Error:' : 'Runtime Diagnostic:'}</span>
                        </div>
                        {execResult.error}
                      </div>
                    )}

                    {execResult.output && (
                      <div>
                        <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.35rem' }}>Standard Output:</div>
                        <pre style={{
                          margin: 0,
                          padding: '0.5rem 0.75rem',
                          background: '#070a11',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid rgba(255,255,255,0.05)',
                          color: '#e2e8f0',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}>
                          {execResult.output}
                        </pre>
                      </div>
                    )}

                    {!execResult.output && !execResult.error && (
                      <div style={{ color: '#10b981' }}>
                        Program completed with exit code 0 (no output written to stdout).
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Test Cases */}
            {activeConsoleTab === 'tests' && execResult?.testResults && (
              <div>
                {/* Test case buttons */}
                <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                  {execResult.testResults.map((t, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedTestIdx(idx)}
                      style={{
                        padding: '0.25rem 0.6rem',
                        borderRadius: 'var(--radius-sm)',
                        background: selectedTestIdx === idx ? '#1e293b' : '#0f172a',
                        border: `1px solid ${selectedTestIdx === idx ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
                        color: t.passed ? '#34d399' : '#f87171',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      {t.passed ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                      <span>Case {idx + 1}</span>
                    </button>
                  ))}
                </div>

                {/* Selected Test Case Details */}
                {execResult.testResults[selectedTestIdx] && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Input:</div>
                      <pre style={{
                        margin: 0,
                        padding: '0.4rem 0.6rem',
                        background: '#070a11',
                        borderRadius: 'var(--radius-sm)',
                        color: '#cbd5e1',
                        fontSize: '0.8rem',
                        minHeight: '35px',
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}>
                        {execResult.testResults[selectedTestIdx].input || '(empty)'}
                      </pre>
                    </div>

                    <div>
                      <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Expected Output:</div>
                      <pre style={{
                        margin: 0,
                        padding: '0.4rem 0.6rem',
                        background: '#070a11',
                        borderRadius: 'var(--radius-sm)',
                        color: '#cbd5e1',
                        fontSize: '0.8rem',
                        minHeight: '35px',
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}>
                        {execResult.testResults[selectedTestIdx].expectedOutput || '(none specified)'}
                      </pre>
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                      <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Actual Output:</div>
                      <pre style={{
                        margin: 0,
                        padding: '0.4rem 0.6rem',
                        background: '#070a11',
                        borderRadius: 'var(--radius-sm)',
                        color: execResult.testResults[selectedTestIdx].passed ? '#34d399' : '#f87171',
                        fontSize: '0.8rem',
                        minHeight: '35px',
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}>
                        {execResult.testResults[selectedTestIdx].actualOutput || '(no stdout)'}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Custom Input */}
            {activeConsoleTab === 'input' && (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                  Standard Input (passed to cin / sys.stdin / Scanner):
                </div>
                <textarea
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="Enter custom input lines here..."
                  style={{
                    flex: 1,
                    background: '#070a11',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 'var(--radius-sm)',
                    color: '#e2e8f0',
                    padding: '0.5rem 0.75rem',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.85rem',
                    resize: 'none',
                    outline: 'none',
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
