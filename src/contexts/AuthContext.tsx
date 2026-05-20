import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

type Role = 'manager' | 'employee' | null;

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: Role;
  created_at: number;
}

interface AuthContextType {
  user: User | null;
  userRole: Role;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchOrCreateProfile(sessionUser: User): Promise<{ profile: UserProfile; role: Role }> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', sessionUser.id)
    .maybeSingle();

  if (data) {
    return { profile: data as UserProfile, role: data.role as Role };
  }

  if (error) {
    console.warn('[Auth] SELECT error:', error.message);
  }

  const email = sessionUser.email ?? '';
  const { count } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });

  const newRole: Role = (count === null || count === 0) ? 'manager' : 'employee';
  const newProfile: UserProfile = {
    id: sessionUser.id,
    name: sessionUser.user_metadata?.name || email.split('@')[0] || 'مستخدم',
    email,
    role: newRole,
    created_at: Date.now(),
  };

  const { error: upsertErr } = await supabase
    .from('users')
    .upsert([newProfile], { onConflict: 'id' });

  if (upsertErr) {
    console.warn('[Auth] UPSERT error:', upsertErr.message);
    const { data: retry } = await supabase
      .from('users')
      .select('*')
      .eq('id', sessionUser.id)
      .maybeSingle();
    if (retry) {
      return { profile: retry as UserProfile, role: retry.role as Role };
    }
    throw new Error('Failed to create or fetch user profile: ' + upsertErr.message);
  }

  return { profile: newProfile, role: newRole };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<Role>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const isMountedRef = useRef(true);
  const pendingFetchRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    const handleSession = (sessionUser: User | null) => {
      if (!sessionUser) {
        if (isMountedRef.current) {
          setUser(null);
          setUserRole(null);
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      // Set user + loading=true immediately.
      // loading=true prevents "تعذر تحميل الحساب" flash while profile is fetching.
      if (isMountedRef.current) {
        setUser(sessionUser);
        setLoading(true);
      }

      // --- WEB LOCK DEADLOCK FIX ---
      // Defer DB fetch outside the onAuthStateChange callback using setTimeout(0).
      // This ensures the Supabase GoTrue Web Lock is fully released before we
      // make any authenticated database queries (which require the session token).
      if (pendingFetchRef.current) return;

      pendingFetchRef.current = new Promise<void>((resolve) => {
        setTimeout(async () => {
          try {
            const result = await fetchOrCreateProfile(sessionUser);
            if (isMountedRef.current) {
              setProfile(result.profile);
              setUserRole(result.role);
            }
          } catch (err) {
            console.error('[Auth] Profile fetch failed:', err);
          } finally {
            if (isMountedRef.current) {
              setLoading(false);
            }
            pendingFetchRef.current = null;
            resolve();
          }
        }, 0);
      });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          pendingFetchRef.current = null;
          handleSession(null);
          return;
        }

        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          handleSession(session?.user ?? null);
        }
      }
    );

    // Safety net: stop loading after 5 seconds if onAuthStateChange never fires
    const safetyTimer = setTimeout(() => {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }, 5000);

    return () => {
      isMountedRef.current = false;
      subscription.unsubscribe();
      clearTimeout(safetyTimer);
    };
  }, []);

  const refreshRole = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      try {
        const result = await fetchOrCreateProfile(session.user);
        setProfile(result.profile);
        setUserRole(result.role);
      } catch (err) {
        console.error('[Auth] refreshRole failed:', err);
      }
    }
  };

  const signOut = async () => {
    pendingFetchRef.current = null;
    setUser(null);
    setUserRole(null);
    setProfile(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, userRole, profile, loading, signOut, refreshRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
