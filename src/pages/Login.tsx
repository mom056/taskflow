import { useState, useRef, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Lock, Fingerprint } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from '../contexts/LanguageContext';
import { AppLogoIcon } from '../components/AppLogo';
import { useBiometricAuth } from '../hooks/useBiometricAuth';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshRole, user } = useAuth();
  const { t, language, changeLanguage } = useTranslation();
  const { isSupported: isBiometricSupported, isEnabled: isBiometricEnabled, loginWithBiometrics } = useBiometricAuth();
  const mounted = useRef(true);

  const [isLogin, setIsLogin] = useState(() => {
    if (location.state && typeof (location.state as any).isLogin === 'boolean') {
      return (location.state as any).isLogin;
    }
    return true;
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  // Password reset handler
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = resetEmail.trim();
    if (!trimmedEmail) return toast.error(language === 'ar' ? 'يرجى إدخال البريد الإلكتروني' : 'Please enter your email');
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return toast.error(t.login.invalidEmail);
    }

    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResetSent(true);
      toast.success(language === 'ar' ? 'تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني' : 'Password reset link sent to your email');
    } catch (err: any) {
      toast.error(err.message || (language === 'ar' ? 'تعذر إرسال رابط الاستعادة' : 'Could not send reset link'));
    } finally {
      setResetLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return toast.error(t.login.invalidEmail);
    }
    if (!isLogin && password.length < 10) {
      return toast.error(t.login.passwordLength);
    }

    setLoading(true);
    
    try {
      const loginEmail = email.trim();
      
      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password: password,
        });
        
        if (signInError) throw signInError;

        // Delegate profile fetch/creation to AuthContext
        await refreshRole();
        toast.success(t.login.signInSuccess);
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: loginEmail,
          password: password,
          options: {
            data: {
              name: name || loginEmail.split('@')[0],
              company_name: companyName.trim()
            }
          }
        });
        
        if (signUpError) {
          if (signUpError.message === 'User already registered') {
             setIsLogin(true);
             throw new Error(language === 'ar' ? 'البريد الإلكتروني مسجل بالفعل. لقد قمنا بتحويلك لصفحة تسجيل الدخول، يرجى المحاولة الآن.' : 'Email already registered. Redirected to login page, please try now.');
          }
          throw signUpError;
        }
        
        if (!data.user) {
          throw new Error(language === 'ar' ? 'فشل في إنشاء الحساب' : 'Failed to create account');
        }
        
        if (!data.session) {
          throw new Error(language === 'ar' ? 'تم إنشاء الحساب بنجاح. إذا واجهت مشكلة، يرجى التأكد من تعطيل "Confirm Email" في إعدادات Supabase Auth.' : 'Account created. If you face issues, ensure "Confirm Email" is disabled in Supabase Auth settings.');
        }

        // Delegate profile fetch/creation to AuthContext
        await refreshRole();
        toast.success(t.login.signUpSuccess);
      }
    } catch (err: any) {
      console.error(err);
      if (err.message) {
          if (err.message === 'User already registered') {
            toast.error(language === 'ar' ? 'البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول.' : 'Email already registered. Please sign in.');
          } else if (err.message === 'Email not confirmed') {
            toast.error(language === 'ar' ? 'البريد الإلكتروني غير مؤكد. يرجى تأكيد بريدك الإلكتروني أولاً.' : 'Email not confirmed. Please verify your email first.');
          } else if (err.message.includes('relation "public.users" does not exist') || err.message.includes('relation "users" does not exist')) {
            toast.error(language === 'ar' ? 'خطأ: جداول قاعدة البيانات غير موجودة. يرجى تنفيذ أوامر SQL الموجودة في ملف supabase_schema.sql في Supabase SQL Editor.' : 'Database tables missing. Run supabase_schema.sql in SQL Editor.', { duration: 5000 });
          } else {
            toast.error(err.message === 'Invalid login credentials' ? (language === 'ar' ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' : 'Invalid email or password.') : err.message);
          }
      } else {
        toast.error(language === 'ar' ? 'حدث خطأ أثناء المصادقة' : 'Authentication error occurred');
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  };

  const handleBiometricLogin = async () => {
    setLoading(true);
    try {
      const success = await loginWithBiometrics();
      if (success) {
        await refreshRole();
        toast.success(language === 'ar' ? 'تم تسجيل الدخول بالبصمة بنجاح ✓' : 'Logged in with biometrics successfully ✓');
      }
    } catch (err: any) {
      toast.error(err.message || (language === 'ar' ? 'فشل تسجيل الدخول بالبصمة' : 'Biometric login failed'));
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 relative" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Language Switcher absolute corner */}
      <div className={`absolute top-4 ${language === 'ar' ? 'left-4' : 'right-4'} z-10`}>
        <button 
          onClick={() => changeLanguage(language === 'ar' ? 'en' : 'ar')}
          className="text-xs font-bold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-3 py-2 rounded-xl transition-colors shadow-xs cursor-pointer"
        >
          {language === 'ar' ? 'English' : 'العربية'}
        </button>
      </div>

      <div className="max-w-md w-full bg-white rounded-4xl shadow-sm border border-slate-200 p-8">
        <div className="text-center mb-10">
          <div className="mx-auto h-16 w-16 flex items-center justify-center mb-6">
            <AppLogoIcon size={56} />
          </div>
          <h2 className="text-3xl font-bold text-slate-900">{t.common.appName}</h2>
          <p className="text-slate-500 mt-2 font-medium">{t.landing.subtitle}</p>
        </div>
        
        <div>
          {!isSupabaseConfigured && (
            <div className="mb-6 bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 text-sm font-medium leading-relaxed">
              <strong>{language === 'ar' ? 'تنبيه هام:' : 'Important Notice:'}</strong> {language === 'ar' ? 'قاعدة البيانات غير متصلة!' : 'Database not connected!'} <br className="mb-2" />
              {language === 'ar' 
                ? 'لإكمال تسجيل الدخول، يجب إضافة متغيرات البيئة VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في الإعدادات (Settings) أو عبر ملف .env.' 
                : 'To sign in, please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables in your settings or .env file.'}
            </div>
          )}
          <form onSubmit={handleAuth} className="space-y-5">
            {!isLogin && (
               <>
                 <div>
                   <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t.login.nameLabel}</label>
                   <input
                     type="text"
                     value={name}
                     onChange={(e) => setName(e.target.value)}
                     className="block w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm outline-none transition"
                     placeholder={t.login.namePlaceholder}
                     required={!isLogin}
                   />
                 </div>
                 <div>
                   <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t.login.companyLabel}</label>
                   <input
                     type="text"
                     value={companyName}
                     onChange={(e) => setCompanyName(e.target.value)}
                     className="block w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm outline-none transition"
                     placeholder={t.login.companyPlaceholder}
                     required={!isLogin}
                   />
                 </div>
               </>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t.login.emailLabel}</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`block w-full py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm outline-none transition ${language === 'ar' ? 'pr-10 pl-3' : 'pl-10 pr-3'}`}
                  placeholder={t.login.emailPlaceholder}
                  required
                />
                <div className={`absolute inset-y-0 flex items-center pointer-events-none ${language === 'ar' ? 'right-0 pr-3' : 'left-0 pl-3'}`}>
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t.login.passwordLabel}</label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`block w-full py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm outline-none transition ${language === 'ar' ? 'pr-10 pl-3' : 'pl-10 pr-3'}`}
                  placeholder={t.login.passwordPlaceholder}
                  required
                />
                <div className={`absolute inset-y-0 flex items-center pointer-events-none ${language === 'ar' ? 'right-0 pr-3' : 'left-0 pl-3'}`}>
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                type="submit"
                disabled={loading || !isSupabaseConfigured}
                className="flex-1 flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (isLogin ? t.login.btnSignIn : t.login.btnSignUp)}
              </button>

              {isLogin && isBiometricSupported && isBiometricEnabled && (
                <button
                  type="button"
                  onClick={handleBiometricLogin}
                  disabled={loading}
                  className="px-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition cursor-pointer flex items-center justify-center text-slate-600 shadow-xs dark:border-slate-800 bg-white"
                  title={language === 'ar' ? 'تسجيل الدخول بالبصمة' : 'Biometric Login'}
                >
                  <Fingerprint className="h-6 w-6 text-slate-600" />
                </button>
              )}
            </div>
          </form>

          {/* Forgot Password Link */}
          {isLogin && (
            <div className="mt-4 text-center">
              <button
                onClick={() => { setShowResetPassword(true); setResetEmail(email); setResetSent(false); }}
                className="text-sm text-slate-500 hover:text-blue-600 font-medium transition cursor-pointer bg-transparent border-none"
              >
                {t.login.forgotPassword}
              </button>
            </div>
          )}

          <div className="mt-8 text-center pt-6 border-t border-slate-100">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setShowResetPassword(false);
              }}
              className="text-sm text-blue-600 hover:text-blue-700 font-semibold transition cursor-pointer bg-transparent border-none"
            >
              {isLogin ? t.login.noAccount : t.login.haveAccount}
            </button>
          </div>
        </div>
      </div>

      {/* Password Reset Modal */}
      {showResetPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs px-4 animate-fade-in" onClick={() => setShowResetPassword(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-100 animate-scale-up" onClick={(e) => e.stopPropagation()} dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <h3 className="text-lg font-bold text-slate-900 mb-2">{t.login.forgotPassword}</h3>
            {resetSent ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto bg-green-50 h-14 w-14 rounded-full flex items-center justify-center">
                  <Mail className="h-7 w-7 text-green-600" />
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {language === 'ar' 
                    ? 'تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني. يرجى فتح الرابط وتعيين كلمة مرور جديدة.' 
                    : 'Password reset link sent to your email. Please check your inbox to set a new password.'}
                </p>
                <button
                  onClick={() => setShowResetPassword(false)}
                  className="w-full py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 transition cursor-pointer border-none"
                >
                  {language === 'ar' ? 'حسناً' : 'OK'}
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <p className="text-sm text-slate-500">
                  {language === 'ar' 
                    ? 'أدخل بريدك الإلكتروني وسنرسل لك رابطاً لاستعادة كلمة المرور.' 
                    : 'Enter your email address and we will send you a reset link.'}
                </p>
                <div className="relative">
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className={`block w-full py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm outline-none transition ${language === 'ar' ? 'pr-10 pl-3' : 'pl-10 pr-3'}`}
                    placeholder={t.login.emailPlaceholder}
                    required
                    autoFocus
                  />
                  <div className={`absolute inset-y-0 flex items-center pointer-events-none ${language === 'ar' ? 'right-0 pr-3' : 'left-0 pl-3'}`}>
                    <Mail className="h-4 w-4 text-slate-400" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center cursor-pointer border-none"
                  >
                    {resetLoading ? <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : (language === 'ar' ? 'إرسال الرابط' : 'Send Link')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(false)}
                    className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200 transition cursor-pointer border-none"
                  >
                    {t.common.cancel}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
