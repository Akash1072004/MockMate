import { supabase, isSupabaseConfigured } from '../lib/supabase';

/**
 * Service for querying live candidate rankings from Supabase.
 * Strictly queries database records with zero fake/mock users.
 */
export async function getLeaderboard() {
  if (!isSupabaseConfigured || !supabase) {
    return { data: [], error: null };
  }

  try {
    // 1. Try querying the candidate_leaderboard view first
    const { data: viewData, error: viewError } = await supabase
      .from('candidate_leaderboard')
      .select('*')
      .order('rank', { ascending: true });

    if (!viewError && Array.isArray(viewData) && viewData.length > 0) {
      // Enrich with profile skills/socials if available
      const candidateIds = viewData.map((v) => v.candidate_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, skills, linkedin, experience')
        .in('id', candidateIds);

      const profileMap = new Map();
      (profiles || []).forEach((p) => profileMap.set(p.id, p));

      const enriched = viewData.map((row) => {
        const p = profileMap.get(row.candidate_id);
        return {
          ...row,
          skills: p?.skills || [],
          linkedin: p?.linkedin || null,
          experience: p?.experience || null,
        };
      });

      return { data: enriched, error: null };
    }

    // 2. Fallback query: Compute directly from interviews and profiles table
    // (In case the SQL view has not yet been executed in the user's Supabase instance)
    const { data: interviews, error: intError } = await supabase
      .from('interviews')
      .select(`
        id,
        candidate_id,
        candidate_name,
        score,
        status,
        candidate:candidate_id (
          id,
          full_name,
          skills,
          github,
          linkedin,
          experience
        )
      `)
      .eq('status', 'completed')
      .not('score', 'is', null);

    if (intError) {
      console.warn('[leaderboardService] Interviews query error:', intError.message);
      return { data: [], error: intError };
    }

    if (!interviews || interviews.length === 0) {
      return { data: [], error: null };
    }

    // Aggregate by candidate_id
    const candidateMap = new Map();

    interviews.forEach((item) => {
      const cid = item.candidate_id;
      if (!candidateMap.has(cid)) {
        candidateMap.set(cid, {
          candidate_id: cid,
          candidate_name: item.candidate?.full_name || item.candidate_name || 'Candidate',
          github: item.candidate?.github || null,
          linkedin: item.candidate?.linkedin || null,
          skills: item.candidate?.skills || [],
          experience: item.candidate?.experience || null,
          totalScore: 0,
          interview_count: 0,
        });
      }

      const rec = candidateMap.get(cid);
      rec.totalScore += Number(item.score) || 0;
      rec.interview_count += 1;
    });

    const candidates = Array.from(candidateMap.values()).map((c) => ({
      ...c,
      average_score: Number((c.totalScore / c.interview_count).toFixed(1)),
    }));

    // Sort by average_score DESC, then interview_count DESC
    candidates.sort((a, b) => {
      if (b.average_score !== a.average_score) {
        return b.average_score - a.average_score;
      }
      return b.interview_count - a.interview_count;
    });

    // Assign dense ranks
    let currentRank = 1;
    for (let i = 0; i < candidates.length; i++) {
      if (
        i > 0 &&
        (candidates[i].average_score !== candidates[i - 1].average_score ||
          candidates[i].interview_count !== candidates[i - 1].interview_count)
      ) {
        currentRank = i + 1;
      }
      candidates[i].rank = currentRank;
    }

    return { data: candidates, error: null };
  } catch (err) {
    console.error('[leaderboardService] Error fetching leaderboard:', err);
    return { data: [], error: err };
  }
}
