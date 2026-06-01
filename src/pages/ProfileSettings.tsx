import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowRight, Camera, Save, Lock, UserPlus, Shield, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import imageCompression from 'browser-image-compression';

export default function ProfileSettings() {
  const navigate = useNavigate();
  const { user, profile, refreshRole } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile fields
  const [name, setName] = useState(profile?.name || '');
  const [isUpdatingProfile, setUpdatingProfile] = useState(false);
  const [isUploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');

  // Password change fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setUpdatingPassword] = useState(false);

  // Manager registration fields (only visible to Managers)
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpEmail, setNewEmpEmail] = useState('');
  const [newEmpPassword, setNewEmpPassword] = useState('');
  const [newEmpRole, setNewEmpRole] = useState<'employee' | 'manager'>('employee');
  const [isRegistering, setRegistering] = useState(false);

  const isManager = profile?.role === 'manager';

  // 1. Update Profile (Name)
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('الاسم بالكامل مطلوب');
    
    setUpdatingProfile(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ name })
        .eq('id', user?.id);

      if (error) throw error;
      
      toast.success('تم تحديث الملف الشخصي بنجاح');
      await refreshRole();
    } catch (err: any) {
      toast.error(err.message || 'تعذر تحديث البيانات');
    } finally {
      setUpdatingProfile(false);
    }
  };

  // 2. Upload Avatar
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      // Compress avatar to under 100KB
      const options = {
        maxSizeMB: 0.1,
        maxWidthOrHeight: 300,
        useWebWorker: true,
        fileType: 'image/jpeg',
      };
      
      toast.loading('جاري معالجة وضغط الصورة...', { id: 'avatar-upload' });
      const compressedFile = await imageCompression(file, options);

      const fileExt = 'jpg';
      const fileName = `${user?.id}_${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage bucket 'avatars'
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, compressedFile, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Save to database profile
      const { error: dbError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', user?.id);

      if (dbError) throw dbError;

      setAvatarUrl(publicUrl);
      toast.success('تم تحديث الصورة الشخصية بنجاح', { id: 'avatar-upload' });
      await refreshRole();
    } catch (err: any) {
      toast.error(err.message || 'فشل رفع الصورة', { id: 'avatar-upload' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  // 3. Update Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) return toast.error('كلمة المرور يجب ألا تقل عن 6 أحرف');
    if (newPassword !== confirmPassword) return toast.error('كلمتا المرور غير متطابقتين');

    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast.success('تم تغيير كلمة المرور بنجاح');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'تعذر تغيير كلمة المرور');
    } finally {
      setUpdatingPassword(false);
    }
  };

  // 4. Register Employee (Manager only)
  const handleRegisterEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName.trim() || !newEmpEmail.trim() || !newEmpPassword.trim()) {
      return toast.error('يرجى ملء جميع الحقول المطلوبة');
    }
    if (newEmpPassword.length < 6) {
      return toast.error('كلمة المرور للموظف يجب ألا تقل عن 6 أحرف');
    }

    setRegistering(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`;
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newEmpName,
          email: newEmpEmail,
          password: newEmpPassword,
          role: newEmpRole
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'فشل تسجيل العضو الجديد');
      }

      toast.success(`تم تسجيل ${newEmpRole === 'manager' ? 'مدير' : 'موظف'} جديد بنجاح: ${newEmpName}`);
      setNewEmpName('');
      setNewEmpEmail('');
      setNewEmpPassword('');
    } catch (err: any) {
      toast.error(err.message || 'فشل تسجيل الحساب');
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-16" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center gap-4 sticky top-0 z-20 shadow-xs">
        <button 
          onClick={() => navigate(isManager ? '/manager' : '/employee')} 
          className="p-2 hover:bg-slate-50 border-none bg-transparent rounded-full transition-colors cursor-pointer"
        >
          <ArrowRight className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-800 m-0">إعدادات الحساب الشخصي</h1>
          <p className="text-xs text-slate-400 mt-0.5 m-0">إدارة معلومات الملف والصلاحيات</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
        
        {/* Avatar Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col sm:flex-row items-center gap-6">
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-blue-100 flex items-center justify-center bg-slate-100 text-slate-300">
              {avatarUrl ? (
                <img src={avatarUrl} alt="صورة الملف" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-bold text-blue-600">
                  {(profile?.name || user?.email || 'م')[0].toUpperCase()}
                </span>
              )}
            </div>
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleAvatarChange} 
              accept="image/*" 
              className="hidden" 
            />
          </div>
          
          <div className="text-center sm:text-right space-y-1">
            <h3 className="font-bold text-slate-900 text-base">{profile?.name || 'مستخدم جديد'}</h3>
            <p className="text-sm text-slate-500">{user?.email}</p>
            <div className="flex items-center gap-1.5 justify-center sm:justify-start text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full w-fit">
              <Shield className="w-3.5 h-3.5" />
              {isManager ? 'مدير النظام' : 'موظف ميداني'}
            </div>
          </div>
        </div>

        {/* Settings Forms Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Form 1: Edit profile details */}
          <form onSubmit={handleUpdateProfile} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
              <span className="w-7 h-7 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">ℹ️</span>
              <h3 className="font-bold text-slate-800 text-sm">تعديل الاسم</h3>
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">الاسم بالكامل</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-600 focus:outline-hidden text-sm"
                placeholder="أدخل اسمك بالكامل"
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={isUpdatingProfile}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white border-none py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isUpdatingProfile ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </button>
          </form>

          {/* Form 2: Change Password */}
          <form onSubmit={handleChangePassword} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
              <span className="w-7 h-7 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center text-sm font-bold">🔒</span>
              <h3 className="font-bold text-slate-800 text-sm">تغيير كلمة المرور</h3>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">كلمة المرور الجديدة</label>
              <input 
                type="password" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-600 focus:outline-hidden text-sm"
                placeholder="أدخل 6 أحرف على الأقل"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">تأكيد كلمة المرور</label>
              <input 
                type="password" 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-600 focus:outline-hidden text-sm"
                placeholder="أعد كتابة كلمة المرور"
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={isUpdatingPassword}
              className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white border-none py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              {isUpdatingPassword ? 'جاري التحديث...' : 'تحديث كلمة المرور'}
            </button>
          </form>

        </div>

        {/* Manager Section: Add Employee Form */}
        {isManager && (
          <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-100 shadow-xs space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
              <span className="w-8 h-8 bg-green-50 text-green-600 rounded-full flex items-center justify-center text-sm font-bold">➕</span>
              <div>
                <h3 className="font-bold text-slate-800 text-sm md:text-base">إضافة عضو جديد للفريق</h3>
                <p className="text-xs text-slate-400">توليد حساب موظف أو مدير جديد وإسناده مباشرة لقاعدة البيانات</p>
              </div>
            </div>

            <form onSubmit={handleRegisterEmployee} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">الاسم بالكامل</label>
                <input 
                  type="text" 
                  value={newEmpName} 
                  onChange={(e) => setNewEmpName(e.target.value)} 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-600 focus:outline-hidden text-sm"
                  placeholder="الاسم الثلاثي"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">البريد الإلكتروني</label>
                <input 
                  type="email" 
                  value={newEmpEmail} 
                  onChange={(e) => setNewEmpEmail(e.target.value)} 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-600 focus:outline-hidden text-sm"
                  placeholder="employee@domain.com"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">كلمة المرور الأولية</label>
                <input 
                  type="password" 
                  value={newEmpPassword} 
                  onChange={(e) => setNewEmpPassword(e.target.value)} 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-600 focus:outline-hidden text-sm"
                  placeholder="لا تقل عن 6 أحرف"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">الصلاحية والوظيفة</label>
                <select 
                  value={newEmpRole} 
                  onChange={(e) => setNewEmpRole(e.target.value as any)} 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-600 focus:outline-hidden text-sm bg-white"
                >
                  <option value="employee">موظف ميداني</option>
                  <option value="manager">مدير نظام</option>
                </select>
              </div>

              <div className="sm:col-span-2 pt-2">
                <button 
                  type="submit" 
                  disabled={isRegistering}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white border-none py-3 rounded-xl text-sm font-bold transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  {isRegistering ? 'جاري تسجيل العضو...' : 'تسجيل العضو الجديد'}
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
