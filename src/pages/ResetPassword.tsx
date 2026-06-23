import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Lock, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from '../contexts/LanguageContext';
import { AppLogoIcon } from '../components/AppLogo';
import AppLoader from '../components/AppLoader';

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const navigate = useNavigate();
  const mounted = useRef(true);
  const { language, t } = useTranslation();

  useEffect(() => {
    mounted.current = true;

    // Supabase automatically picks up the recovery token from the URL hash
    // when using PKCE flow. We listen for the PASSWORD_RECOVERY event.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setSessionReady(true);
        }
      }
    );

    // Safety: if there's already a session (user clicked from email), mark ready
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && mounted.current) {
        setSessionReady(true);
      }
    });

    return () => {
      mounted.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      return toast.error(language === 'ar' ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters');
    }

    if (newPassword !== confirmPassword) {
      return toast.error(language === 'ar' ? 'كلمة المرور وتأكيدها غير متطابقتين' : 'Passwords do not match');
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setSuccess(true);
      toast.success(language === 'ar' ? 'تم تغيير كلمة المرور بنجاح' : 'Password updated successfully');

      // Redirect to login after a short delay
      setTimeout(() => {
        if (mounted.current) {
          navigate('/login', { replace: true });
        }
      }, 2500);
    } catch (err: any) {
      toast.error(err.message || (language === 'ar' ? 'تعذر تحديث كلمة المرور' : 'Could not update password'));
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-md w-full bg-white rounded-4xl shadow-sm border border-slate-200 p-8">
        <div className="text-center mb-10">
          <div className="mx-auto h-16 w-16 flex items-center justify-center mb-6">
            <AppLogoIcon size={56} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">
            {language === 'ar' ? 'تعيين كلمة مرور جديدة' : 'Reset Password'}
          </h2>
          <p className="text-slate-500 mt-2 text-sm font-medium">
            {language === 'ar' ? 'أدخل كلمة مرور جديدة لحسابك' : 'Enter a new password for your account'}
          </p>
        </div>

        {success ? (
          <div className="text-center space-y-4">
            <div className="mx-auto bg-green-50 h-16 w-16 rounded-full flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-sm text-slate-600 font-medium leading-relaxed">
              {language === 'ar' ? 'تم تغيير كلمة المرور بنجاح!' : 'Password changed successfully!'}
              <br />
              {language === 'ar' ? 'سيتم توجيهك لصفحة تسجيل الدخول الآن...' : 'Redirecting to login page now...'}
            </p>
          </div>
        ) : !sessionReady ? (
          <div className="text-center">
            <AppLoader text={language === 'ar' ? 'جاري التحقق من رابط الاستعادة...' : 'Verifying reset link...'} size={44} />
            <p className="text-xs text-slate-400 mt-4">
              {language === 'ar' 
                ? 'إذا لم يتم التحقق خلال ثوانٍ، يرجى التأكد من فتح الرابط الصحيح المرسل إلى بريدك الإلكتروني.'
                : 'If verification takes too long, make sure you opened the correct link from your email.'}
            </p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-semibold transition bg-transparent border-none cursor-pointer"
            >
              {language === 'ar' ? 'العودة لتسجيل الدخول' : 'Back to Login'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleUpdatePassword} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                {language === 'ar' ? 'كلمة المرور الجديدة' : 'New Password'}
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={`block w-full py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm outline-none transition ${language === 'ar' ? 'pr-10 pl-3' : 'pl-10 pr-3'}`}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoFocus
                />
                <div className={`absolute inset-y-0 flex items-center pointer-events-none ${language === 'ar' ? 'right-0 pr-3' : 'left-0 pl-3'}`}>
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {language === 'ar' ? '6 أحرف على الأقل' : 'At least 6 characters'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                {language === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm Password'}
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`block w-full py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm outline-none transition ${language === 'ar' ? 'pr-10 pl-3' : 'pl-10 pr-3'}`}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
                <div className={`absolute inset-y-0 flex items-center pointer-events-none ${language === 'ar' ? 'right-0 pr-3' : 'left-0 pl-3'}`}>
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition disabled:opacity-50 mt-4 cursor-pointer border-none"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (language === 'ar' ? 'تحديث كلمة المرور' : 'Update Password')}
            </button>

            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => navigate('/login', { replace: true })}
                className="text-sm text-slate-500 hover:text-blue-600 font-medium transition bg-transparent border-none cursor-pointer"
              >
                {language === 'ar' ? 'العودة لتسجيل الدخول' : 'Back to Login'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
