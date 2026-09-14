import { supabase } from '../lib/supabase';
import { getApiBaseUrl } from '../utils/apiConfig';


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
  questionId = null,
  timeoutMs = 5000,
}) {
  try {
    const apiBase = getApiBaseUrl();
    const response = await fetch(`${apiBase}/run`, {
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
        questionId,
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
    const isNetworkError = !err.status && (err.name === 'TypeError' || (err.message && err.message.toLowerCase().includes('failed to fetch')));
    return {
      success: false,
      verdict: 'RE',
      passedCount: 0,
      totalCount: Math.max(testCases.length, 1),
      executionTimeMs: 0,
      output: '',
      error: isNetworkError
        ? 'Code execution server is unreachable. Please ensure the backend is running and reachable over LAN.'
        : (err.message || 'Execution service returned an error.'),
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
