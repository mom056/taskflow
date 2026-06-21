import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Preferences } from '@capacitor/preferences';

export type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => Promise<void>;
  setTheme: (theme: Theme) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_PREF_KEY = 'taskflow_theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');

  // Load saved theme on mount
  useEffect(() => {
    async function loadSavedTheme() {
      try {
        const { value } = await Preferences.get({ key: THEME_PREF_KEY });
        if (value === 'light' || value === 'dark') {
          setThemeState(value);
        } else {
          // Check system preference
          const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          setThemeState(systemPrefersDark ? 'dark' : 'light');
        }
      } catch (err) {
        console.warn('[ThemeContext] Failed to load theme preference:', err);
      }
    }
    loadSavedTheme();
  }, []);

  // Update HTML class attribute when theme changes
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      await Preferences.set({ key: THEME_PREF_KEY, value: newTheme });
    } catch (err) {
      console.warn('[ThemeContext] Failed to save theme preference:', err);
    }
  };

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    await setTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
