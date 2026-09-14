import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createQuestion, updateQuestion, getQuestionById } from '../services/questionService';
import {
  Code2,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  BookOpen,
  EyeOff,
  ShieldCheck,
  FileText,
  Layers,
  Save,
  Check
} from 'lucide-react';

const DIFFICULTY_OPTIONS = ['Easy', 'Medium', 'Hard'];
const TOPIC_OPTIONS = [
  'Arrays & Hashing',
  'Two Pointers',
  'Sliding Window',
  'Stack',
  'Binary Search',
  'Linked List',
  'Trees & Graphs',
  'Dynamic Programming',
  'Greedy',
  'Backtracking',
  'Bit Manipulation',
  'Math & Geometry'
];

export default function CreateQuestionPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id: editQuestionId } = useParams();
  const isEditMode = Boolean(editQuestionId);

  // Basic Information
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  const [topic, setTopic] = useState('Arrays & Hashing');
  const [description, setDescription] = useState('');
  const [inputDescription, setInputDescription] = useState('');
  const [outputDescription, setOutputDescription] = useState('');
  const [constraints, setConstraints] = useState('');

  // Examples: [{ input: '', output: '', explanation: '' }]
  const [examples, setExamples] = useState([
    { input: '', output: '', explanation: '' },
  ]);

  // Supported languages & Starter codes
  const [supportedLangs, setSupportedLangs] = useState(['python', 'cpp', 'java']);
  const [activeLangTab, setActiveLangTab] = useState('python');
  const [starterPython, setStarterPython] = useState(
    'import sys\n\ndef solution():\n    # Write your solution here\n    pass\n\nif __name__ == "__main__":\n    solution()\n'
  );
  const [starterCpp, setStarterCpp] = useState(
    '#include <iostream>\n\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n'
  );
  const [starterJava, setStarterJava] = useState(
    'import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        // Write your solution here\n    }\n}\n'
  );
  const [starterJavascript, setStarterJavascript] = useState(
    '// JavaScript (Node.js) Solution\nfunction solution() {\n    // Write your solution here\n}\n\nsolution();\n'
  );

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
  const [success, setSuccess] = useState(false);
  const [createdQuestionId, setCreatedQuestionId] = useState(null);

  // Form Section Tab Navigation
  const [activeTab, setActiveTab] = useState('basic'); // 'basic' | 'examples' | 'code' | 'tests'

  const handleToggleLang = (langId) => {
    if (supportedLangs.includes(langId)) {
      if (supportedLangs.length === 1) {
        alert('A question must support at least one programming language.');
        return;
      }
      const updated = supportedLangs.filter((l) => l !== langId);
      setSupportedLangs(updated);
      if (activeLangTab === langId) {
        setActiveLangTab(updated[0]);
      }
    } else {
      const updated = [...supportedLangs, langId];
      setSupportedLangs(updated);
      setActiveLangTab(langId);
    }
  };

  // Pre-fill fields if in edit mode
  useEffect(() => {
    if (!editQuestionId) return;
    async function loadQuestionForEdit() {
      setLoading(true);
      try {
        const q = await getQuestionById(editQuestionId);
        if (q) {
          setTitle(q.title || '');
          setDifficulty(q.difficulty || 'Medium');
          setTopic(q.topic || 'Arrays & Hashing');
          setDescription(q.description || '');
          setInputDescription(q.input_description || '');
          setOutputDescription(q.output_description || '');
          setConstraints(q.constraints || '');
          if (Array.isArray(q.examples) && q.examples.length > 0) {
            setExamples(q.examples);
          }
          if (Array.isArray(q.supported_languages) && q.supported_languages.length > 0) {
            setSupportedLangs(q.supported_languages);
            setActiveLangTab(q.supported_languages[0]);
          } else if (q.starter_code && typeof q.starter_code === 'object') {
            const keys = Object.keys(q.starter_code);
            if (keys.length > 0) {
              setSupportedLangs(keys);
              setActiveLangTab(keys[0]);
            }
          }
          if (q.starter_code) {
            if (q.starter_code.python) setStarterPython(q.starter_code.python);
            if (q.starter_code.cpp) setStarterCpp(q.starter_code.cpp);
            if (q.starter_code.java) setStarterJava(q.starter_code.java);
            if (q.starter_code.javascript) setStarterJavascript(q.starter_code.javascript);
          }
          if (Array.isArray(q.test_cases) && q.test_cases.length > 0) {
            setTestCases(q.test_cases);
          }
        }
      } catch (err) {
        console.error('[CreateQuestionPage] Failed to load question for edit:', err);
        setError('Failed to load question details.');
      } finally {
        setLoading(false);
      }
    }
    loadQuestionForEdit();
  }, [editQuestionId]);

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

  const validateForm = () => {
    if (!title.trim()) {
      setActiveTab('basic');
      throw new Error('Problem title is required.');
    }
    if (!description.trim()) {
      setActiveTab('basic');
      throw new Error('Problem description is required.');
    }
    const validExamples = examples.filter((ex) => ex.input.trim() || ex.output.trim());
    if (validExamples.length === 0) {
      setActiveTab('examples');
      throw new Error('Please provide at least one example test case.');
    }
    const validTests = testCases.filter((tc) => tc.input.trim() || tc.expectedOutput.trim());
    if (validTests.length === 0) {
      setActiveTab('tests');
      throw new Error('Please provide at least one public evaluation test case.');
    }
    return { validExamples, validTests };
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');

    try {
      const { validExamples, validTests } = validateForm();
      const validHiddenTests = hiddenTestCases.filter((tc) => tc.input.trim() || tc.expectedOutput.trim());

      setLoading(true);

      const starterCode = {};
      if (supportedLangs.includes('python')) starterCode.python = starterPython;
      if (supportedLangs.includes('cpp')) starterCode.cpp = starterCpp;
      if (supportedLangs.includes('java')) starterCode.java = starterJava;
      if (supportedLangs.includes('javascript')) starterCode.javascript = starterJavascript;

      const payload = {
        title: title.trim(),
        difficulty,
        topic: topic.trim(),
        description: description.trim(),
        inputDescription: inputDescription.trim(),
        outputDescription: outputDescription.trim(),
        constraints: constraints.trim(),
        examples: validExamples,
        starterCode,
        supportedLanguages: supportedLangs,
        testCases: validTests,
        hiddenTestCases: validHiddenTests,
        userId: user?.id,
      };

      let result;
      if (isEditMode) {
        result = await updateQuestion(editQuestionId, payload);
      } else {
        result = await createQuestion(payload);
      }
      setSuccess(true);
      setCreatedQuestionId(result?.id || editQuestionId || null);
    } catch (err) {
      console.error('[CreateQuestionPage] Error saving question:', err);
      setError(err.message || 'Failed to save question.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="container" style={{ padding: '4rem 1.5rem', maxWidth: '680px' }}>
        <div className="card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid #10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem auto',
          }}>
            <Check size={32} color="#10b981" />
          </div>

          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: '#f9fafb' }}>
            {isEditMode ? 'Question Updated Successfully!' : 'Question Created Successfully!'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: '1.6' }}>
            "{title}" has been saved to your active Question Bank. It is now ready to be assigned to upcoming peer interview sessions.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <Link to="/interviewer/dashboard" className="btn btn-primary">
              Return to Dashboard
            </Link>
            {!isEditMode && (
              <button
                onClick={() => {
                  setTitle('');
                  setDescription('');
                  setInputDescription('');
                  setOutputDescription('');
                  setConstraints('');
                  setSuccess(false);
                  setActiveTab('basic');
                }}
                className="btn btn-outline"
              >
                Create Another Question
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem 5rem 1.5rem', maxWidth: '960px' }}>
      {/* Top Breadcrumb & Cancel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <Link
          to="/interviewer/dashboard"
          className="btn btn-outline btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </Link>

        <span className="badge badge-success">
          Interviewer Workspace
        </span>
      </div>

      {/* Main Form Card */}
      <div className="card" style={{ padding: '2.5rem 2rem' }}>
        <div style={{ marginBottom: '2rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#818cf8',
            }}>
              <Code2 size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.75rem', margin: 0, color: '#f9fafb' }}>
                {isEditMode ? 'Edit Coding Problem' : 'Create Coding Question'}
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0.2rem 0 0 0' }}>
                Add a new LeetCode-style algorithmic problem with starter templates and hidden evaluation tests.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Multi-step Form Navigation Tabs */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '2rem',
          overflowX: 'auto',
          paddingBottom: '0.5rem',
        }}>
          {[
            { id: 'basic', label: '1. Problem Overview', icon: <FileText size={16} /> },
            { id: 'examples', label: '2. Examples & Constraints', icon: <Layers size={16} /> },
            { id: 'code', label: '3. Starter Boilerplate', icon: <Code2 size={16} /> },
            { id: 'tests', label: '4. Evaluation Test Cases', icon: <ShieldCheck size={16} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.6rem 1rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: 600,
                border: 'none',
                background: activeTab === tab.id ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                color: activeTab === tab.id ? '#818cf8' : 'var(--text-secondary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'var(--transition)',
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {/* TAB 1: BASIC INFO */}
          {activeTab === 'basic' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="title">Problem Title *</label>
                <input
                  id="title"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Invert Binary Tree"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="difficulty">Difficulty Level</label>
                  <select
                    id="difficulty"
                    className="form-select"
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                  >
                    {DIFFICULTY_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="topic">Topic / Category</label>
                  <select
                    id="topic"
                    className="form-select"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                  >
                    {TOPIC_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="description">Problem Statement & Description *</label>
                <textarea
                  id="description"
                  className="form-input"
                  rows={6}
                  placeholder="Clearly explain the problem, requirements, edge cases, and expected algorithm complexity..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('examples')}
                  className="btn btn-primary"
                >
                  Next: Examples & Constraints →
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: EXAMPLES & CONSTRAINTS */}
          {activeTab === 'examples' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label">Input Format Description</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. First line contains integer N..."
                    value={inputDescription}
                    onChange={(e) => setInputDescription(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Output Format Description</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Return space-separated indices..."
                    value={outputDescription}
                    onChange={(e) => setOutputDescription(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Constraints</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="e.g. 1 <= nums.length <= 10^5&#10;-10^9 <= nums[i] <= 10^9"
                  value={constraints}
                  onChange={(e) => setConstraints(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Examples List */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>Examples Shown in Problem Description</label>
                  <button
                    type="button"
                    onClick={handleAddExample}
                    className="btn btn-outline btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Plus size={14} />
                    <span>Add Example</span>
                  </button>
                </div>

                {examples.map((ex, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#090d16',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1.25rem',
                      marginBottom: '1rem',
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#818cf8' }}>
                        Example {idx + 1}
                      </span>
                      {examples.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveExample(idx)}
                          style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Input</label>
                        <textarea
                          rows={2}
                          className="form-input"
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                          value={ex.input}
                          onChange={(e) => handleExampleChange(idx, 'input', e.target.value)}
                          placeholder="e.g. 2 7 11 15\n9"
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Output</label>
                        <textarea
                          rows={2}
                          className="form-input"
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                          value={ex.output}
                          onChange={(e) => handleExampleChange(idx, 'output', e.target.value)}
                          placeholder="e.g. 0 1"
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Explanation (Optional)</label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ fontSize: '0.85rem' }}
                        value={ex.explanation}
                        onChange={(e) => handleExampleChange(idx, 'explanation', e.target.value)}
                        placeholder="e.g. nums[0] + nums[1] == 9, so we return [0, 1]."
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('basic')}
                  className="btn btn-outline"
                >
                  ← Back to Overview
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('code')}
                  className="btn btn-primary"
                >
                  Next: Starter Code →
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: STARTER CODE BOILERPLATES */}
          {activeTab === 'code' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Language Selection Checkboxes */}
              <div style={{
                background: '#090d16',
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f9fafb', marginBottom: '0.35rem' }}>
                  Supported Programming Languages
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 1rem 0' }}>
                  Enable languages supported for this problem. Only checked languages will be selectable in the interview IDE with their configured starter code.
                </p>

                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                  {[
                    { id: 'python', label: 'Python 3' },
                    { id: 'cpp', label: 'C++' },
                    { id: 'java', label: 'Java' },
                    { id: 'javascript', label: 'JavaScript' },
                  ].map((lang) => (
                    <label
                      key={lang.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        background: supportedLangs.includes(lang.id) ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255,255,255,0.02)',
                        padding: '0.45rem 0.85rem',
                        borderRadius: 'var(--radius-sm)',
                        border: supportedLangs.includes(lang.id) ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid var(--border-subtle)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={supportedLangs.includes(lang.id)}
                        onChange={() => handleToggleLang(lang.id)}
                        style={{ width: 16, height: 16, accentColor: '#6366f1' }}
                      />
                      <span style={{ fontWeight: supportedLangs.includes(lang.id) ? 700 : 500, color: supportedLangs.includes(lang.id) ? '#a5b4fc' : 'var(--text-secondary)' }}>
                        {lang.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h4 style={{ fontSize: '1.05rem', margin: 0, color: '#f9fafb' }}>Starter Boilerplate Template</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>
                    Configure the exact initial code the candidate will see when selecting {activeLangTab}.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {supportedLangs.map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setActiveLangTab(lang)}
                      className={`btn btn-sm ${activeLangTab === lang ? 'btn-primary' : 'btn-outline'}`}
                      style={{ textTransform: 'capitalize' }}
                    >
                      {lang === 'cpp' ? 'C++' : lang === 'javascript' ? 'JavaScript' : lang}
                    </button>
                  ))}
                </div>
              </div>

              {activeLangTab === 'python' && (
                <div className="form-group">
                  <label className="form-label">Python Starter Code</label>
                  <textarea
                    rows={10}
                    className="form-input"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', tabSize: 4 }}
                    value={starterPython}
                    onChange={(e) => setStarterPython(e.target.value)}
                  />
                </div>
              )}

              {activeLangTab === 'cpp' && (
                <div className="form-group">
                  <label className="form-label">C++ Starter Code</label>
                  <textarea
                    rows={10}
                    className="form-input"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', tabSize: 4 }}
                    value={starterCpp}
                    onChange={(e) => setStarterCpp(e.target.value)}
                  />
                </div>
              )}

              {activeLangTab === 'java' && (
                <div className="form-group">
                  <label className="form-label">Java Starter Code (Class Solution)</label>
                  <textarea
                    rows={10}
                    className="form-input"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', tabSize: 4 }}
                    value={starterJava}
                    onChange={(e) => setStarterJava(e.target.value)}
                  />
                </div>
              )}

              {activeLangTab === 'javascript' && (
                <div className="form-group">
                  <label className="form-label">JavaScript (Node.js) Starter Code</label>
                  <textarea
                    rows={10}
                    className="form-input"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', tabSize: 4 }}
                    value={starterJavascript}
                    onChange={(e) => setStarterJavascript(e.target.value)}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('examples')}
                  className="btn btn-outline"
                >
                  ← Back to Examples
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('tests')}
                  className="btn btn-primary"
                >
                  Next: Evaluation Test Cases →
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: TEST CASES (PUBLIC & HIDDEN) */}
          {activeTab === 'tests' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {/* Public Test Cases */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div>
                    <h4 style={{ fontSize: '1.05rem', margin: 0, color: '#f9fafb' }}>Public Test Cases</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
                      Visible in console with full expected vs actual output diff.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddTestCase(false)}
                    className="btn btn-outline btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Plus size={14} />
                    <span>Add Public Test</span>
                  </button>
                </div>

                {testCases.map((tc, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#090d16',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1rem',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#38bdf8' }}>
                        Public Case {idx + 1}
                      </span>
                      {testCases.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTestCase(idx, false)}
                          style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <textarea
                        rows={2}
                        className="form-input"
                        placeholder="Stdin input"
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                        value={tc.input}
                        onChange={(e) => handleTestCaseChange(idx, 'input', e.target.value, false)}
                      />
                      <textarea
                        rows={2}
                        className="form-input"
                        placeholder="Expected stdout"
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                        value={tc.expectedOutput}
                        onChange={(e) => handleTestCaseChange(idx, 'expectedOutput', e.target.value, false)}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Hidden Test Cases */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <h4 style={{ fontSize: '1.05rem', margin: 0, color: '#f9fafb' }}>Hidden Evaluation Test Cases</h4>
                      <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>Protected</span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
                      Stored securely in PostgreSQL. Inputs and expected outputs are NEVER sent to the candidate.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddTestCase(true)}
                    className="btn btn-outline btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Plus size={14} />
                    <span>Add Hidden Test</span>
                  </button>
                </div>

                {hiddenTestCases.map((tc, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#090d16',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1rem',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <EyeOff size={13} />
                        <span>Hidden Test {idx + 1}</span>
                      </span>
                      {hiddenTestCases.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTestCase(idx, true)}
                          style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <textarea
                        rows={2}
                        className="form-input"
                        placeholder="Secret input"
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                        value={tc.input}
                        onChange={(e) => handleTestCaseChange(idx, 'input', e.target.value, true)}
                      />
                      <textarea
                        rows={2}
                        className="form-input"
                        placeholder="Secret expected stdout"
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                        value={tc.expectedOutput}
                        onChange={(e) => handleTestCaseChange(idx, 'expectedOutput', e.target.value, true)}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: '1.5rem',
                marginTop: '1rem',
              }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('code')}
                  className="btn btn-outline"
                >
                  ← Back to Starter Code
                </button>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <Link to="/interviewer/dashboard" className="btn btn-outline">
                    Cancel
                  </Link>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary"
                    style={{
                      padding: '0.6rem 1.5rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontWeight: 600,
                    }}
                  >
                    <Save size={16} />
                    <span>{loading ? 'Saving Question...' : 'Save Question'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
