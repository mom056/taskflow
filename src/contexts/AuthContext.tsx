import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { Company } from '../types';

type Role = 'manager' | 'employee' | 'super_admin' | null;

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: Role;
  company_id: string;
  avatar_url?: string;
  created_at: number;
}

interface AuthContextType {
  user: User | null;
  userRole: Role;
  profile: UserProfile | null;
  company: Company | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchOrCreateProfile(sessionUser: User): Promise<{ profile: UserProfile; role: Role; company: Company | null }> {
  const { data, error } = await supabase
    .from('users')
    .select('*, company:companies(*)')
    .eq('id', sessionUser.id)
    .maybeSingle();

  if (data) {
    const { company, ...profileData } = data;
    return { 
      profile: profileData as UserProfile, 
      role: data.role as Role, 
      company: company as Company 
    };
  }

  if (error) {
    console.warn('[Auth] SELECT error:', error.message);
  }

  const email = sessionUser.email ?? '';
  const metadata = sessionUser.user_metadata || {};
  const companyName = metadata.company_name;

  // Check how many users exist in the system via RPC to bypass RLS limits
  const { data: userCount, error: countErr } = await supabase.rpc('get_user_count');
  if (countErr) {
    console.error('[Auth] Failed to get user count:', countErr.message);
  }
  const count = userCount !== null ? Number(userCount) : null;

  let newRole: Role = 'employee';
  let companyId = '';
  let companyData: Company | null = null;

  if (count === 0) {
    // 1st user is platform super_admin
    newRole = 'super_admin';
  } else if (companyName) {
    // Registered via signup with a company name -> manager
    newRole = 'manager';
  }

  // Handle company association/creation
  if (newRole === 'super_admin' || !companyName) {
    // Link to default or create default company
    const { data: existingCompanies } = await supabase
      .from('companies')
      .select('*')
      .limit(1);

    if (!existingCompanies || existingCompanies.length === 0) {
      const { data: defaultCompany, error: compErr } = await supabase
        .from('companies')
        .insert([{
          name: 'المؤسسة الافتراضية',
          slug: 'default',
          plan: 'premium',
          max_employees: 100,
          created_at: Date.now()
        }])
        .select()
        .single();
      
      if (compErr) throw compErr;
      companyId = defaultCompany.id;
      companyData = defaultCompany as Company;
    } else {
      companyId = existingCompanies[0].id;
      companyData = existingCompanies[0] as Company;
    }
  } else {
    // Create new company for the manager
    const slug = companyName.toLowerCase().replace(/\s+/g, '-').replace(/[^\u0600-\u06FF\w-]/g, '') + '-' + Math.random().toString(36).substring(2, 6);
    const { data: newCompany, error: compErr } = await supabase
      .from('companies')
      .insert([{
        name: companyName,
        slug: slug || `company-${Math.random().toString(36).substring(2, 6)}`,
        plan: 'free',
        max_employees: 5,
        created_at: Date.now()
      }])
      .select()
      .single();

    if (compErr) {
      console.error('[Auth] Company creation error:', compErr.message);
      throw new Error('Failed to create company: ' + compErr.message);
    }
    companyId = newCompany.id;
    companyData = newCompany as Company;
  }

  const newProfile: UserProfile = {
    id: sessionUser.id,
    name: metadata.name || email.split('@')[0] || 'مستخدم',
    email,
    role: newRole,
    company_id: companyId,
    created_at: Date.now(),
  };

  const { error: upsertErr } = await supabase
    .from('users')
    .upsert([newProfile], { onConflict: 'id' });

  if (upsertErr) {
    console.warn('[Auth] UPSERT error:', upsertErr.message);
    // In case of parallel execution race condition, retry fetch
    const { data: retry } = await supabase
      .from('users')
      .select('*, company:companies(*)')
      .eq('id', sessionUser.id)
      .maybeSingle();
    
    if (retry) {
      const { company, ...profileData } = retry;
      return { 
        profile: profileData as UserProfile, 
        role: retry.role as Role, 
        company: company as Company 
      };
    }
    throw new Error('Failed to create or fetch user profile: ' + upsertErr.message);
  }

  return { profile: newProfile, role: newRole, company: companyData };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<Role>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
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
          setCompany(null);
          setLoading(false);
        }
        return;
      }

      if (isMountedRef.current) {
        setUser(sessionUser);
        setLoading(true);
      }

      if (pendingFetchRef.current) return;

      pendingFetchRef.current = new Promise<void>((resolve) => {
        setTimeout(async () => {
          try {
            const result = await fetchOrCreateProfile(sessionUser);
            if (isMountedRef.current) {
              setProfile(result.profile);
              setUserRole(result.role);
              setCompany(result.company);
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
        setCompany(result.company);
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
    setCompany(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, userRole, profile, company, loading, signOut, refreshRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
