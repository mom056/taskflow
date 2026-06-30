import React from 'react';
import { useTranslation } from '../contexts/LanguageContext';
import logoImg from './logo.png';

interface AppLogoProps {
  size?: number;
  showText?: boolean;
  theme?: 'dark' | 'light';
  className?: string;
}

export function AppLogoIcon({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <img 
      src={logoImg} 
      alt="TaskFlow Icon" 
      width={size} 
      height={size} 
      className={`rounded-lg shrink-0 object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export default function AppLogo({ 
  size = 32, 
  showText = true, 
  theme = 'dark', 
  className = '' 
}: AppLogoProps) {
  const { t } = useTranslation();
  
  const textColorClass = theme === 'dark' 
    ? 'text-white' 
    : 'text-slate-800';

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <AppLogoIcon size={size} />
      {showText && (
        <span 
          className={`text-xl font-black tracking-tight bg-linear-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent ${textColorClass}`}
          style={{ fontFamily: 'Outfit, Inter, system-ui, sans-serif' }}
        >
          {t.common.appName}
        </span>
      )}
    </div>
  );
}
