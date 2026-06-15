import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';
import { useTranslation } from '../contexts/LanguageContext';

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
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="rounded-full h-10 w-10 bg-blue-600 animate-ping mb-4"></div>
        {loadingTime > 3 && (
           <div className="text-slate-500 font-medium z-50">
             {language === 'ar' 
               ? `جاري الدخول للنظام... (${loadingTime} ثانية)` 
               : `Logging in... (${loadingTime} seconds)`}
           </div>
        )}
        {loadingTime > 8 && (
           <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-slate-200 rounded hover:bg-slate-300 z-50 relative border-none cursor-pointer">
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
