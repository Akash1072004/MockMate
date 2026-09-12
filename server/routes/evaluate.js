import express from 'express';
import { generateEvaluationReport } from '../services/geminiService.js';
import { supabaseAdmin } from '../services/supabaseAdmin.js';

const router = express.Router();
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/evaluate
 * Securely evaluates candidate performance using Gemini 2.5 Flash.
 * Enforces UUID format validation and persists evaluation results.
 */
router.post('/', async (req, res, next) => {
  try {
    const { interviewId } = req.body || {};

    if (!interviewId || typeof interviewId !== 'string' || !UUID_REGEX.test(interviewId.trim())) {
      return res.status(400).json({
        error: 'Missing or invalid "interviewId". Must be a valid UUID string.',
      });
    }

    const cleanInterviewId = interviewId.trim();
    let interview = null;
    let questions = [];
    let answers = [];
    let submissions = [];

    if (supabaseAdmin) {
      try {
        // 1. Fetch interview details
        const { data: interviewData, error: intErr } = await supabaseAdmin
          .from('interviews')
          .select('*')
          .eq('id', cleanInterviewId)
          .single();

        if (intErr) {
          console.warn('[API /api/evaluate] Interview lookup note:', intErr.message);
        } else {
          interview = interviewData;
        }

        // 2. Return cached evaluation if already finalized
        if (interview?.evaluation && interview?.status === 'completed') {
          return res.json({
            success: true,
            cached: true,
            evaluation: interview.evaluation,
            score: interview.score,
          });
        }

        // 3. Fetch questions
        const { data: questionsData } = await supabaseAdmin
          .from('interview_questions')
          .select('*')
          .eq('interview_id', cleanInterviewId)
          .order('question_order', { ascending: true });

        if (questionsData) {
          questions = questionsData;
        }

        // 4. Fetch candidate answers
        const { data: answersData } = await supabaseAdmin
          .from('interview_answers')
          .select('*')
          .eq('interview_id', cleanInterviewId);

        if (answersData) {
          answers = answersData;
        }

        // 5. Fetch code submissions
        const { data: submissionsData } = await supabaseAdmin
          .from('code_submissions')
          .select('*')
          .eq('interview_id', cleanInterviewId)
          .order('created_at', { ascending: true });

        if (submissionsData) {
          submissions = submissionsData;
        }
      } catch (dbErr) {
        console.warn('[API /api/evaluate] Database query warning:', dbErr.message);
      }
    }

    // Generate comprehensive evaluation using Gemini
    const evaluation = await generateEvaluationReport({
      interview,
      questions,
      answers,
      submissions,
    });

    // Save to database
    if (supabaseAdmin && interview) {
      try {
        const { error: updateErr } = await supabaseAdmin
          .from('interviews')
          .update({
            evaluation,
            score: evaluation.overallScore,
            status: 'completed',
            completion_time: new Date().toISOString(),
          })
          .eq('id', cleanInterviewId);

        if (updateErr) {
          console.warn('[API /api/evaluate] Database update warning:', updateErr.message);
        }
      } catch (dbSaveErr) {
        console.warn('[API /api/evaluate] Database update error:', dbSaveErr.message);
      }
    }

    return res.json({
      success: true,
      evaluation,
      score: evaluation.overallScore,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
