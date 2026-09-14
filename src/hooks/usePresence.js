import { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

/**
 * Hook to publish real-time presence for interviewers.
 * Automatically untracks on tab close, navigate away, or unmount.
 */
export function usePresencePublisher({ user, role, isAvailable = true, inInterview = false }) {
  const channelRef = useRef(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !user?.id || role !== 'interviewer') {
      return;
    }

    const channel = supabase.channel('platform_presence', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channelRef.current = channel;

    const currentStatus = inInterview ? 'busy' : isAvailable ? 'available' : 'offline';

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          user_id: user.id,
          role: 'interviewer',
          status: currentStatus,
          online_at: new Date().toISOString(),
        });
      }
    });

    const handleBeforeUnload = () => {
      if (channelRef.current) {
        channelRef.current.untrack().catch(() => {});
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup when unmounting or changing status
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (channelRef.current) {
        channelRef.current.untrack().catch(() => {});
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id, role, isAvailable, inInterview]);
}

/**
 * Hook for candidates & interviewers to listen to live interviewer presence in real-time.
 * Returns a map of userId -> { status: 'available' | 'busy' | 'offline', online_at }
 */
export function useLiveInterviewerPresence() {
  const [presenceMap, setPresenceMap] = useState({});

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const channel = supabase.channel('platform_presence');

    const updatePresenceState = () => {
      const state = channel.presenceState();
      const map = {};
      Object.keys(state).forEach((key) => {
        const presences = state[key];
        if (presences && presences.length > 0) {
          const latest = presences[presences.length - 1];
          map[latest.user_id || key] = {
            status: latest.status || 'available',
            online_at: latest.online_at,
          };
        }
      });
      setPresenceMap(map);
    };

    channel
      .on('presence', { event: 'sync' }, updatePresenceState)
      .on('presence', { event: 'join' }, updatePresenceState)
      .on('presence', { event: 'leave' }, updatePresenceState)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return presenceMap;
}
