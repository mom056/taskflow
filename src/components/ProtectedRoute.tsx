import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';

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
           <div className="text-slate-500 font-medium z-50">جاري الدخول للنظام... ({loadingTime} ثانية)</div>
        )}
        {loadingTime > 8 && (
           <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-slate-200 rounded hover:bg-slate-300 z-50 relative">تحديث الصفحة</button>
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
     // In a real app we might show a "wait for admin approval" screen, 
     // but here we just show a little message or redirect.
     return <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center font-sans" dir="rtl">
        <h2 className="text-xl font-bold mb-2">حسابك قيد المراجعة</h2>
        <p className="mb-4">لم يتم تعيين دور لك في النظام بعد. يرجى التواصل مع المدير.</p>
        <button 
          onClick={() => navigate('/login')} 
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          العودة لتسجيل الدخول
        </button>
     </div>
  }

  return children;
}
