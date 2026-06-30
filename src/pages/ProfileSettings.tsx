import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowRight, Camera, Save, Lock, UserPlus, Shield, CheckCircle, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import imageCompression from 'browser-image-compression';
import { useTranslation } from '../contexts/LanguageContext';
import { useActivityLog } from '../hooks/useActivityLog';
import { useBiometricAuth } from '../hooks/useBiometricAuth';
import { triggerHaptic } from '../lib/nativeServices';
import { useTheme } from '../contexts/ThemeContext';
import { useGeoLocation } from '../hooks/useGeoLocation';

export default function ProfileSettings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, refreshRole, company, signOut } = useAuth();
  const { getCoordinates, loading: isLocating } = useGeoLocation();
  const { logActivity } = useActivityLog();
  const { t, language, changeLanguage } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { isSupported: isBiometricSupported, isEnabled: isBiometricEnabled, registerBiometric, disableBiometric } = useBiometricAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete account states
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeletingAccount, setDeletingAccount] = useState(false);

  const handleDeleteAccount = async () => {
    const expectedText = language === 'ar' ? 'حذف الحساب' : 'DELETE ACCOUNT';
    if (confirmText !== expectedText) {
      toast.error(language === 'ar' ? 'يرجى كتابة نص التأكيد بشكل صحيح' : 'Please type the confirmation text correctly');
      return;
    }

    setDeletingAccount(true);
    try {
      const { error } = await supabase.rpc('delete_own_user');
      if (error) throw error;
      
      triggerHaptic('success');
      toast.success(language === 'ar' ? 'تم حذف حسابك بنجاح' : 'Your account has been deleted successfully');
      
      await signOut();
      navigate('/');
    } catch (err: any) {
      triggerHaptic('error');
      console.error('[Delete Own User Error]:', err);
      toast.error(err.message || (language === 'ar' ? 'حدث خطأ أثناء حذف الحساب' : 'Failed to delete account'));
    } finally {
      setDeletingAccount(false);
      setDeleteModalOpen(false);
    }
  };

  const handleToggleBiometrics = async () => {
    if (isBiometricEnabled) {
      await disableBiometric();
      triggerHaptic('success');
      toast.success(language === 'ar' ? 'تم إلغاء تفعيل البصمة' : 'Biometric login disabled');
    } else {
      try {
        const success = await registerBiometric(profile?.name || user?.email || 'User');
        if (success) {
          triggerHaptic('success');
          toast.success(language === 'ar' ? 'تم تفعيل الدخول بالبصمة بنجاح ✓' : 'Biometric login enabled successfully ✓');
        }
      } catch (err: any) {
        triggerHaptic('error');
        toast.error(err.message || (language === 'ar' ? 'فشل إعداد البصمة' : 'Failed to setup biometrics'));
      }
    }
  };

  // Profile fields
  const [name, setName] = useState(profile?.name || '');
  const [email, setEmail] = useState(profile?.email || user?.email || '');
  const [isUpdatingProfile, setUpdatingProfile] = useState(false);
  const [isUploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');

  // Company Settings fields
  const [companyName, setCompanyName] = useState(company?.name || '');
  const [logoUrl, setLogoUrl] = useState(company?.logoUrl || '');
  const [hqLatitude, setHqLatitude] = useState(company?.hqLatitude?.toString() || '');
  const [hqLongitude, setHqLongitude] = useState(company?.hqLongitude?.toString() || '');
  const [hqRadiusMeters, setHqRadiusMeters] = useState(company?.hqRadiusMeters?.toString() || '200');
  const [workStartTime, setWorkStartTime] = useState(company?.workStartTime || '08:00');
  const [workEndTime, setWorkEndTime] = useState(company?.workEndTime || '17:00');
  const [workDays, setWorkDays] = useState<string[]>(company?.workDays || ['Sun','Mon','Tue','Wed','Thu']);
  const [isUpdatingCompany, setUpdatingCompany] = useState(false);
  const [isUploadingLogo, setUploadingLogo] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  // Sync state with auth context values once loaded
  useEffect(() => {
    if (profile?.name) setName(profile.name);
    if (profile?.email || user?.email) setEmail(profile?.email || user?.email || '');
    if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);
    if (company?.name) setCompanyName(company.name);
    if (company?.logoUrl) setLogoUrl(company.logoUrl);
    if (company?.hqLatitude) setHqLatitude(company.hqLatitude.toString());
    if (company?.hqLongitude) setHqLongitude(company.hqLongitude.toString());
    if (company?.hqRadiusMeters) setHqRadiusMeters(company.hqRadiusMeters.toString());
    if (company?.workStartTime) setWorkStartTime(company.workStartTime);
    if (company?.workEndTime) setWorkEndTime(company.workEndTime);
    if (company?.workDays) setWorkDays(company.workDays);
  }, [profile, user, company]);

  // Scroll to register employee form if hash is present
  useEffect(() => {
    if (location.hash === '#register-employee') {
      const timer = setTimeout(() => {
        const element = document.getElementById('register-employee');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [location.hash, profile]);

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

  const isManager = profile?.role === 'manager' || profile?.role === 'super_admin';

  // 1. Update Profile (Name & Email)
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error(language === 'ar' ? 'الاسم بالكامل مطلوب' : 'Full name is required');
    if (!email.trim()) return toast.error(language === 'ar' ? 'البريد الإلكتروني مطلوب' : 'Email address is required');
    
    setUpdatingProfile(true);
    try {
      // Update public.users table
      const { error } = await supabase
        .from('users')
        .update({ name, email: email.trim() })
        .eq('id', user?.id);

      if (error) throw error;
      
      triggerHaptic('success');
      // Update auth user if email changed
      if (email.trim().toLowerCase() !== user?.email?.toLowerCase()) {
        const { error: authError } = await supabase.auth.updateUser({ email: email.trim() });
        if (authError) throw authError;
        toast.success(
          language === 'ar' 
            ? 'تم تحديث البيانات. يرجى تأكيد البريد الإلكتروني الجديد عبر الرابط المرسل إليه.'
            : 'Profile updated. Please verify your new email address via the link sent to it.'
        );
      } else {
        toast.success(language === 'ar' ? 'تم تحديث الملف الشخصي بنجاح' : 'Profile updated successfully');
      }
      
      await refreshRole();
    } catch (err: any) {
      triggerHaptic('error');
      toast.error(err.message || (language === 'ar' ? 'تعذر تحديث البيانات' : 'Could not update profile'));
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
      
      toast.loading(language === 'ar' ? 'جاري معالجة وضغط الصورة...' : 'Processing and compressing image...', { id: 'avatar-upload' });
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
      triggerHaptic('success');
      toast.success(language === 'ar' ? 'تم تحديث الصورة الشخصية بنجاح' : 'Profile picture updated successfully', { id: 'avatar-upload' });
      await refreshRole();
    } catch (err: any) {
      triggerHaptic('error');
      toast.error(err.message || (language === 'ar' ? 'فشل رفع الصورة' : 'Failed to upload image'), { id: 'avatar-upload' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  // 3. Update Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) return toast.error(language === 'ar' ? 'كلمة المرور يجب ألا تقل عن 6 أحرف' : 'Password must be at least 6 characters');
    if (newPassword !== confirmPassword) return toast.error(language === 'ar' ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');

    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      triggerHaptic('success');
      toast.success(language === 'ar' ? 'تم تغيير كلمة المرور بنجاح' : 'Password updated successfully');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      triggerHaptic('error');
      toast.error(err.message || (language === 'ar' ? 'تعذر تغيير كلمة المرور' : 'Could not change password'));
    } finally {
      setUpdatingPassword(false);
    }
  };

  // 3.5. Update Company Settings (Manager only)
  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return toast.error(language === 'ar' ? 'اسم الشركة مطلوب' : 'Company name is required');
    if (!company?.id) return;

    setUpdatingCompany(true);
    try {
      const { error } = await supabase
        .from('companies')
        .update({
          name: companyName.trim(),
          hq_latitude: hqLatitude ? Number(hqLatitude) : null,
          hq_longitude: hqLongitude ? Number(hqLongitude) : null,
          hq_radius_meters: hqRadiusMeters ? Number(hqRadiusMeters) : 200,
          work_start_time: workStartTime || null,
          work_end_time: workEndTime || null,
          work_days: workDays
        })
        .eq('id', company.id);

      if (error) throw error;

      logActivity('company_settings_updated', 'company', company.id, { 
        name: companyName.trim(),
        hq_latitude: hqLatitude ? Number(hqLatitude) : null,
        hq_longitude: hqLongitude ? Number(hqLongitude) : null,
        hq_radius_meters: hqRadiusMeters ? Number(hqRadiusMeters) : 200,
        work_start_time: workStartTime,
        work_end_time: workEndTime,
        work_days: workDays
      });
      triggerHaptic('success');
      toast.success(language === 'ar' ? 'تم تحديث إعدادات الشركة بنجاح' : 'Company settings updated successfully');
      await refreshRole();
    } catch (err: any) {
      triggerHaptic('error');
      toast.error(err.message || (language === 'ar' ? 'تعذر تحديث إعدادات الشركة' : 'Could not update company settings'));
    } finally {
      setUpdatingCompany(false);
    }
  };

  const handleFetchCurrentCoords = async () => {
    const toastId = toast.loading(language === 'ar' ? 'جاري جلب إحداثيات موقعك الحالي...' : 'Fetching your current GPS coordinates...');
    try {
      const coords = await getCoordinates();
      setHqLatitude(coords.latitude.toString());
      setHqLongitude(coords.longitude.toString());
      toast.success(language === 'ar' ? 'تم جلب الإحداثيات بنجاح' : 'Coordinates fetched successfully', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || (language === 'ar' ? 'فشل جلب الموقع الجغرافي' : 'Failed to get location'), { id: toastId });
    }
  };

  const toggleWorkDay = (day: string) => {
    if (workDays.includes(day)) {
      setWorkDays(workDays.filter(d => d !== day));
    } else {
      setWorkDays([...workDays, day]);
    }
  };

  // 3.6. Upload Company Logo (Manager only)
  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!company?.id) return;

    setUploadingLogo(true);
    try {
      // Compress logo to under 150KB
      const options = {
        maxSizeMB: 0.15,
        maxWidthOrHeight: 400,
        useWebWorker: true,
        fileType: 'image/jpeg',
      };
      
      toast.loading(language === 'ar' ? 'جاري معالجة وضغط الشعار...' : 'Processing and compressing logo...', { id: 'logo-upload' });
      const compressedFile = await imageCompression(file, options);

      const fileExt = 'jpg';
      const fileName = `${company.id}_${Date.now()}.${fileExt}`;
      const filePath = `company-logos/${fileName}`;

      // Upload to Supabase Storage bucket 'avatars' (public bucket)
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, compressedFile, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Save to database companies table
      const { error: dbError } = await supabase
        .from('companies')
        .update({ logo_url: publicUrl })
        .eq('id', company.id);

      if (dbError) throw dbError;

      logActivity('company_settings_updated', 'company', company.id, { logoUrl: publicUrl });
      setLogoUrl(publicUrl);
      triggerHaptic('success');
      toast.success(language === 'ar' ? 'تم تحديث شعار الشركة بنجاح' : 'Company logo updated successfully', { id: 'logo-upload' });
      await refreshRole();
    } catch (err: any) {
      triggerHaptic('error');
      toast.error(err.message || (language === 'ar' ? 'فشل رفع الشعار' : 'Failed to upload logo'), { id: 'logo-upload' });
    } finally {
      setUploadingLogo(false);
    }
  };

  // 4. Register Employee (Manager only)
  const handleRegisterEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName.trim() || !newEmpEmail.trim() || !newEmpPassword.trim()) {
      return toast.error(language === 'ar' ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmpEmail.trim())) {
      return toast.error(language === 'ar' ? 'يرجى إدخال بريد إلكتروني صحيح للموظف' : 'Please enter a valid email address');
    }
    if (newEmpPassword.length < 6) {
      return toast.error(language === 'ar' ? 'كلمة المرور للموظف يجب ألا تقل عن 6 أحرف' : 'Password must be at least 6 characters');
    }

    setRegistering(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          name: newEmpName,
          email: newEmpEmail,
          password: newEmpPassword,
          role: newEmpRole
        }
      });

      if (error) {
        throw new Error(error.message || (language === 'ar' ? 'فشل تسجيل العضو الجديد' : 'Failed to register team member'));
      }
      
      if (data?.error) {
        throw new Error(data.error);
      }

      logActivity('employee_added', 'user', data?.user?.id || null, { name: newEmpName, email: newEmpEmail, role: newEmpRole });
      triggerHaptic('success');
      toast.success(
        language === 'ar' 
          ? `تم تسجيل ${newEmpRole === 'manager' ? 'مدير' : 'موظف'} جديد بنجاح: ${newEmpName}`
          : `Successfully registered new ${newEmpRole === 'manager' ? 'manager' : 'employee'}: ${newEmpName}`
      );
      setNewEmpName('');
      setNewEmpEmail('');
      setNewEmpPassword('');
    } catch (err: any) {
      triggerHaptic('error');
      toast.error(err.message || (language === 'ar' ? 'فشل تسجيل الحساب' : 'Failed to register account'));
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-16" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-6 pb-4 safe-pt flex items-center gap-4 sticky top-0 z-20 shadow-xs">
        <button 
          onClick={() => {
            if (profile?.role === 'super_admin') {
              navigate('/super-admin');
            } else if (profile?.role === 'manager') {
              navigate('/manager');
            } else {
              navigate('/employee');
            }
          }} 
          className="p-2 hover:bg-slate-50 border-none bg-transparent rounded-full transition-colors cursor-pointer"
        >
          <ArrowRight className={`w-5 h-5 text-slate-600 ${language === 'en' ? 'rotate-180' : ''}`} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-800 m-0">
            {language === 'ar' ? 'إعدادات الحساب الشخصي' : 'Account Settings'}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 m-0">
            {language === 'ar' ? 'إدارة معلومات الملف والصلاحيات' : 'Manage Profile Info & Permissions'}
          </p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
        
        {/* Avatar Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col sm:flex-row items-center gap-6">
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-blue-100 flex items-center justify-center bg-slate-100 text-slate-300">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-bold text-blue-600">
                  {(profile?.name || user?.email || 'M')[0].toUpperCase()}
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
          
          <div className={`text-center ${language === 'ar' ? 'sm:text-right' : 'sm:text-left'} space-y-1`}>
            <h3 className="font-bold text-slate-900 text-base">{profile?.name || (language === 'ar' ? 'مستخدم جديد' : 'New User')}</h3>
            <p className="text-sm text-slate-500">{user?.email}</p>
            {profile?.email && user?.email && profile.email.toLowerCase() !== user.email.toLowerCase() && (
              <span className="text-xs text-amber-600 block font-semibold">
                {language === 'ar' 
                  ? `⏳ بانتظار تأكيد البريد الجديد: ${profile.email}`
                  : `⏳ Waiting for new email verification: ${profile.email}`}
              </span>
            )}
            <div className="flex items-center gap-1.5 justify-center sm:justify-start text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full w-fit">
              <Shield className="w-3.5 h-3.5" />
              {profile?.role === 'super_admin' 
                ? (language === 'ar' ? 'مشرف المنصة' : 'Super Admin') 
                : profile?.role === 'manager' 
                  ? (language === 'ar' ? 'مدير النظام' : 'Manager') 
                  : (language === 'ar' ? 'موظف ميداني' : 'Field Employee')}
            </div>
          </div>
        </div>

        {/* Settings Forms Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Form 1: Edit profile details */}
          <form onSubmit={handleUpdateProfile} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
              <span className="w-7 h-7 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">ℹ️</span>
              <h3 className="font-bold text-slate-800 text-sm">
                {language === 'ar' ? 'بيانات الملف الشخصي' : 'Profile Details'}
              </h3>
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">
                {language === 'ar' ? 'الاسم بالكامل' : 'Full Name'}
              </label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-600 focus:outline-hidden text-sm"
                placeholder={language === 'ar' ? 'أدخل اسمك بالكامل' : 'Enter your full name'}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">
                {language === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
              </label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-600 focus:outline-hidden text-sm"
                placeholder={language === 'ar' ? 'أدخل البريد الإلكتروني الجديد' : 'Enter new email address'}
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={isUpdatingProfile}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white border-none py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isUpdatingProfile ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (language === 'ar' ? 'حفظ التعديلات' : 'Save Changes')}
            </button>
          </form>

          {/* Form 2: Change Password */}
          <form onSubmit={handleChangePassword} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
              <span className="w-7 h-7 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center text-sm font-bold">🔒</span>
              <h3 className="font-bold text-slate-800 text-sm">
                {language === 'ar' ? 'تغيير كلمة المرور' : 'Change Password'}
              </h3>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">
                {language === 'ar' ? 'كلمة المرور الجديدة' : 'New Password'}
              </label>
              <input 
                type="password" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-600 focus:outline-hidden text-sm"
                placeholder={language === 'ar' ? 'أدخل 6 أحرف على الأقل' : 'At least 6 characters'}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">
                {language === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm Password'}
              </label>
              <input 
                type="password" 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-600 focus:outline-hidden text-sm"
                placeholder={language === 'ar' ? 'أعد كتابة كلمة المرور' : 'Retype password'}
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={isUpdatingPassword}
              className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white border-none py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              {isUpdatingPassword ? (language === 'ar' ? 'جاري التحديث...' : 'Updating...') : (language === 'ar' ? 'تحديث كلمة المرور' : 'Update Password')}
            </button>
          </form>

          {/* Form 3: Application Settings (Language & Theme Switcher) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
              <span className="w-7 h-7 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center text-sm font-bold">⚙️</span>
              <h3 className="font-bold text-slate-800 text-sm">
                {language === 'ar' ? 'إعدادات التطبيق' : 'Application Settings'}
              </h3>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500">
                {language === 'ar' ? 'لغة التطبيق' : 'App Language'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => changeLanguage('ar')}
                  className={`py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    language === 'ar'
                      ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  العربية
                </button>
                <button
                  type="button"
                  onClick={() => changeLanguage('en')}
                  className={`py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    language === 'en'
                      ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  English
                </button>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-50">
              <label className="text-xs font-semibold text-slate-500">
                {language === 'ar' ? 'مظهر التطبيق' : 'App Appearance'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center justify-center gap-1.5 ${
                    theme === 'light'
                      ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  ☀️ {language === 'ar' ? 'مضيء' : 'Light'}
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center justify-center gap-1.5 ${
                    theme === 'dark'
                      ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  🌙 {language === 'ar' ? 'داكن' : 'Dark'}
                </button>
              </div>
            </div>

            {isBiometricSupported && (
              <div className="space-y-2 pt-2 border-t border-slate-50">
                <label className="text-xs font-semibold text-slate-500">
                  {language === 'ar' ? 'تسجيل الدخول بالبصمة' : 'Biometric Login'}
                </label>
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {language === 'ar' 
                      ? 'تفعيل تسجيل الدخول السريع ببصمة الوجه / الأصبع' 
                      : 'Enable quick login with Face ID / Touch ID'}
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleBiometrics}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer shrink-0 ${
                      isBiometricEnabled
                        ? 'bg-green-600 border-green-600 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {isBiometricEnabled 
                      ? (language === 'ar' ? 'مفعّل ✓' : 'Enabled ✓') 
                      : (language === 'ar' ? 'تفعيل' : 'Enable')}
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Manager Section: Add Employee Form */}
        {isManager && (
          <div id="register-employee" className="bg-white p-6 md:p-8 rounded-2xl border border-slate-100 shadow-xs space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
              <span className="w-8 h-8 bg-green-50 text-green-600 rounded-full flex items-center justify-center text-sm font-bold">➕</span>
              <div>
                <h3 className="font-bold text-slate-800 text-sm md:text-base">
                  {language === 'ar' ? 'إضافة عضو جديد للفريق' : 'Add New Team Member'}
                </h3>
                <p className="text-xs text-slate-400">
                  {language === 'ar' 
                    ? 'توليد حساب موظف أو مدير جديد وإسناده مباشرة لقاعدة البيانات' 
                    : 'Create a new manager or employee account and add them to the database'}
                </p>
              </div>
            </div>

            <form onSubmit={handleRegisterEmployee} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">
                  {language === 'ar' ? 'الاسم بالكامل' : 'Full Name'}
                </label>
                <input 
                  type="text" 
                  value={newEmpName} 
                  onChange={(e) => setNewEmpName(e.target.value)} 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-600 focus:outline-hidden text-sm"
                  placeholder={language === 'ar' ? 'الاسم الثلاثي' : 'Enter full name'}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">
                  {language === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
                </label>
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
                <label className="text-xs font-semibold text-slate-500">
                  {language === 'ar' ? 'كلمة المرور الأولية' : 'Initial Password'}
                </label>
                <input 
                  type="password" 
                  value={newEmpPassword} 
                  onChange={(e) => setNewEmpPassword(e.target.value)} 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-600 focus:outline-hidden text-sm"
                  placeholder={language === 'ar' ? 'لا تقل عن 6 أحرف' : 'At least 6 characters'}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">
                  {language === 'ar' ? 'الصلاحية والوظيفة' : 'Role & Permission'}
                </label>
                <select 
                  value={newEmpRole} 
                  onChange={(e) => setNewEmpRole(e.target.value as any)} 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-600 focus:outline-hidden text-sm bg-white"
                >
                  <option value="employee">{language === 'ar' ? 'موظف ميداني' : 'Field Employee'}</option>
                  <option value="manager">{language === 'ar' ? 'مدير نظام' : 'System Manager'}</option>
                </select>
              </div>

              <div className="sm:col-span-2 pt-2">
                <button 
                  type="submit" 
                  disabled={isRegistering}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white border-none py-3 rounded-xl text-sm font-bold transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  {isRegistering 
                    ? (language === 'ar' ? 'جاري تسجيل العضو...' : 'Registering member...') 
                    : (language === 'ar' ? 'تسجيل العضو الجديد' : 'Register New Member')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Manager Section: Company Settings & Subscription Plan */}
        {isManager && company && (
          <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-100 shadow-xs space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
              <span className="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">🏢</span>
              <div>
                <h3 className="font-bold text-slate-800 text-sm md:text-base">
                  {language === 'ar' ? 'إعدادات الشركة والاشتراك' : 'Company & Subscription Settings'}
                </h3>
                <p className="text-xs text-slate-400">
                  {language === 'ar' 
                    ? 'إدارة معلومات المنشأة وحالة باقة الاشتراك الحالية' 
                    : 'Manage facility details and current subscription package'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-400 block mb-1">
                  {language === 'ar' ? 'باقة الاشتراك' : 'Subscription Plan'}
                </span>
                <span className="font-bold text-slate-800 text-sm capitalize">{company.plan}</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-400 block mb-1">
                  {language === 'ar' ? 'الحد الأقصى للموظفين' : 'Max Employees'}
                </span>
                <span className="font-bold text-slate-800 text-sm">
                  {company.maxEmployees} {language === 'ar' ? 'موظف' : 'employees'}
                </span>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-400 block mb-1">
                  {language === 'ar' ? 'حالة الاشتراك' : 'Subscription Status'}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-0.5 rounded-full mt-1">
                  <CheckCircle className="w-3 h-3" /> {language === 'ar' ? 'نشط' : 'Active'}
                </span>
              </div>
            </div>

            {/* Logo Upload Card Section */}
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="relative group cursor-pointer shrink-0" onClick={() => logoFileInputRef.current?.click()}>
                <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center bg-white text-slate-300">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold text-blue-600">🏢</span>
                  )}
                </div>
                <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-4 h-4 text-white" />
                </div>
                <input 
                  type="file" 
                  ref={logoFileInputRef} 
                  onChange={handleLogoChange} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>
              <div className={`text-center ${language === 'ar' ? 'sm:text-right' : 'sm:text-left'}`}>
                <h4 className="font-bold text-slate-800 text-sm m-0">
                  {language === 'ar' ? 'شعار المؤسسة' : 'Company Logo'}
                </h4>
                <p className="text-[10px] text-slate-400 mt-1 mb-0 leading-relaxed">
                  {language === 'ar' 
                    ? 'انقر على المربع لتعديل الشعار أو رفعه (حجم أقصى 150 كيلوبايت، صيغ png, jpg, jpeg)'
                    : 'Click box to update logo (max size 150KB, formats: png, jpg, jpeg)'}
                </p>
              </div>
            </div>

            <form onSubmit={handleUpdateCompany} className="space-y-6 pt-2">
              {/* Company Name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">
                  {language === 'ar' ? 'اسم الشركة' : 'Company Name'}
                </label>
                <input 
                  type="text" 
                  value={companyName} 
                  onChange={(e) => setCompanyName(e.target.value)} 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-600 focus:outline-hidden text-sm bg-slate-50 focus:bg-white transition"
                  placeholder={language === 'ar' ? 'اسم الشركة' : 'Company Name'}
                  required
                />
              </div>

              {/* HQ Coordinates & Geofencing */}
              <div className="space-y-3 pt-3 border-t border-slate-50">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <span>{language === 'ar' ? 'الموقع الجغرافي للمقر الرئيسي' : 'HQ Geolocation Coordinates'}</span>
                  </h4>
                  <button
                    type="button"
                    onClick={handleFetchCurrentCoords}
                    disabled={isLocating}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 border-none px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1"
                  >
                    {isLocating ? (
                      <>
                        <span className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
                        {language === 'ar' ? 'جاري التحديد...' : 'Locating...'}
                      </>
                    ) : (
                      <>
                        <span>📍</span>
                        {language === 'ar' ? 'موقعي الحالي' : 'Use Current'}
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400">خط العرض (Latitude)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 24.7136"
                      value={hqLatitude}
                      onChange={(e) => setHqLatitude(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:outline-hidden focus:border-blue-600 transition"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400">خط الطول (Longitude)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 46.6753"
                      value={hqLongitude}
                      onChange={(e) => setHqLongitude(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:outline-hidden focus:border-blue-600 transition"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">{language === 'ar' ? 'نطاق الحضور الجغرافي (متر)' : 'Geofence Radius (meters)'}</label>
                  <select
                    value={hqRadiusMeters}
                    onChange={(e) => setHqRadiusMeters(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-hidden focus:border-blue-600 transition"
                  >
                    <option value="50">50 {language === 'ar' ? 'متر' : 'meters'}</option>
                    <option value="100">100 {language === 'ar' ? 'متر' : 'meters'}</option>
                    <option value="200">200 {language === 'ar' ? 'متر (موصى به)' : 'meters (Recommended)'}</option>
                    <option value="500">500 {language === 'ar' ? 'متر' : 'meters'}</option>
                    <option value="1000">1000 {language === 'ar' ? 'متر (1 كم)' : 'meters (1 km)'}</option>
                  </select>
                </div>
              </div>

              {/* Shift Hours & Days */}
              <div className="space-y-3 pt-3 border-t border-slate-50">
                <h4 className="font-bold text-slate-800 text-xs">
                  {language === 'ar' ? 'أوقات وأيام العمل الرسمية' : 'Working Hours & Shifts'}
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400">{language === 'ar' ? 'وقت بدء المناوبة' : 'Shift Start Time'}</label>
                    <input
                      type="time"
                      value={workStartTime}
                      onChange={(e) => setWorkStartTime(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:outline-hidden focus:border-blue-600 transition"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400">{language === 'ar' ? 'وقت نهاية المناوبة' : 'Shift End Time'}</label>
                    <input
                      type="time"
                      value={workEndTime}
                      onChange={(e) => setWorkEndTime(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:outline-hidden focus:border-blue-600 transition"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-400">{language === 'ar' ? 'أيام الدوام الأسبوعية' : 'Weekly Working Days'}</label>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      { id: 'Sun', ar: 'ح', en: 'Su' },
                      { id: 'Mon', ar: 'ن', en: 'Mo' },
                      { id: 'Tue', ar: 'ث', en: 'Tu' },
                      { id: 'Wed', ar: 'ر', en: 'We' },
                      { id: 'Thu', ar: 'خ', en: 'Th' },
                      { id: 'Fri', ar: 'ج', en: 'Fr' },
                      { id: 'Sat', ar: 'س', en: 'Sa' }
                    ]).map(day => {
                      const isSelected = workDays.includes(day.id);
                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => toggleWorkDay(day.id)}
                          className={`w-9 h-9 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-blue-600 border-blue-600 text-white shadow-xs' 
                              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          {language === 'ar' ? day.ar : day.en}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button 
                type="submit" 
                disabled={isUpdatingCompany}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white border-none py-3 rounded-xl text-sm font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
              >
                <Save className="w-4 h-4" />
                {isUpdatingCompany ? (language === 'ar' ? 'جاري حفظ الإعدادات...' : 'Saving settings...') : (language === 'ar' ? 'حفظ إعدادات الشركة' : 'Save Company Settings')}
              </button>
            </form>
          </div>
        )}

        {/* Delete Account Section */}
        <div className="bg-red-50 dark:bg-rose-950/20 p-6 rounded-2xl border border-red-100 dark:border-rose-900/30 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-red-200/50 dark:border-rose-900/30">
            <span className="w-8 h-8 bg-red-100 dark:bg-rose-900/50 text-red-600 dark:text-rose-400 rounded-full flex items-center justify-center text-sm font-bold">⚠️</span>
            <div>
              <h3 className="font-bold text-red-800 dark:text-rose-400 text-sm md:text-base">
                {language === 'ar' ? 'منطقة الخطر: حذف الحساب' : 'Danger Zone: Delete Account'}
              </h3>
              <p className="text-xs text-red-600 dark:text-rose-500">
                {language === 'ar' 
                  ? 'بمجرد حذف حسابك، سيتم مسح كافة البيانات بشكل نهائي ولا يمكن استعادتها.' 
                  : 'Once deleted, all your data will be permanently erased and cannot be recovered.'}
              </p>
            </div>
          </div>
          <div>
            <button
              type="button"
              onClick={() => setDeleteModalOpen(true)}
              className="bg-red-600 hover:bg-red-700 text-white border-none py-3 px-6 rounded-xl text-sm font-bold transition-colors cursor-pointer shadow-sm w-full sm:w-auto"
            >
              {language === 'ar' ? 'حذف الحساب نهائياً' : 'Permanently Delete Account'}
            </button>
          </div>
        </div>

      </div>

      {/* Delete Account Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-rose-900/50 text-red-600 dark:text-rose-400 rounded-full flex items-center justify-center text-xl mx-auto">
                ⚠️
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {language === 'ar' ? 'هل أنت متأكد تماماً؟' : 'Are you absolutely sure?'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {language === 'ar'
                    ? 'سيؤدي هذا الإجراء إلى حذف جميع سجلات الدخول والزيارات والبيانات المنسوبة إليك نهائياً من النظام.'
                    : 'This action will permanently purge all your logins, visits, and data from the system.'}
                </p>
                <p className="text-xs font-bold text-red-600 dark:text-rose-400 bg-red-50 dark:bg-rose-950/20 p-2.5 rounded-lg border border-red-100 dark:border-rose-950/30">
                  {language === 'ar'
                    ? `لتأكيد الحذف، يرجى كتابة "حذف الحساب" في الحقل أدناه:`
                    : `To confirm, please type "DELETE ACCOUNT" in the field below:`}
                </p>
              </div>

              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={language === 'ar' ? 'اكتب عبارة التأكيد هنا' : 'Type confirmation text here'}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-red-600 focus:outline-hidden text-sm text-center bg-slate-50 dark:bg-slate-950 font-bold"
              />

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setDeleteModalOpen(false); setConfirmText(''); }}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold border-none cursor-pointer transition-colors"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={confirmText !== (language === 'ar' ? 'حذف الحساب' : 'DELETE ACCOUNT') || isDeletingAccount}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl text-sm font-semibold border-none cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-md shadow-red-200 dark:shadow-none"
                >
                  {isDeletingAccount ? (language === 'ar' ? 'جاري الحذف...' : 'Deleting...') : (language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
