import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch profile for authenticated user
  const fetchProfile = async (userId, userEmail) => {
    if (!supabase || !userId) {
      setProfile(null);
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('[MockMate Auth] Error fetching profile:', error);
      }

      if (data) {
        setProfile(data);
        return data;
      } else {
        // If profile doesn't exist yet, attempt to self-heal using user_metadata
        const metadata = user?.user_metadata || {};
        const fallbackProfile = {
          id: userId,
          full_name: metadata.full_name || userEmail?.split('@')[0] || 'User',
          email: userEmail || '',
          role: metadata.role === 'interviewer' ? 'interviewer' : 'candidate',
          is_available: metadata.role === 'interviewer',
        };

        const { data: created, error: insertError } = await supabase
          .from('profiles')
          .upsert(fallbackProfile)
          .select()
          .single();

        if (!insertError && created) {
          setProfile(created);
          return created;
        }

        setProfile(fallbackProfile);
        return fallbackProfile;
      }
    } catch (err) {
      console.error('[MockMate Auth] Unexpected profile error:', err);
      return null;
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    // Get initial active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    }).catch(err => {
      console.error('[MockMate Auth] Session check error:', err);
      if (mounted) setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!mounted) return;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          if (currentSession?.user) {
            await fetchProfile(currentSession.user.id, currentSession.user.email);
          }
        } else if (event === 'SIGNED_OUT') {
          setProfile(null);
          setUser(null);
          setSession(null);
        }
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // Sign up with Supabase Auth + profile insertion
  const signUp = async ({ email, password, fullName, role, github, linkedin }) => {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase is not configured. Please set credentials in .env.');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: role || 'candidate',
        },
      },
    });

    if (error) throw error;

    if (data?.user) {
      // Create profile row in profiles table
      const newProfile = {
        id: data.user.id,
        full_name: fullName,
        email: email,
        role: role || 'candidate',
        github: github || null,
        linkedin: linkedin || null,
        is_available: role === 'interviewer',
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(newProfile);

      if (profileError) {
        console.error('[MockMate Auth] Error saving profile on signup:', profileError);
      }

      setProfile(newProfile);
    }

    return data;
  };

  // Sign in with email and password
  const signIn = async ({ email, password }) => {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase is not configured. Please set credentials in .env.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    if (data?.user) {
      await fetchProfile(data.user.id, data.user.email);
    }

    return data;
  };

  // Sign out
  const signOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  // Update profile (role is immutable after creation)
  const updateProfile = async (updates) => {
    if (!supabase || !user) throw new Error('Not authenticated');

    const { role: _ignoredRole, id: _ignoredId, ...safeUpdates } = updates;

    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...safeUpdates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;
    setProfile(data);
    return data;
  };

  const value = {
    user,
    session,
    profile,
    role: profile?.role || user?.user_metadata?.role || 'candidate',
    loading,
    isConfigured: isSupabaseConfigured,
    signUp,
    signIn,
    signOut,
    updateProfile,
    refreshProfile: () => user ? fetchProfile(user.id, user.email) : Promise.resolve(null),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
