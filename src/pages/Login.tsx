import { useState, useRef, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Target, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refreshRole, user } = useAuth();
  const mounted = useRef(true);

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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const trimmedUsername = username.trim();
      const loginEmail = trimmedUsername.includes('@') ? trimmedUsername : `${trimmedUsername.toLowerCase().replace(/\s+/g, '_')}@taskflow.local`;
      
      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password: password,
        });
        
        if (signInError) throw signInError;

        // Delegate profile fetch/creation to AuthContext
        await refreshRole();
        toast.success("تم تسجيل الدخول بنجاح");
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: loginEmail,
          password: password,
          options: {
            data: {
              name: name || trimmedUsername,
              company_name: companyName.trim()
            }
          }
        });
        
        if (signUpError) {
          if (signUpError.message === 'User already registered') {
             setIsLogin(true);
             throw new Error('اسم المستخدم مسجل بالفعل. لقد قمنا بتحويلك لصفحة تسجيل الدخول، يرجى المحاولة الآن.');
          }
          throw signUpError;
        }
        
        if (!data.user) {
          throw new Error('فشل في إنشاء الحساب');
        }
        
        if (!data.session) {
          throw new Error('تم إنشاء الحساب بنجاح. إذا واجهت مشكلة، يرجى التأكد من تعطيل "Confirm Email" في إعدادات Supabase Auth.');
        }

        // Delegate profile fetch/creation to AuthContext
        await refreshRole();
        toast.success("تم إنشاء الحساب وتسجيل الدخول بنجاح");
      }
    } catch (err: any) {
      console.error(err);
      if (err.message) {
          if (err.message === 'User already registered') {
            toast.error('اسم المستخدم مسجل بالفعل. يرجى تسجيل الدخول.');
          } else if (err.message === 'Email not confirmed') {
            toast.error('اسم المستخدم غير مؤكد. يرجى تعطيل "Confirm Email" في إعدادات Supabase.');
          } else if (err.message.includes('relation "public.users" does not exist') || err.message.includes('relation "users" does not exist')) {
            toast.error('خطأ: جداول قاعدة البيانات غير موجودة. يرجى تنفيذ أوامر SQL الموجودة في ملف supabase_schema.sql في Supabase SQL Editor.', { duration: 5000 });
          } else {
            toast.error(err.message === 'Invalid login credentials' ? 'اسم المستخدم أو كلمة المرور غير صحيحة.' : err.message);
          }
      } else {
        toast.error('حدث خطأ أثناء المصادقة');
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4" dir="rtl">
      <div className="max-w-md w-full bg-white rounded-4xl shadow-sm border border-slate-200 p-8">
        <div className="text-center mb-10">
          <div className="mx-auto bg-blue-50 h-16 w-16 rounded-2xl flex items-center justify-center mb-6">
            <Target className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-3xl font-bold text-slate-900">TaskFlow</h2>
          <p className="text-slate-500 mt-2 font-medium">نظام متابعة المهام والزيارات</p>
        </div>
        
        <div>
          {!isSupabaseConfigured && (
            <div className="mb-6 bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 text-sm font-medium leading-relaxed">
              <strong>تنبيه هام:</strong> قاعدة البيانات غير متصلة! <br className="mb-2" />
              لإكمال تسجيل الدخول، يجب إضافة متغيرات البيئة <code>VITE_SUPABASE_URL</code> و <code>VITE_SUPABASE_ANON_KEY</code> في الإعدادات (Settings) أو عبر ملف <code>.env</code>.
            </div>
          )}
          <form onSubmit={handleAuth} className="space-y-5">
            {!isLogin && (
               <>
                 <div>
                   <label className="block text-sm font-semibold text-slate-700 mb-1.5">الاسم الكامل</label>
                   <div className="relative">
                     <input
                       type="text"
                       value={name}
                       onChange={(e) => setName(e.target.value)}
                       className="block w-full pl-3 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm outline-none transition"
                       placeholder="محمد أحمد"
                       required={!isLogin}
                     />
                   </div>
                 </div>
                 <div>
                   <label className="block text-sm font-semibold text-slate-700 mb-1.5">اسم الشركة</label>
                   <div className="relative">
                     <input
                       type="text"
                       value={companyName}
                       onChange={(e) => setCompanyName(e.target.value)}
                       className="block w-full pl-3 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm outline-none transition"
                       placeholder="شركة المقاولات الحديثة"
                       required={!isLogin}
                     />
                   </div>
                 </div>
               </>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">اسم المستخدم</label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-3 pr-10 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm outline-none transition"
                  placeholder="ahmed123"
                  required
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Target className="h-4 w-4 text-slate-400" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">كلمة المرور</label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-3 pr-10 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm outline-none transition"
                  placeholder="••••••••"
                  required
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !isSupabaseConfigured}
              className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition disabled:opacity-50 mt-8"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (isLogin ? 'تسجيل الدخول' : 'إنشاء حساب جديد وتثبيت الشركة')}
            </button>
          </form>

          <div className="mt-8 text-center pt-6 border-t border-slate-100">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
              }}
              className="text-sm text-blue-600 hover:text-blue-700 font-semibold transition"
            >
              {isLogin ? 'ليس لديك حساب؟ سجل شركتك الآن' : 'لديك حساب بالفعل؟ قم بتسجيل الدخول'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
