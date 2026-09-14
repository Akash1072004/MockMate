import express from 'express';
import { generateInterviewQuestions, generateAITurn } from '../services/geminiService.js';

const router = express.Router();

const VALID_TRACKS = ['Technical', 'DSA', 'Frontend', 'Backend', 'Full Stack', 'HR', 'Behavioral'];
const VALID_DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

/**
 * POST /api/questions
 * Input validation and sanitization for AI question generation.
 */
router.post('/', async (req, res, next) => {
  try {
    let { interviewType, difficulty, duration } = req.body || {};

    // Validate and sanitize interview track
    if (!interviewType || !VALID_TRACKS.includes(String(interviewType).trim())) {
      interviewType = 'Technical';
    } else {
      interviewType = String(interviewType).trim();
    }

    // Validate and sanitize difficulty level
    if (!difficulty || !VALID_DIFFICULTIES.includes(String(difficulty).trim())) {
      difficulty = 'Medium';
    } else {
      difficulty = String(difficulty).trim();
    }

    // Validate and clamp duration
    let numDuration = Number(duration);
    if (isNaN(numDuration) || numDuration < 15 || numDuration > 120) {
      numDuration = 30;
    }

    console.log(`[API /api/questions] Validated request -> Track: ${interviewType}, Difficulty: ${difficulty}, Duration: ${numDuration}m`);

    const questions = await generateInterviewQuestions({
      interviewType,
      difficulty,
      duration: numDuration,
    });

    return res.json({
      success: true,
      count: questions.length,
      questions,
    });
  } catch (err) {
    console.error('[API /api/questions Error]:', err);
    next(err);
  }
});

/**
 * POST /api/questions/ai-turn
 * Conversational turn in the 7-stage Resume-Aware AI Mock Interview
 */
router.post('/ai-turn', async (req, res, next) => {
  try {
    const {
      stage = 'introduction',
      candidateName = 'Candidate',
      resumeText = '',
      history = [],
      lastUserMessage = '',
      interviewType = 'Technical',
      difficulty = 'Medium',
      codingProblem = null,
      code = '',
    } = req.body || {};

    const turnResult = await generateAITurn({
      stage,
      candidateName,
      resumeText,
      history,
      lastUserMessage,
      interviewType,
      difficulty,
      codingProblem,
      code,
    });

    return res.json({
      success: true,
      ...turnResult,
    });
  } catch (err) {
    console.error('[API /api/questions/ai-turn Error]:', err);
    next(err);
  }
});

export default router;
