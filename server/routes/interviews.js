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

/**
 * GET /api/interviews/leaderboard
 * Computes live, authoritative candidate rankings and average scores
 * strictly from completed interviews with valid evaluations in the database.
 * Preserves decimal precision (e.g. 8.23/10) and assigns dense ranks.
 */
router.get('/leaderboard', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    // 1. Fetch ALL completed interviews with valid score or evaluation (no arbitrary row limit)
    const { data: interviews, error: intErr } = await supabase
      .from('interviews')
      .select('id, candidate_id, status, score, evaluation, created_at')
      .eq('status', 'completed')
      .range(0, 99999);

    if (intErr) {
      console.error('[API /leaderboard] Error querying interviews:', intErr);
      return res.status(500).json({ error: intErr.message });
    }

    // 2. Fetch candidate profiles (no arbitrary row limit)
    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('id, full_name, username, headline, skills, github, linkedin, avatar_url, role')
      .eq('role', 'candidate')
      .range(0, 99999);

    if (profErr) {
      console.error('[API /leaderboard] Error querying profiles:', profErr);
      return res.status(500).json({ error: profErr.message });
    }

    // 3. Aggregate ALL valid completed scores strictly per candidate
    // Each candidate's average is computed across ALL valid completed interviews given by that candidate.
    // There is NO limit (no 15-interview limit, no latest-only, no first-only).
    const scoresByCandidate = {};
    for (const inv of (interviews || [])) {
      if (inv.status !== 'completed') continue;

      let rawScore = null;
      if (inv.score !== null && inv.score !== undefined && !isNaN(Number(inv.score))) {
        rawScore = Number(inv.score);
      } else if (inv.evaluation) {
        try {
          const evalObj = typeof inv.evaluation === 'string' ? JSON.parse(inv.evaluation) : inv.evaluation;
          const candidateScore = evalObj?.overallScore ?? evalObj?.overall_score ?? evalObj?.score;
          if (candidateScore !== null && candidateScore !== undefined && !isNaN(Number(candidateScore))) {
            rawScore = Number(candidateScore);
          }
        } catch (e) {
          // ignore parse error
        }
      }

      if (rawScore !== null && !isNaN(rawScore)) {
        if (!scoresByCandidate[inv.candidate_id]) {
          scoresByCandidate[inv.candidate_id] = [];
        }
        scoresByCandidate[inv.candidate_id].push(Number(rawScore));
      }
    }

    // 4. Build leaderboard records: exactly ONE record per candidate with real completed interviews
    const leaderboard = [];
    for (const profile of (profiles || [])) {
      const scores = scoresByCandidate[profile.id] || [];
      if (scores.length === 0) continue; // Unranked if 0 valid completed interviews

      const sum = scores.reduce((a, b) => a + b, 0);
      const rawAvg = sum / scores.length; // Exact average across ALL interviews given by candidate
      const formattedScore = parseFloat(rawAvg.toFixed(2));

      leaderboard.push({
        candidate_id: profile.id,
        candidate_name: profile.full_name || 'Candidate',
        username: profile.username || null,
        headline: profile.headline || null,
        skills: profile.skills || [],
        github: profile.github || null,
        linkedin: profile.linkedin || null,
        avatar_url: profile.avatar_url || null,
        interview_count: scores.length, // Real count of ALL valid completed interviews
        average_score: formattedScore,
        raw_average: rawAvg,
      });
    }

    // 5. Rank candidates strictly by their calculated all-interview raw_average DESC
    leaderboard.sort((a, b) => {
      if (b.raw_average !== a.raw_average) return b.raw_average - a.raw_average;
      return b.interview_count - a.interview_count;
    });

    // 6. Assign dense ranks
    leaderboard.forEach((c, idx) => {
      c.rank = idx + 1;
    });

    return res.json({ leaderboard });
  } catch (err) {
    console.error('[API /leaderboard] Server error:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
