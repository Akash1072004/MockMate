import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Code2, 
  HelpCircle, 
  FileText, 
  ShieldCheck, 
  EyeOff, 
  Layers 
} from 'lucide-react';
import { createQuestion } from '../../services/questionService';
import { useAuth } from '../../context/AuthContext';

export default function CreateQuestionModal({ isOpen, onClose, onQuestionCreated }) {
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  const [topic, setTopic] = useState('Algorithms');
  const [description, setDescription] = useState('');
  const [inputDescription, setInputDescription] = useState('');
  const [outputDescription, setOutputDescription] = useState('');
  const [constraints, setConstraints] = useState('');

  // Examples: [{ input: '', output: '', explanation: '' }]
  const [examples, setExamples] = useState([
    { input: '', output: '', explanation: '' },
  ]);

  // Starter codes for 3 languages
  const [activeLangTab, setActiveLangTab] = useState('python');
  const [starterPython, setStarterPython] = useState('import sys\n\ndef solution():\n    # Write your solution here\n    pass\n\nif __name__ == "__main__":\n    solution()\n');
  const [starterCpp, setStarterCpp] = useState('#include <iostream>\n\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n');
  const [starterJava, setStarterJava] = useState('import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        // Write your solution here\n    }\n}\n');

  // Test cases: [{ input: '', expectedOutput: '' }]
  const [testCases, setTestCases] = useState([
    { input: '', expectedOutput: '' },
  ]);

  // Hidden test cases: [{ input: '', expectedOutput: '' }]
  const [hiddenTestCases, setHiddenTestCases] = useState([
    { input: '', expectedOutput: '' },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeFormTab, setActiveFormTab] = useState('basic'); // 'basic' | 'examples' | 'code' | 'tests'

  if (!isOpen) return null;

  const handleAddExample = () => {
    setExamples([...examples, { input: '', output: '', explanation: '' }]);
  };

  const handleRemoveExample = (idx) => {
    setExamples(examples.filter((_, i) => i !== idx));
  };

  const handleExampleChange = (idx, field, value) => {
    const updated = [...examples];
    updated[idx][field] = value;
    setExamples(updated);
  };

  const handleAddTestCase = (isHidden = false) => {
    if (isHidden) {
      setHiddenTestCases([...hiddenTestCases, { input: '', expectedOutput: '' }]);
    } else {
      setTestCases([...testCases, { input: '', expectedOutput: '' }]);
    }
  };

  const handleRemoveTestCase = (idx, isHidden = false) => {
    if (isHidden) {
      setHiddenTestCases(hiddenTestCases.filter((_, i) => i !== idx));
    } else {
      setTestCases(testCases.filter((_, i) => i !== idx));
    }
  };

  const handleTestCaseChange = (idx, field, value, isHidden = false) => {
    if (isHidden) {
      const updated = [...hiddenTestCases];
      updated[idx][field] = value;
      setHiddenTestCases(updated);
    } else {
      const updated = [...testCases];
      updated[idx][field] = value;
      setTestCases(updated);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Problem Title is required.');
      setActiveFormTab('basic');
      return;
    }

    if (!description.trim()) {
      setError('Problem Description is required.');
      setActiveFormTab('basic');
      return;
    }

    // Filter valid test cases
    const validPublicTests = testCases.filter(tc => tc.input.trim() !== '' || tc.expectedOutput.trim() !== '');
    const validHiddenTests = hiddenTestCases.filter(tc => tc.input.trim() !== '' || tc.expectedOutput.trim() !== '');

    if (validPublicTests.length === 0) {
      setError('At least one public test case is required.');
      setActiveFormTab('tests');
      return;
    }

    setLoading(true);
    try {
      const questionData = {
        title: title.trim(),
        difficulty,
        topic: topic.trim(),
        description: description.trim(),
        inputDescription: inputDescription.trim(),
        outputDescription: outputDescription.trim(),
        constraints: constraints.trim(),
        examples: examples.filter(ex => ex.input.trim() || ex.output.trim()),
        starterCode: {
          python: starterPython,
          cpp: starterCpp,
          java: starterJava,
        },
        supportedLanguages: ['python', 'cpp', 'java'],
        testCases: validPublicTests,
        hiddenTestCases: validHiddenTests,
        userId: user?.id,
      };

      const created = await createQuestion(questionData);
      if (onQuestionCreated) {
        onQuestionCreated(created);
      }
      onClose();
    } catch (err) {
      console.error('[CreateQuestionModal] Error:', err);
      setError(err.message || 'Failed to save question to Supabase.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1050,
      padding: '1.5rem',
    }}>
      <div style={{
        background: '#111827',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        width: '100%',
        maxWidth: '840px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden',
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#0e1422'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#818cf8',
            }}>
              <Code2 size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Create Coding Question</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Author a new algorithmic problem for live mock interviews
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-outline btn-sm"
            style={{ padding: '0.35rem', borderRadius: '50%' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-subtle)',
          background: '#131b2e',
          padding: '0 1.5rem',
          gap: '1rem',
          overflowX: 'auto',
        }}>
          <button
            type="button"
            onClick={() => setActiveFormTab('basic')}
            className="nav-link"
            style={{
              padding: '0.75rem 0.5rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              borderBottom: activeFormTab === 'basic' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeFormTab === 'basic' ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            1. Problem Details
          </button>
          <button
            type="button"
            onClick={() => setActiveFormTab('examples')}
            className="nav-link"
            style={{
              padding: '0.75rem 0.5rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              borderBottom: activeFormTab === 'examples' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeFormTab === 'examples' ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            2. Examples ({examples.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFormTab('code')}
            className="nav-link"
            style={{
              padding: '0.75rem 0.5rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              borderBottom: activeFormTab === 'code' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeFormTab === 'code' ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            3. Starter Code
          </button>
          <button
            type="button"
            onClick={() => setActiveFormTab('tests')}
            className="nav-link"
            style={{
              padding: '0.75rem 0.5rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              borderBottom: activeFormTab === 'tests' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeFormTab === 'tests' ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            4. Test Cases ({testCases.length} + {hiddenTestCases.length} Hidden)
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
            {error && (
              <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* TAB 1: BASIC DETAILS */}
            {activeFormTab === 'basic' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="probTitle">Problem Title *</label>
                  <input
                    id="probTitle"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Merge K Sorted Lists"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor="probDifficulty">Difficulty Level</label>
                    <select
                      id="probDifficulty"
                      className="form-select"
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor="probTopic">Topic / Category</label>
                    <input
                      id="probTopic"
                      type="text"
                      className="form-input"
                      placeholder="e.g. Dynamic Programming, Trees, Arrays"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="probDesc">Problem Description *</label>
                  <textarea
                    id="probDesc"
                    className="form-textarea"
                    rows={4}
                    placeholder="Provide a clear, detailed explanation of the problem statement and requirements..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor="probInputFmt">Input Format</label>
                    <textarea
                      id="probInputFmt"
                      className="form-textarea"
                      rows={2}
                      placeholder="e.g. First line contains integer N, second line contains N integers..."
                      value={inputDescription}
                      onChange={(e) => setInputDescription(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor="probOutputFmt">Output Format</label>
                    <textarea
                      id="probOutputFmt"
                      className="form-textarea"
                      rows={2}
                      placeholder="e.g. Print the maximum sum as a single integer..."
                      value={outputDescription}
                      onChange={(e) => setOutputDescription(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="probConstraints">Constraints</label>
                  <textarea
                    id="probConstraints"
                    className="form-textarea"
                    rows={2}
                    placeholder="e.g. 1 <= nums.length <= 10^5&#10;-10^4 <= nums[i] <= 10^4"
                    value={constraints}
                    onChange={(e) => setConstraints(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* TAB 2: EXAMPLES */}
            {activeFormTab === 'examples' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Provide realistic examples showing input, expected output, and explanation.
                  </p>
                  <button
                    type="button"
                    onClick={handleAddExample}
                    className="btn btn-outline btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Plus size={14} />
                    <span>Add Example</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {examples.map((ex, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: '#0b101b',
                        borderRadius: 'var(--radius-md)',
                        padding: '1.25rem',
                        border: '1px solid var(--border-subtle)',
                        position: 'relative',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#a5b4fc' }}>
                          Example #{idx + 1}
                        </span>
                        {examples.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveExample(idx)}
                            className="btn btn-outline btn-sm"
                            style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)', padding: '0.2rem 0.5rem' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <div>
                          <label className="form-label" style={{ fontSize: '0.75rem' }}>Input</label>
                          <textarea
                            className="form-textarea"
                            rows={2}
                            placeholder="e.g. 2 7 11 15\n9"
                            value={ex.input}
                            onChange={(e) => handleExampleChange(idx, 'input', e.target.value)}
                            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                          />
                        </div>

                        <div>
                          <label className="form-label" style={{ fontSize: '0.75rem' }}>Output</label>
                          <textarea
                            className="form-textarea"
                            rows={2}
                            placeholder="e.g. 0 1"
                            value={ex.output}
                            onChange={(e) => handleExampleChange(idx, 'output', e.target.value)}
                            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Explanation (Optional)</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. nums[0] + nums[1] == 9, so return [0, 1]."
                          value={ex.explanation}
                          onChange={(e) => handleExampleChange(idx, 'explanation', e.target.value)}
                          style={{ fontSize: '0.85rem' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: STARTER CODE */}
            {activeFormTab === 'code' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Provide initial boilerplate starter templates for candidates in each supported language.
                  </p>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    {['python', 'cpp', 'java'].map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setActiveLangTab(lang)}
                        className={`btn btn-sm ${activeLangTab === lang ? 'btn-primary' : 'btn-outline'}`}
                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', textTransform: 'uppercase' }}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ background: '#090d16', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                  <textarea
                    rows={12}
                    value={activeLangTab === 'python' ? starterPython : activeLangTab === 'cpp' ? starterCpp : starterJava}
                    onChange={(e) => {
                      if (activeLangTab === 'python') setStarterPython(e.target.value);
                      else if (activeLangTab === 'cpp') setStarterCpp(e.target.value);
                      else setStarterJava(e.target.value);
                    }}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      color: '#f8fafc',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.875rem',
                      lineHeight: '1.5',
                      outline: 'none',
                      resize: 'none',
                    }}
                  />
                </div>
              </div>
            )}

            {/* TAB 4: TEST CASES & HIDDEN TEST CASES */}
            {activeFormTab === 'tests' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                {/* Public Test Cases */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div>
                      <h4 style={{ fontSize: '1rem', color: '#f8fafc', margin: 0 }}>Public Test Cases</h4>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Visible to candidate in the IDE console test results tab.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddTestCase(false)}
                      className="btn btn-outline btn-sm"
                    >
                      <Plus size={14} />
                      <span>Add Public Test</span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {testCases.map((tc, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: '#0b101b',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          padding: '1rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#38bdf8' }}>
                            Public Test #{idx + 1}
                          </span>
                          {testCases.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveTestCase(idx, false)}
                              className="btn btn-outline btn-sm"
                              style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)', padding: '0.2rem 0.45rem' }}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                          <div>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Standard Input (stdin)</label>
                            <textarea
                              rows={2}
                              className="form-textarea"
                              placeholder="e.g. 2 7 11 15\n9"
                              value={tc.input}
                              onChange={(e) => handleTestCaseChange(idx, 'input', e.target.value, false)}
                              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                            />
                          </div>
                          <div>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Expected Output (stdout)</label>
                            <textarea
                              rows={2}
                              className="form-textarea"
                              placeholder="e.g. 0 1"
                              value={tc.expectedOutput}
                              onChange={(e) => handleTestCaseChange(idx, 'expectedOutput', e.target.value, false)}
                              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hidden Test Cases (Protected) */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <EyeOff size={16} color="#f59e0b" />
                        <h4 style={{ fontSize: '1rem', color: '#f8fafc', margin: 0 }}>Hidden Test Cases (Isolated)</h4>
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Executed on the backend during run, but input/expected output are strictly hidden from candidates.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddTestCase(true)}
                      className="btn btn-outline btn-sm"
                    >
                      <Plus size={14} />
                      <span>Add Hidden Test</span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {hiddenTestCases.map((tc, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: 'rgba(245, 158, 11, 0.04)',
                          border: '1px solid rgba(245, 158, 11, 0.25)',
                          borderRadius: 'var(--radius-md)',
                          padding: '1rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fbbf24' }}>
                            Hidden Test #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTestCase(idx, true)}
                            className="btn btn-outline btn-sm"
                            style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)', padding: '0.2rem 0.45rem' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                          <div>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Hidden Input (stdin)</label>
                            <textarea
                              rows={2}
                              className="form-textarea"
                              placeholder="e.g. 1 5 3 7 9\n12"
                              value={tc.input}
                              onChange={(e) => handleTestCaseChange(idx, 'input', e.target.value, true)}
                              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                            />
                          </div>
                          <div>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Hidden Expected Output</label>
                            <textarea
                              rows={2}
                              className="form-textarea"
                              placeholder="e.g. 1 3"
                              value={tc.expectedOutput}
                              onChange={(e) => handleTestCaseChange(idx, 'expectedOutput', e.target.value, true)}
                              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-subtle)',
            background: '#0e1422',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-outline btn-sm"
              disabled={loading}
            >
              Cancel
            </button>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {activeFormTab !== 'tests' && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeFormTab === 'basic') setActiveFormTab('examples');
                    else if (activeFormTab === 'examples') setActiveFormTab('code');
                    else if (activeFormTab === 'code') setActiveFormTab('tests');
                  }}
                  className="btn btn-secondary btn-sm"
                >
                  Next Step
                </button>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={loading}
              >
                <CheckCircle2 size={16} />
                <span>{loading ? 'Saving to Database...' : 'Save Question to Bank'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
