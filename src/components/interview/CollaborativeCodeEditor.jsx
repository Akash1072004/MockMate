import React, { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
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
  Cpu,
  Maximize2,
  Minimize2,
  FileCode,
  Layers
} from 'lucide-react';

export default function CollaborativeCodeEditor({
  code,
  language,
  availableLanguages = null,
  syncStatus,
  onCodeChange,
  onLanguageChange,
  onResetTemplate,
  readOnly = false,
  interviewId = null,
  questionId = null,
  problemMetadata = null,
  testCases = [],
  onRunSuccess = null,
  isExpanded = false,
  onToggleExpand = null,
  onSubmit = null,
  isSubmitting = false,
}) {
  const editorRef = useRef(null);
  const monacoInstanceRef = useRef(null);
  const isLocalChangeRef = useRef(false);
  const isApplyingRemoteRef = useRef(false);
  const prevQuestionIdRef = useRef(questionId);

  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  // Bottom console is VISIBLE by default so candidate always has immediate access to output & compiler feedback
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [activeConsoleTab, setActiveConsoleTab] = useState('output'); // 'output' | 'errors' | 'tests' | 'input'
  const [customInput, setCustomInput] = useState('');
  const [execResult, setExecResult] = useState(null);
  const [selectedTestIdx, setSelectedTestIdx] = useState(0);

  // Vertical resizing state for Console Drawer & Monaco Editor
  // Clamp between 140px and 550px; sensible default is 220px
  const [consoleHeight, setConsoleHeight] = useState(() => {
    try {
      const saved = localStorage.getItem('mockmate_console_height');
      const num = Number(saved);
      return !isNaN(num) && num >= 140 && num <= 550 ? num : 220;
    } catch (_) {
      return 220;
    }
  });
  const [isResizingConsole, setIsResizingConsole] = useState(false);
  const resizeStartYRef = useRef(0);
  const resizeStartHRef = useRef(220);

  // Drag divider start
  const handleMouseDownConsoleResize = (e) => {
    e.preventDefault();
    setIsResizingConsole(true);
    resizeStartYRef.current = e.clientY;
    resizeStartHRef.current = consoleHeight;
  };

  useEffect(() => {
    if (!isResizingConsole) return;

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';

    const handleMouseMove = (e) => {
      // Dragging UP (negative delta clientY) -> console grows larger, editor shrinks
      // Dragging DOWN (positive delta clientY) -> console shrinks, editor grows
      const deltaY = resizeStartYRef.current - e.clientY;
      const newHeight = Math.max(140, Math.min(resizeStartHRef.current + deltaY, 550));
      setConsoleHeight(newHeight);
      try {
        localStorage.setItem('mockmate_console_height', String(newHeight));
      } catch (_) {}
      if (editorRef.current && typeof editorRef.current.layout === 'function') {
        editorRef.current.layout();
      }
    };

    const handleMouseUp = () => {
      setIsResizingConsole(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      if (editorRef.current && typeof editorRef.current.layout === 'function') {
        editorRef.current.layout();
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingConsole]);

  // Trigger Monaco layout whenever isExpanded changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (editorRef.current && typeof editorRef.current.layout === 'function') {
        editorRef.current.layout();
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [isExpanded]);

  // Window resize handler to trigger Monaco layout
  useEffect(() => {
    const handleWinResize = () => {
      if (editorRef.current && typeof editorRef.current.layout === 'function') {
        editorRef.current.layout();
      }
    };
    window.addEventListener('resize', handleWinResize);
    return () => window.removeEventListener('resize', handleWinResize);
  }, []);

  // Keep latest handleRun in ref for Monaco keybinding
  const handleRunRef = useRef(null);

  // Map internal language identifiers to official Monaco language IDs
  const getMonacoLanguage = (lang) => {
    switch (lang?.toLowerCase()) {
      case 'cpp':
      case 'c++':
        return 'cpp';
      case 'java':
        return 'java';
      case 'python':
      case 'py':
        return 'python';
      case 'javascript':
      case 'js':
        return 'javascript';
      default:
        return 'python';
    }
  };

  // Ensure Monaco editor model language updates when language prop changes
  useEffect(() => {
    if (!editorRef.current || !monacoInstanceRef.current) return;
    const model = editorRef.current.getModel();
    if (!model) return;

    const targetMonacoLang = getMonacoLanguage(language);
    try {
      monacoInstanceRef.current.editor.setModelLanguage(model, targetMonacoLang);
    } catch (e) {
      console.warn('[CollaborativeCodeEditor] Error setting model language:', e);
    }
  }, [language]);

  // Synchronize remote code updates to Monaco model smoothly without cursor jumping or model destruction
  useEffect(() => {
    if (!editorRef.current) return;
    const model = editorRef.current.getModel();
    if (!model) return;

    const currentEditorValue = model.getValue();
    if (code !== undefined && code !== null && currentEditorValue !== code && !isLocalChangeRef.current) {
      isApplyingRemoteRef.current = true;
      try {
        if (prevQuestionIdRef.current !== questionId) {
          prevQuestionIdRef.current = questionId;
          editorRef.current.setValue(code);
        } else {
          const prevSelection = editorRef.current.getSelection();
          editorRef.current.executeEdits('remote-sync', [{
            range: model.getFullModelRange(),
            text: code,
            forceMoveMarkers: true,
          }]);
          editorRef.current.pushUndoStop();
          if (prevSelection) {
            editorRef.current.setSelection(prevSelection);
          }
        }
      } finally {
        isApplyingRemoteRef.current = false;
      }
    } else if (prevQuestionIdRef.current !== questionId) {
      prevQuestionIdRef.current = questionId;
    }
  }, [code, questionId]);

  // Handle local user edits in Monaco
  const handleEditorChange = (value) => {
    // If change was initiated by our remote executeEdits, do not re-broadcast
    if (isApplyingRemoteRef.current) return;

    isLocalChangeRef.current = true;
    onCodeChange(value ?? '');
    queueMicrotask(() => {
      isLocalChangeRef.current = false;
    });
  };

  // Run Code execution handler
  const handleRun = async () => {
    if (isRunning) return;
    setIsRunning(true);

    // Automatically make console visible and ensure it is tall enough to easily view output
    setConsoleOpen(true);
    setConsoleHeight((prev) => Math.max(prev, 200));

    const codeToRun = editorRef.current ? editorRef.current.getValue() : code;

    try {
      const res = await runCode({
        language,
        code: codeToRun,
        testCases,
        customInput: customInput ? customInput : null,
        interviewId,
        questionId,
        problemMetadata,
      });

      setExecResult(res);

      // Automatic tab selection: CE and RE go to errors; WA and AC go to tests
      if (res.verdict === 'CE' || res.verdict === 'RE' || (res.error && res.verdict !== 'WA')) {
        setActiveConsoleTab('errors');
        setConsoleHeight((prev) => Math.max(prev, 220));
      } else if (res.testResults && res.testResults.length > 0) {
        setActiveConsoleTab('tests');
      } else {
        setActiveConsoleTab('output');
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
      setActiveConsoleTab('errors');
      setConsoleHeight((prev) => Math.max(prev, 220));
    } finally {
      setIsRunning(false);
      // Trigger Monaco relayout cleanly
      if (editorRef.current && typeof editorRef.current.layout === 'function') {
        editorRef.current.layout();
      }
    }
  };

  handleRunRef.current = handleRun;

  // Monaco Editor mount handler
  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoInstanceRef.current = monaco;

    if (code && editor.getValue() !== code) {
      editor.setValue(code);
    }

    // Attach Ctrl+Enter / Cmd+Enter shortcut directly to Monaco
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      if (handleRunRef.current) {
        handleRunRef.current();
      }
    });

    // Initial focus and layout
    editor.focus();
    setTimeout(() => {
      if (editorRef.current && typeof editorRef.current.layout === 'function') {
        editorRef.current.layout();
      }
    }, 100);
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
        return { label: 'Compilation Error', bg: 'rgba(239, 68, 68, 0.2)', border: '#ef4444', text: '#fca5a5', icon: <AlertCircle size={13} /> };
      case 'RE':
        return { label: 'Runtime Error', bg: 'rgba(239, 68, 68, 0.2)', border: '#ef4444', text: '#fca5a5', icon: <AlertCircle size={13} /> };
      default:
        return { label: verdict || 'Completed', bg: 'rgba(99, 102, 241, 0.15)', border: '#6366f1', text: '#818cf8', icon: <Cpu size={13} /> };
    }
  };

  const selectableLanguages = React.useMemo(() => {
    if (Array.isArray(availableLanguages) && availableLanguages.length > 0) {
      const normalized = availableLanguages.map((l) => {
        const lower = String(l).toLowerCase().trim();
        if (lower === 'c++') return 'cpp';
        if (lower === 'py') return 'python';
        if (lower === 'js') return 'javascript';
        return lower;
      });
      const filtered = LANGUAGE_OPTIONS.filter((opt) => normalized.includes(opt.id));
      return filtered.length > 0 ? filtered : LANGUAGE_OPTIONS;
    }
    return LANGUAGE_OPTIONS;
  }, [availableLanguages]);

  useEffect(() => {
    if (selectableLanguages.length > 0 && !selectableLanguages.some((l) => l.id === language)) {
      onLanguageChange(selectableLanguages[0].id);
    }
  }, [selectableLanguages, language, onLanguageChange]);

  const hasError = Boolean((execResult?.error && execResult?.verdict !== 'WA') || execResult?.verdict === 'CE' || execResult?.verdict === 'RE');

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: 0,
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
        gap: '0.5rem',
        flex: '0 0 auto',
      }}>
        {/* Left: Language Selection & Template Reset & Fullscreen Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="btn btn-outline btn-sm"
              style={{
                padding: '0.3rem 0.75rem',
                fontSize: '0.78rem',
                borderColor: isExpanded ? '#6366f1' : 'var(--border-subtle)',
                background: isExpanded ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                color: isExpanded ? '#a5b4fc' : '#e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
              }}
              title={isExpanded ? 'Exit fullscreen coding workspace' : 'Expand coding workspace to fullscreen'}
            >
              {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              <span>{isExpanded ? '← Exit Fullscreen' : '⛶ Expand Editor'}</span>
            </button>
          )}
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
            {selectableLanguages.map((lang) => (
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

        {/* Center/Right: Realtime Status & Action Buttons */}
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

          {/* Terminal Console Toggle Button */}
          <button
            onClick={() => {
              const nextState = !consoleOpen;
              setConsoleOpen(nextState);
              if (nextState) {
                setConsoleHeight((prev) => Math.max(prev, 180));
              }
              setTimeout(() => {
                if (editorRef.current && typeof editorRef.current.layout === 'function') {
                  editorRef.current.layout();
                }
              }, 50);
            }}
            className="btn btn-outline btn-sm"
            style={{
              padding: '0.3rem 0.65rem',
              fontSize: '0.75rem',
              borderColor: consoleOpen ? '#6366f1' : 'var(--border-subtle)',
              color: consoleOpen ? '#a5b4fc' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
            title={consoleOpen ? 'Collapse console panel' : 'Expand console panel'}
          >
            <Terminal size={13} />
            <span>Console</span>
            {hasError ? (
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#ef4444',
                  boxShadow: '0 0 6px #ef4444',
                }}
              />
            ) : execResult && (
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#10b981',
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
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.35rem 0.85rem',
              fontSize: '0.8rem',
              fontWeight: 600,
            }}
            title="Compile & run solution (Ctrl+Enter)"
          >
            {isRunning ? (
              <>
                <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play size={13} />
                <span>Run Code</span>
                <kbd style={{
                  fontSize: '0.65rem',
                  background: 'rgba(255,255,255,0.2)',
                  padding: '1px 4px',
                  borderRadius: '3px',
                  marginLeft: '0.2rem'
                }}>
                  Ctrl+↵
                </kbd>
              </>
            )}
          </button>

          {onSubmit && (
            <button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitting || isRunning || !code?.trim()}
              className="btn btn-success btn-sm"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.35rem 0.95rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                background: '#059669',
                borderColor: '#059669',
                color: '#ffffff',
                borderRadius: 'var(--radius-sm)',
              }}
              title="Submit code for review"
            >
              <CheckCircle2 size={14} />
              <span>{isSubmitting ? 'Submitting...' : 'Submit Code'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Monaco Editor Container with minHeight: 0 to prevent flex overflow */}
      <div style={{
        flex: 1,
        minHeight: 0,
        position: 'relative',
        overflow: 'hidden',
        pointerEvents: isResizingConsole ? 'none' : 'auto',
      }}>
        <Editor
          height="100%"
          language={getMonacoLanguage(language)}
          defaultValue={code}
          onChange={handleEditorChange}
          onMount={handleEditorMount}
          theme="vs-dark"
          options={{
            fontSize: 14,
            fontFamily: 'JetBrains Mono, Fira Code, Menlo, Monaco, Consolas, "Courier New", monospace',
            lineNumbers: 'on',
            roundedSelection: true,
            scrollBeyondLastLine: false,
            readOnly: readOnly,
            minimap: { enabled: false },
            automaticLayout: true,
            tabSize: 4,
            insertSpaces: true,
            autoClosingBrackets: 'always',
            autoClosingQuotes: 'always',
            formatOnPaste: true,
            folding: true,
            bracketPairColorization: { enabled: true },
            padding: { top: 12, bottom: 12 },
            renderLineHighlight: 'all',
            cursorBlinking: 'smooth',
            smoothScrolling: true,
          }}
          loading={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#818cf8', gap: '0.5rem' }}>
              <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
              <span>Loading Monaco Editor...</span>
            </div>
          }
        />
      </div>

      {/* Draggable Horizontal Divider between Monaco Editor and Console Drawer */}
      {consoleOpen && (
        <div
          onMouseDown={handleMouseDownConsoleResize}
          title="Drag up or down to resize Console & Monaco Editor"
          style={{
            flex: '0 0 8px',
            height: '8px',
            width: '100%',
            cursor: 'row-resize',
            background: isResizingConsole ? '#6366f1' : 'rgba(255, 255, 255, 0.08)',
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: 'none',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            borderBottom: '1px solid rgba(0, 0, 0, 0.4)',
            transition: isResizingConsole ? 'none' : 'background 0.2s',
          }}
        >
          <div style={{
            height: '2px',
            width: '48px',
            background: isResizingConsole ? '#a5b4fc' : 'rgba(255, 255, 255, 0.35)',
            borderRadius: '2px',
            pointerEvents: 'none',
          }} />
        </div>
      )}

      {/* Interactive Execution Console Drawer */}
      {consoleOpen && (
        <div style={{
          flex: `0 0 ${consoleHeight}px`,
          height: `${consoleHeight}px`,
          minHeight: '140px',
          maxHeight: '550px',
          background: '#0b0f19',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 10,
          boxShadow: '0 -4px 16px rgba(0,0,0,0.4)',
          overflow: 'hidden',
          userSelect: isResizingConsole ? 'none' : 'auto',
        }}>
          {/* Console Header Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.4rem 1rem',
            background: '#111726',
            borderBottom: '1px solid var(--border-subtle)',
            flex: '0 0 auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {/* Tab Switchers */}
              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                {/* Output Tab */}
                <button
                  type="button"
                  onClick={() => setActiveConsoleTab('output')}
                  style={{
                    padding: '0.25rem 0.65rem',
                    fontSize: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    background: activeConsoleTab === 'output' ? '#1f293d' : 'transparent',
                    color: activeConsoleTab === 'output' ? '#f9fafb' : '#94a3b8',
                    border: activeConsoleTab === 'output' ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid transparent',
                    cursor: 'pointer',
                    fontWeight: activeConsoleTab === 'output' ? 600 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <Terminal size={12} />
                  <span>Output</span>
                </button>

                {/* Errors Tab with Badge */}
                <button
                  type="button"
                  onClick={() => setActiveConsoleTab('errors')}
                  style={{
                    padding: '0.25rem 0.65rem',
                    fontSize: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    background: activeConsoleTab === 'errors' ? '#27171d' : 'transparent',
                    color: activeConsoleTab === 'errors' ? '#fca5a5' : hasError ? '#f87171' : '#94a3b8',
                    border: activeConsoleTab === 'errors' ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid transparent',
                    cursor: 'pointer',
                    fontWeight: activeConsoleTab === 'errors' ? 600 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <AlertCircle size={12} color={hasError ? '#ef4444' : '#94a3b8'} />
                  <span>Errors</span>
                  {hasError && (
                    <span style={{
                      fontSize: '0.68rem',
                      padding: '1px 5px',
                      borderRadius: 10,
                      background: 'rgba(239, 68, 68, 0.25)',
                      color: '#f87171',
                      fontWeight: 700,
                    }}>
                      {execResult.verdict === 'CE' ? 'CE' : '1'}
                    </span>
                  )}
                </button>

                {/* Test Cases Tab */}
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
                      border: activeConsoleTab === 'tests' ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid transparent',
                      cursor: 'pointer',
                      fontWeight: activeConsoleTab === 'tests' ? 600 : 400,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    <CheckCircle2 size={12} color={execResult.passedCount === execResult.totalCount ? '#34d399' : '#f87171'} />
                    <span>Test Cases</span>
                    <span style={{
                      fontSize: '0.68rem',
                      padding: '1px 5px',
                      borderRadius: 10,
                      background: execResult.passedCount === execResult.totalCount ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: execResult.passedCount === execResult.totalCount ? '#34d399' : '#f87171',
                      fontWeight: 700,
                    }}>
                      {execResult.passedCount}/{execResult.totalCount}
                    </span>
                  </button>
                )}

                {/* Custom Stdin Tab */}
                <button
                  type="button"
                  onClick={() => setActiveConsoleTab('input')}
                  style={{
                    padding: '0.25rem 0.65rem',
                    fontSize: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    background: activeConsoleTab === 'input' ? '#1f293d' : 'transparent',
                    color: activeConsoleTab === 'input' ? '#f9fafb' : '#94a3b8',
                    border: activeConsoleTab === 'input' ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid transparent',
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

            {/* Quick Size Toggle & Collapse Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <button
                type="button"
                onClick={() => {
                  const targetH = consoleHeight > 260 ? 180 : 380;
                  setConsoleHeight(targetH);
                  try {
                    localStorage.setItem('mockmate_console_height', String(targetH));
                  } catch (_) {}
                  setTimeout(() => {
                    if (editorRef.current && typeof editorRef.current.layout === 'function') {
                      editorRef.current.layout();
                    }
                  }, 50);
                }}
                className="btn btn-outline btn-sm"
                style={{ padding: '0.2rem 0.4rem', border: 'none', color: '#94a3b8' }}
                title={consoleHeight > 260 ? "Reduce console height" : "Expand console height"}
              >
                {consoleHeight > 260 ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConsoleOpen(false);
                  setTimeout(() => {
                    if (editorRef.current && typeof editorRef.current.layout === 'function') {
                      editorRef.current.layout();
                    }
                  }, 50);
                }}
                className="btn btn-outline btn-sm"
                style={{ padding: '0.2rem 0.4rem', border: 'none', color: '#94a3b8' }}
                title="Collapse console"
              >
                <ChevronDown size={14} />
              </button>
            </div>
          </div>

          {/* Console Content Body */}
          <div style={{
            flex: 1,
            minHeight: 0,
            padding: '0.75rem 1rem',
            overflowY: 'auto',
            overflowX: 'hidden',
            fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
            fontSize: '0.85rem'
          }}>
            {/* Tab: Errors */}
            {activeConsoleTab === 'errors' && (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                {isRunning ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#818cf8', padding: '1rem 0' }}>
                    <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Compiling code and checking for diagnostics...</span>
                  </div>
                ) : hasError ? (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.5rem',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#f87171', fontWeight: 700, fontSize: '0.875rem' }}>
                        <AlertCircle size={15} />
                        <span>{execResult.verdict === 'CE' ? 'Compilation Error' : 'Runtime / Diagnostic Error'}</span>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        Compiler messages & diagnostic details below:
                      </span>
                    </div>

                    <pre style={{
                      margin: 0,
                      flex: 1,
                      minHeight: '80px',
                      background: '#070a12',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.75rem 1rem',
                      color: '#fecaca',
                      fontSize: '0.82rem',
                      lineHeight: 1.55,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      overflowY: 'auto',
                      overflowX: 'auto',
                      fontFamily: 'JetBrains Mono, Fira Code, Menlo, Monaco, Consolas, monospace',
                    }}>
                      {execResult.error || 'Diagnostic reported without message text.'}
                    </pre>
                  </div>
                ) : execResult && !hasError ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: '#34d399',
                    padding: '0.75rem 1rem',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    borderRadius: 'var(--radius-sm)',
                  }}>
                    <CheckCircle2 size={16} />
                    <span>No compilation or runtime errors. Code built and ran successfully!</span>
                  </div>
                ) : (
                  <div style={{ color: '#64748b', fontStyle: 'italic', padding: '0.75rem 0' }}>
                    No compilation errors recorded. Click "Run Code" or press Ctrl+Enter to test your solution.
                  </div>
                )}
              </div>
            )}

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
                    {hasError && (
                      <div style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        color: '#f87171',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.75rem',
                        marginBottom: '0.75rem',
                      }}>
                        <div style={{ fontWeight: 600, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <AlertCircle size={14} />
                            <span>{execResult.verdict === 'CE' ? 'Compilation Error' : 'Diagnostic Error'}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveConsoleTab('errors')}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#60a5fa',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              textDecoration: 'underline',
                            }}
                          >
                            View in Errors Tab &rarr;
                          </button>
                        </div>
                        <pre style={{
                          margin: 0,
                          fontSize: '0.8rem',
                          color: '#fecaca',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          fontFamily: 'inherit',
                          maxHeight: '120px',
                          overflowY: 'auto'
                        }}>
                          {execResult.error}
                        </pre>
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
                          maxHeight: '220px',
                          overflowY: 'auto',
                        }}>
                          {execResult.output}
                        </pre>
                      </div>
                    )}

                    {!execResult.output && !hasError && (
                      <div style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <CheckCircle2 size={14} />
                        <span>Program completed with exit code 0 (no output written to stdout).</span>
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
                      <span>{t.isHidden ? `Hidden Case ${idx + 1}` : `Case ${idx + 1}`}</span>
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
                        overflowX: 'auto',
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
                        overflowX: 'auto',
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
                        overflowX: 'auto',
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
                  Custom Standard Input (stdin) for execution:
                </div>
                <textarea
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="Enter custom inputs (one per line if needed)..."
                  style={{
                    flex: 1,
                    minHeight: '70px',
                    background: '#070a11',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.5rem 0.75rem',
                    color: '#e2e8f0',
                    fontFamily: 'inherit',
                    fontSize: '0.8rem',
                    resize: 'none',
                    outline: 'none',
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reopen Bar when Console is Collapsed */}
      {!consoleOpen && (
        <div style={{
          padding: '0.45rem 1rem',
          background: '#0a0e19',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          zIndex: 15,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
            <Terminal size={14} color="#38bdf8" />
            <span style={{ fontWeight: 500 }}>Console Collapsed</span>
            {execResult?.verdict && (
              <span className={`badge ${execResult.verdict === 'Accepted' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.65rem' }}>
                {execResult.verdict}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setConsoleOpen(true);
              setTimeout(() => {
                if (editorRef.current && typeof editorRef.current.layout === 'function') {
                  editorRef.current.layout();
                }
              }, 50);
            }}
            className="btn btn-outline btn-xs"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              color: '#38bdf8',
              borderColor: 'rgba(56, 189, 248, 0.4)',
              background: 'rgba(56, 189, 248, 0.06)'
            }}
            title="Open Console"
          >
            <ChevronUp size={13} />
            <span>Open Console</span>
          </button>
        </div>
      )}
    </div>
  );
}
