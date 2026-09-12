import { supabase } from '../lib/supabase';

const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Executes source code via backend child process execution engine.
 * Supports Python, C++, and Java with full test cases, timeouts, and verdicts.
 */
export async function runCode({
  language,
  code,
  testCases = [],
  customInput = null,
  interviewId = null,
  timeoutMs = 5000,
}) {
  try {
    const response = await fetch(`${API_BASE_URL}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        language,
        code,
        testCases,
        customInput,
        interviewId,
        timeoutMs,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Execution failed with status ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error('[codeExecutionService] runCode error:', err);
    return {
      success: false,
      verdict: 'RE',
      passedCount: 0,
      totalCount: Math.max(testCases.length, 1),
      executionTimeMs: 0,
      output: '',
      error: err.message || 'Failed to connect to code execution server.',
      testResults: [],
    };
  }
}

/**
 * Fetches historical code submissions for an interview from Supabase.
 */
export async function getInterviewSubmissions(interviewId) {
  if (!interviewId || !supabase) return [];

  try {
    const { data, error } = await supabase
      .from('code_submissions')
      .select('*')
      .eq('interview_id', interviewId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[codeExecutionService] getInterviewSubmissions error:', error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.warn('[codeExecutionService] getInterviewSubmissions error:', err.message);
    return [];
  }
}
