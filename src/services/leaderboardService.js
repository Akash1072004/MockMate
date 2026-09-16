import { supabase, isSupabaseConfigured } from '../lib/supabase.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';

/**
 * Service for querying live candidate rankings.
 * 1. Authoritative calculated backend /api/interviews/leaderboard preserving full score precision.
 * 2. Fallback to Supabase candidate_leaderboard view and RPC.
 */
export async function getLeaderboard() {
  // 1. Primary: Authoritative calculated backend endpoint
  try {
    const apiBase = getApiBaseUrl();
    const res = await fetch(`${apiBase}/interviews/leaderboard`);
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.leaderboard)) {
        return { data: json.leaderboard, error: null };
      }
    }
  } catch (apiErr) {
    console.warn('[leaderboardService] Backend /leaderboard fetch note:', apiErr.message);
  }

  if (!isSupabaseConfigured || !supabase) {
    return { data: [], error: null };
  }

  // 2. Fallback: Query the canonical candidate_leaderboard view or RPC
  try {
    let leaderboardRows = null;
    const { data: viewData, error: viewError } = await supabase
      .from('candidate_leaderboard')
      .select('*')
      .order('rank', { ascending: true });

    if (!viewError && Array.isArray(viewData) && viewData.length > 0) {
      leaderboardRows = viewData;
    } else {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_candidate_leaderboard');
      if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
        leaderboardRows = rpcData;
      }
    }

    if (leaderboardRows && leaderboardRows.length > 0) {
      // Enrich with profile skills/socials/handles
      const candidateIds = leaderboardRows.map((v) => v.candidate_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, headline, skills, linkedin, github, leetcode, codeforces, codechef, experience, avatar_url')
        .in('id', candidateIds);

      const profileMap = new Map();
      (profiles || []).forEach((p) => profileMap.set(p.id, p));

      const enriched = leaderboardRows.map((row) => {
        const p = profileMap.get(row.candidate_id);
        return {
          ...row,
          username: p?.username || null,
          headline: p?.headline || null,
          skills: p?.skills || [],
          linkedin: p?.linkedin || null,
          github: p?.github || null,
          leetcode: p?.leetcode || null,
          codeforces: p?.codeforces || null,
          codechef: p?.codechef || null,
          experience: p?.experience || null,
          avatar_url: p?.avatar_url || null,
        };
      });

      return { data: enriched, error: null };
    }

    return { data: [], error: null };
  } catch (err) {
    console.error('[leaderboardService] Error fetching leaderboard:', err);
    return { data: [], error: err };
  }
}
