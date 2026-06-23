import React from 'react';
import { AppLogoIcon } from './AppLogo';
import { useTranslation } from '../contexts/LanguageContext';

interface AppLoaderProps {
  text?: string;
  size?: number;
  className?: string;
}

export default function AppLoader({ text, size = 64, className = '' }: AppLoaderProps) {
  const { language } = useTranslation();
  const loadingText = text || (language === 'ar' ? 'جاري التحميل...' : 'Loading...');

  const logoStyle = "rounded-2xl bg-white dark:bg-slate-900 p-1 border border-slate-100/30 dark:border-slate-800/30 shadow-xs object-contain";

  return (
    <div className={`flex flex-col items-center justify-center gap-8 p-6 select-none ${className}`}>
      {/* Ripple Animation Container */}
      <div 
        className="relative flex items-center justify-center"
        style={{ width: size + 40, height: size + 40 }}
      >
        {/* Ripple Wave 1 (Shape of the Logo) */}
        <div className="absolute animate-logo-ripple pointer-events-none">
          <AppLogoIcon size={size} className={logoStyle} />
        </div>

        {/* Ripple Wave 2 (Shape of the Logo) - Delayed */}
        <div className="absolute animate-logo-ripple-delayed pointer-events-none">
          <AppLogoIcon size={size} className={logoStyle} />
        </div>

        {/* Main Pulsating Logo */}
        <div className="relative animate-logo-breath z-10">
          <AppLogoIcon size={size} className={logoStyle} />
        </div>
      </div>
      
      {/* Loading text */}
      <span className="text-slate-400 dark:text-slate-500 text-sm font-semibold tracking-wide animate-pulse">
        {loadingText}
      </span>
    </div>
  );
}
