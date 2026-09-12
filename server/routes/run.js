import express from 'express';
import { executeCode } from '../services/codeExecutionService.js';
import { supabaseAdmin } from '../services/supabaseAdmin.js';

const router = express.Router();

const ALLOWED_LANGUAGES = ['python', 'py', 'cpp', 'c++', 'java'];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CODE_LENGTH = 100000; // 100 KB max source code

/**
 * POST /api/run
 * Validates code size, language, timeouts, and UUID parameters.
 * Executes code under child process sandbox and records to Supabase.
 */
router.post('/', async (req, res, next) => {
  try {
    const { language, code, testCases, customInput, interviewId, questionId, timeoutMs } = req.body || {};

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid "code" parameter. Must be a non-empty string.',
      });
    }

    if (code.length > MAX_CODE_LENGTH) {
      return res.status(413).json({
        error: `Code payload exceeds maximum allowed size of ${MAX_CODE_LENGTH} characters.`,
      });
    }

    const normalizedLang = (language || 'python').toLowerCase().trim();
    if (!ALLOWED_LANGUAGES.includes(normalizedLang)) {
      return res.status(400).json({
        error: `Unsupported language "${language}". Supported: python, cpp, java.`,
      });
    }

    // Validate interviewId format if provided
    let validatedInterviewId = null;
    if (interviewId) {
      if (typeof interviewId === 'string' && UUID_REGEX.test(interviewId.trim())) {
        validatedInterviewId = interviewId.trim();
      } else {
        return res.status(400).json({
          error: 'Invalid "interviewId" format. Must be a valid UUID.',
        });
      }
    }

    // Fetch hidden test cases from Supabase if questionId provided
    let allTestCases = Array.isArray(testCases) ? testCases.map(tc => ({ ...tc, isHidden: false })) : [];
    if (questionId && supabaseAdmin) {
      try {
        const { data: hiddenData } = await supabaseAdmin
          .from('question_hidden_tests')
          .select('hidden_test_cases')
          .eq('question_id', questionId)
          .maybeSingle();

        if (hiddenData?.hidden_test_cases && Array.isArray(hiddenData.hidden_test_cases)) {
          const hiddenCases = hiddenData.hidden_test_cases.map(tc => ({
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            isHidden: true,
          }));
          allTestCases = [...allTestCases, ...hiddenCases];
        }
      } catch (err) {
        console.warn('[MockMate Server] Failed to fetch hidden test cases:', err.message);
      }
    }

    // Clamp execution timeout
    const parsedTimeout = Number(timeoutMs);
    const safeTimeout = !isNaN(parsedTimeout)
      ? Math.max(1000, Math.min(parsedTimeout, 8000))
      : 5000;

    // Execute code securely
    const result = await executeCode({
      language: normalizedLang,
      code,
      testCases: allTestCases,
      customInput: customInput != null ? String(customInput).slice(0, 50000) : null,
      timeoutMs: safeTimeout,
    });

    // Sanitize test results so hidden test case data is never exposed to the client
    const sanitizedTestResults = (result.testResults || []).map((tr, idx) => {
      const originalCase = allTestCases[idx];
      if (originalCase && originalCase.isHidden) {
        return {
          index: tr.index,
          isHidden: true,
          input: 'Hidden Test Case (Content Protected)',
          expectedOutput: 'Hidden Expected Output',
          actualOutput: tr.passed ? 'Output matches expected' : 'Output did not match expected',
          passed: tr.passed,
          durationMs: tr.durationMs,
        };
      }
      return tr;
    });

    let submissionId = null;

    // Persist to Supabase if valid interviewId provided and admin client available
    if (validatedInterviewId && supabaseAdmin) {
      try {
        const { data, error: dbError } = await supabaseAdmin
          .from('code_submissions')
          .insert({
            interview_id: validatedInterviewId,
            code,
            language: normalizedLang,
            verdict: result.verdict,
            passed_tests: result.passedCount,
            total_tests: result.totalCount,
            execution_time_ms: result.executionTimeMs,
            output: result.output || '',
            error: result.error || null,
          })
          .select('id')
          .single();

        if (dbError) {
          console.warn('[MockMate Server] code_submissions insert warning:', dbError.message);
        } else if (data) {
          submissionId = data.id;
        }
      } catch (err) {
        console.warn('[MockMate Server] Supabase insertion error:', err.message);
      }
    }

    return res.json({
      ...result,
      testResults: sanitizedTestResults,
      submissionId,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
