import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Preferences } from '@capacitor/preferences';
import { ar, TranslationType } from '../locales/ar';
import { en } from '../locales/en';

export type Language = 'ar' | 'en';

interface LanguageContextType {
  language: Language;
  t: TranslationType;
  changeLanguage: (lang: Language) => Promise<void>;
  isRtl: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'taskflow_language';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('ar');

  // Load saved language on mount
  useEffect(() => {
    async function loadSavedLanguage() {
      try {
        const { value } = await Preferences.get({ key: LOCAL_STORAGE_KEY });
        if (value === 'ar' || value === 'en') {
          setLanguage(value);
        } else {
          // Fallback to browser preference or default to Arabic
          const browserLang = navigator.language.split('-')[0];
          const defaultLang: Language = browserLang === 'en' ? 'en' : 'ar';
          setLanguage(defaultLang);
        }
      } catch (err) {
        console.warn('[LanguageContext] Failed to load language preferences:', err);
      }
    }
    loadSavedLanguage();
  }, []);

  // Update HTML tag direction and lang attributes when language changes
  useEffect(() => {
    const dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [language]);

  const changeLanguage = async (newLang: Language) => {
    setLanguage(newLang);
    try {
      await Preferences.set({ key: LOCAL_STORAGE_KEY, value: newLang });
    } catch (err) {
      console.warn('[LanguageContext] Failed to save language preferences:', err);
    }
  };

  const t = language === 'en' ? en : ar;
  const isRtl = language === 'ar';

  return (
    <LanguageContext.Provider value={{ language, t, changeLanguage, isRtl }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}
