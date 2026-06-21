import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslation } from '../contexts/LanguageContext';
import * as Sentry from '@sentry/react';
import { triggerHaptic } from '../lib/nativeServices';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundaryClass extends Component<Props & { t: any; language: string; isRtl: boolean }, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught exception:', error, errorInfo);
    
    // Capture error in Sentry
    Sentry.captureException(error, { extra: { errorInfo } });
    
    // Trigger physical error vibration haptic
    triggerHaptic('error');
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const { language, isRtl } = this.props;

      return (
        <div 
          className="min-h-screen bg-slate-50 flex items-center justify-center p-6" 
          style={{ direction: isRtl ? 'rtl' : 'ltr' }}
        >
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 max-w-md w-full p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="mx-auto w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 animate-pulse">
              <AlertTriangle className="w-8 h-8" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-slate-800 font-sans">
                {language === 'ar' ? 'عذراً، حدث خطأ غير متوقع' : 'Oops, something went wrong'}
              </h1>
              <p className="text-slate-500 text-sm leading-relaxed">
                {language === 'ar' 
                  ? 'واجه التطبيق خطأً غير متوقع في التشغيل. لقد قمنا بتسجيل الخطأ للتحقيق فيه. يرجى محاولة تحديث الصفحة.' 
                  : 'The application encountered an unexpected runtime error. We have logged the error for investigation. Please try reloading.'}
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-50 rounded-2xl p-4 text-left font-mono text-xs text-red-600 border border-slate-100 overflow-auto max-h-32 select-all">
                {this.state.error.toString()}
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="w-full py-4 px-6 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-2xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{language === 'ar' ? 'تحديث الصفحة الآن' : 'Reload Page Now'}</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrapper component to pass translation context
export default function ErrorBoundary({ children }: Props) {
  const { t, language, isRtl } = useTranslation();
  return (
    <ErrorBoundaryClass t={t} language={language} isRtl={isRtl}>
      {children}
    </ErrorBoundaryClass>
  );
}
