import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure env variables are loaded
const rootEnvPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}

const router = express.Router();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

/**
 * GET /api/interviews/live-sessions
 * Returns read-only public metadata of genuinely ACTIVE interviews.
 * Excludes private code, test cases, chat, and evaluations.
 */
router.get('/live-sessions', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    // Query active interviews only
    const { data: interviews, error } = await supabase
      .from('interviews')
      .select('id, interviewer_id, interviewer_name, candidate_id, candidate_name, interview_type, difficulty, start_time, duration, status')
      .eq('status', 'active')
      .order('start_time', { ascending: false });

    if (error) {
      console.error('[API /live-sessions] Error querying active interviews:', error);
      return res.status(500).json({ error: error.message });
    }

    if (!interviews || interviews.length === 0) {
      return res.json({ liveSessions: [] });
    }

    // Fetch display names from profiles if missing
    const userIds = [
      ...new Set(interviews.flatMap(i => [i.interviewer_id, i.candidate_id]).filter(Boolean))
    ];

    let profileMap = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      if (profiles) {
        profiles.forEach(p => {
          profileMap[p.id] = p.full_name || p.email?.split('@')[0] || 'User';
        });
      }
    }

    const liveSessions = interviews.map(i => ({
      id: i.id,
      interviewerId: i.interviewer_id,
      interviewerName: profileMap[i.interviewer_id] || i.interviewer_name || 'Interviewer',
      candidateId: i.candidate_id,
      candidateName: profileMap[i.candidate_id] || i.candidate_name || 'Candidate',
      interviewType: i.interview_type || 'Technical',
      difficulty: i.difficulty || 'Medium',
      startTime: i.start_time,
      duration: i.duration || 60,
      status: 'IN SESSION'
    }));

    return res.json({ liveSessions });
  } catch (err) {
    console.error('[API /live-sessions] Server error:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
