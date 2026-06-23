import { createClient } from '@supabase/supabase-js';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

const isNative = Capacitor.isNativePlatform();

// Custom AsyncStorage wrapper for Capacitor Preferences
const capacitorPreferencesStorage = {
  getItem: (key: string): Promise<string | null> => {
    return Preferences.get({ key }).then((res) => res.value);
  },
  setItem: (key: string, value: string): Promise<void> => {
    return Preferences.set({ key, value });
  },
  removeItem: (key: string): Promise<void> => {
    return Preferences.remove({ key });
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isNative ? capacitorPreferencesStorage : localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: !isNative
  }
});
