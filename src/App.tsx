import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import ManagerDashboard from './pages/ManagerDashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import ProfileSettings from './pages/ProfileSettings';
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="min-h-screen bg-slate-50 font-sans" dir="rtl">
          <Toaster position="top-center" toastOptions={{ style: { fontFamily: 'inherit' } }} />
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/manager/*" element={
              <ProtectedRoute allowedRole="manager">
                <ManagerDashboard />
              </ProtectedRoute>
            } />

            <Route path="/employee/*" element={
              <ProtectedRoute allowedRole="employee">
                <EmployeeDashboard />
              </ProtectedRoute>
            } />

            <Route path="/super-admin/*" element={
              <ProtectedRoute allowedRole="super_admin">
                <SuperAdminDashboard />
              </ProtectedRoute>
            } />

            <Route path="/profile" element={
              <ProtectedRoute>
                <ProfileSettings />
              </ProtectedRoute>
            } />

            <Route path="/" element={<RootRedirect />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}

function RootRedirect() {
  const { user, userRole, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4" dir="rtl">
        <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin" />
        <p className="text-slate-400 text-sm font-medium">جاري التحميل...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6" dir="rtl">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center space-y-5">
          <div className="w-16 h-16 mx-auto bg-red-50 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">تعذر تحميل الحساب</h2>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              يرجى التأكد من إعداد جداول قاعدة البيانات بشكل صحيح عبر Supabase SQL Editor
            </p>
          </div>
          <div className="space-y-2.5 pt-2">
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors"
            >
              إعادة المحاولة
            </button>
            <button
              onClick={async () => {
                await signOut();
                window.location.href = '/login';
              }}
              className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-200 transition-colors"
            >
              تسجيل الخروج
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (userRole === 'super_admin') {
    return <Navigate to="/super-admin" replace />;
  }
  return <Navigate to={userRole === 'manager' ? '/manager' : '/employee'} replace />;
}

export default App;
