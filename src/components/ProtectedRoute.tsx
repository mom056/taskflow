import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';
import { useTranslation } from '../contexts/LanguageContext';
import AppLoader from './AppLoader';

export default function ProtectedRoute({ 
  children, 
  allowedRole 
}: { 
  children: React.ReactNode; 
  allowedRole?: 'manager' | 'employee' | 'super_admin' 
}) {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [loadingTime, setLoadingTime] = useState(0);
  const { language } = useTranslation();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      interval = setInterval(() => setLoadingTime(t => t + 1), 1000);
    } else {
      setLoadingTime(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950" dir="rtl">
        <AppLoader size={60} text={language === 'ar' ? 'جاري التحقق من صلاحيات الدخول...' : 'Verifying access permissions...'} />
        {loadingTime > 8 && (
           <button onClick={() => window.location.reload()} className="mt-4 px-5 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors z-50 relative border-none cursor-pointer font-semibold text-sm">
             {language === 'ar' ? 'تحديث الصفحة' : 'Refresh Page'}
           </button>
        )}
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && userRole && userRole !== allowedRole) {
    // Redirect to their appropriate dashboard if they have the wrong role
    if (userRole === 'super_admin') return <Navigate to="/super-admin" replace />;
    return <Navigate to={userRole === 'manager' ? '/manager' : '/employee'} replace />;
  }
  
  if (allowedRole && !userRole) {
     // User has no role assigned yet inside Supabase, but is authenticated.
     return <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center font-sans" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <h2 className="text-xl font-bold mb-2">
          {language === 'ar' ? 'حسابك قيد المراجعة' : 'Account Under Review'}
        </h2>
        <p className="mb-4 text-slate-500">
          {language === 'ar' 
            ? 'لم يتم تعيين دور لك في النظام بعد. يرجى التواصل مع المدير.' 
            : 'No role assigned to your account yet. Please contact the manager.'}
        </p>
        <button 
          onClick={() => navigate('/login')} 
          className="bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 border-none cursor-pointer font-semibold"
        >
          {language === 'ar' ? 'العودة لتسجيل الدخول' : 'Back to Login'}
        </button>
     </div>
  }

  return children;
}
