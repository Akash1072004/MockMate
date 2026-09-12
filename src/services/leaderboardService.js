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
    // 1. Query the canonical candidate_leaderboard view
    let leaderboardRows = null;
    const { data: viewData, error: viewError } = await supabase
      .from('candidate_leaderboard')
      .select('*')
      .order('rank', { ascending: true });

    if (!viewError && Array.isArray(viewData) && viewData.length > 0) {
      leaderboardRows = viewData;
    } else {
      // 2. Fallback to the secure get_candidate_leaderboard RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_candidate_leaderboard');
      if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
        leaderboardRows = rpcData;
      }
    }

    if (leaderboardRows && leaderboardRows.length > 0) {
      // Enrich with profile skills/socials
      const candidateIds = leaderboardRows.map((v) => v.candidate_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, skills, linkedin, experience')
        .in('id', candidateIds);

      const profileMap = new Map();
      (profiles || []).forEach((p) => profileMap.set(p.id, p));

      const enriched = leaderboardRows.map((row) => {
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

    return { data: [], error: null };
  } catch (err) {
    console.error('[leaderboardService] Error fetching leaderboard:', err);
    return { data: [], error: err };
  }
}
