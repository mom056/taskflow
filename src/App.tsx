import { BrowserRouter, HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import ManagerDashboard from './pages/ManagerDashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import ProfileSettings from './pages/ProfileSettings';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from './lib/supabase';

const Router = Capacitor.isNativePlatform() ? HashRouter : BrowserRouter;

function CapacitorHandlers() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let activeListener: any = null;
    let backListener: any = null;

    async function setupNativeHandlers() {
      const { App: CapApp } = await import('@capacitor/app');
      const { StatusBar, Style } = await import('@capacitor/status-bar');

      // 1. Configure Status Bar to overlay webview so CSS env(safe-area-inset-top) works
      try {
        await StatusBar.setOverlaysWebView({ overlay: true });
        await StatusBar.setStyle({ style: Style.Light }); // Dark text/icons for light background
      } catch (err) {
        console.warn('[StatusBar] Failed to configure status bar:', err);
      }

      // 2. App State Change Listener (Resume)
      activeListener = await CapApp.addListener('appStateChange', (state) => {
        if (state.isActive) {
          console.log('[AppState] App resumed, invalidating query cache and reconnecting supabase...');
          queryClient.invalidateQueries();
          supabase.realtime.connect();
        }
      });

      // 3. Hardware Back Button Listener (Android)
      backListener = await CapApp.addListener('backButton', async () => {
        // Run custom handlers first (like closing modals or tabs)
        const handlers = (window as any).capBackButtonHandlers;
        if (handlers && handlers.length > 0) {
          const topHandler = handlers[0];
          // Execute the handler
          const prevented = await topHandler.fn();
          // If the handler returned true or did not return false, we consider it handled
          if (prevented !== false) {
            console.log('[NativeBack] Back button handled by component registration:', topHandler.id);
            return;
          }
        }

        // Default behavior: exit app if on root route, otherwise navigate back in history
        const rootPaths = ['/login', '/manager', '/employee', '/super-admin', '/'];
        const isRootPath = rootPaths.includes(location.pathname);

        if (isRootPath) {
          CapApp.exitApp();
        } else {
          navigate(-1);
        }
      });
    }

    setupNativeHandlers();

    return () => {
      if (activeListener) activeListener.remove();
      if (backListener) backListener.remove();
    };
  }, [queryClient, navigate, location.pathname]);

  return null;
}

function App() {
  return (
    <Router>
      <CapacitorHandlers />
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
  const navigate = useNavigate();

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
                navigate('/login');
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
