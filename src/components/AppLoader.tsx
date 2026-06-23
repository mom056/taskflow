import React from 'react';
import { AppLogoIcon } from './AppLogo';
import { useTranslation } from '../contexts/LanguageContext';

interface AppLoaderProps {
  text?: string;
  size?: number;
  className?: string;
}

export default function AppLoader({ text, size = 56, className = '' }: AppLoaderProps) {
  const { language } = useTranslation();
  const loadingText = text || (language === 'ar' ? 'جاري التحميل...' : 'Loading...');

  return (
    <div className={`flex flex-col items-center justify-center gap-6 p-6 ${className}`}>
      <div className="relative flex items-center justify-center">
        {/* Modern rotating gradient loading ring */}
        <div 
          className="absolute rounded-full border-[3px] border-slate-100 dark:border-slate-800/40 border-t-blue-600 dark:border-t-blue-500 animate-spin"
          style={{ 
            width: size + 20, 
            height: size + 20,
          }} 
        />
        
        {/* Pulsating logo icon */}
        <div className="animate-logo-breath flex items-center justify-center z-10">
          <AppLogoIcon size={size} className="rounded-2xl bg-white dark:bg-slate-900 p-1 border border-slate-100/50 dark:border-slate-800/50" />
        </div>
      </div>
      
      {/* Loading description text */}
      <span className="text-slate-400 dark:text-slate-500 text-sm font-semibold tracking-wide animate-pulse">
        {loadingText}
      </span>
    </div>
  );
}
