import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MapPin, Cloud, BarChart3, Users, ArrowLeft, 
  CheckCircle, Shield, Smartphone, Download, 
  Share, Check, Clock, Eye, AlertCircle,
  ClipboardList, CheckSquare
} from 'lucide-react';
import { useTranslation } from '../contexts/LanguageContext';
import AppLogo from '../components/AppLogo';

export default function LandingPage() {
  const navigate = useNavigate();
  const { t, language, changeLanguage } = useTranslation();
  const [downloadPlatform, setDownloadPlatform] = useState<'android' | 'ios'>('android');
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  // Dynamically generate a scanable QR code pointing to the current domain URL
  useEffect(() => {
    const currentOrigin = window.location.origin;
    const size = 160;
    setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&color=0f172a&data=${encodeURIComponent(currentOrigin)}`);
  }, []);

  const handleGoToAuth = (isLogin: boolean) => {
    navigate('/login', { state: { isLogin } });
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 selection:bg-blue-600 selection:text-white overflow-x-hidden relative font-sans" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      
      {/* Structural Thin Grid Overlay - Clean Blueprint Vibe */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#111827_1px,transparent_1px),linear-gradient(to_bottom,#111827_1px,transparent_1px)] bg-size-[4rem_4rem] mask-[radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none z-0 opacity-80" />
      
      {/* Light Source Mesh - Restrained Soft Blue Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[350px] bg-blue-500/4 rounded-full blur-[120px] pointer-events-none z-0" />

      {/* Header / Navbar */}
      <header className="border-b border-slate-900/60 backdrop-blur-md sticky top-0 z-50 bg-[#080c14]/75">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <AppLogo size={30} theme="dark" />
          
          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              onClick={() => changeLanguage(language === 'ar' ? 'en' : 'ar')}
              className="text-[10px] sm:text-xs font-semibold bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800/80 text-slate-300 px-2 sm:px-3.5 py-1.5 sm:py-2 rounded-xl transition-all cursor-pointer font-outfit"
            >
              <span className="sm:inline hidden">{language === 'ar' ? 'English' : 'العربية'}</span>
              <span className="inline sm:hidden">{language === 'ar' ? 'EN' : 'AR'}</span>
            </button>
            <button 
              onClick={() => handleGoToAuth(true)}
              className="text-xs sm:text-sm font-semibold text-slate-300 hover:text-white transition-colors px-2 sm:px-4 py-2 cursor-pointer bg-transparent border-none"
            >
              {t.landing.login}
            </button>
            <button 
              onClick={() => handleGoToAuth(false)}
              className="hidden sm:block bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all cursor-pointer border-none shadow-lg shadow-blue-900/25"
            >
              {t.landing.startFree}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section - Asymmetric Split */}
      <section className="relative pt-12 pb-24 md:pt-20 md:pb-32 px-4 sm:px-6 z-10 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          
          {/* Hero Left Content */}
          <div className="lg:col-span-6 space-y-8 text-center lg:text-start">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] sm:text-xs font-semibold px-4 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span>{t.landing.subtitle}</span>
            </div>
            
            <h1 className="text-3xl sm:text-5xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight text-white">
              {language === 'ar' ? (
                <>
                  تابع فريقك الميداني وتأكد من <span className="text-blue-500">إنجاز المهام بدقة</span>
                </>
              ) : (
                <>
                  Track Your Field Team & Ensure <span className="text-blue-500">Accurate Completion</span>
                </>
              )}
            </h1>
            
            <p className="text-sm sm:text-base md:text-lg text-slate-400 leading-relaxed font-normal max-w-xl mx-auto lg:mx-0">
              {t.landing.desc}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
              <button 
                onClick={() => handleGoToAuth(false)}
                className={`w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white text-sm sm:text-base font-bold px-8 py-3.5 rounded-xl transition-all flex items-center justify-center gap-3 cursor-pointer border-none shadow-xl shadow-blue-900/20 ${language === 'en' ? 'flex-row-reverse' : ''}`}
              >
                <span>{t.landing.startFreeNow}</span>
                <ArrowLeft className={`w-4 h-4 ${language === 'en' ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Asymmetrical Trust Badge */}
            <div className="pt-6 border-t border-slate-900/80 flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start">
              <div className="flex -space-x-2 rtl:space-x-reverse">
                <span className="w-7 h-7 rounded-full bg-slate-800 border border-slate-950 flex items-center justify-center text-[9px] font-bold text-slate-400">🏢</span>
                <span className="w-7 h-7 rounded-full bg-slate-800 border border-slate-950 flex items-center justify-center text-[9px] font-bold text-slate-400">🚗</span>
                <span className="w-7 h-7 rounded-full bg-slate-800 border border-slate-950 flex items-center justify-center text-[9px] font-bold text-slate-400">⚙️</span>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                {language === 'ar' ? 'حائز على ثقة أكثر من 100+ من المشرفين الميدانيين' : 'Trusted by over 100+ field operations managers'}
              </span>
            </div>
          </div>

          {/* Hero Right Visual - Floating Manager Screen */}
          <div className="lg:col-span-6 flex justify-center lg:justify-end relative">
            <div className="w-full max-w-[540px] bg-[#0d131f] border border-slate-800/80 rounded-2xl shadow-2xl p-4 sm:p-5 relative transform lg:rotate-1 hover:rotate-0 transition-transform duration-500 select-none">
              {/* Fake Browser Top Bar */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-900 mb-4">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                </div>
                <span className="text-[10px] text-slate-500 font-semibold font-outfit">taskflow.app/dashboard</span>
                <div className="w-4" />
              </div>

              {/* Fake Live Statistics */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-slate-950/50 border border-slate-900 rounded-xl p-3">
                  <span className="text-[9px] text-slate-500 block font-bold">{language === 'ar' ? 'نسبة الإنجاز' : 'Comp. Rate'}</span>
                  <span className="text-base font-extrabold text-blue-500 block mt-1 font-outfit">98.4%</span>
                </div>
                <div className="bg-slate-950/50 border border-slate-900 rounded-xl p-3">
                  <span className="text-[9px] text-slate-500 block font-bold">{language === 'ar' ? 'الحضور الميداني' : 'Field Check-in'}</span>
                  <span className="text-base font-extrabold text-green-500 block mt-1 font-outfit">12 {language === 'ar' ? 'نشط' : 'Active'}</span>
                </div>
                <div className="bg-slate-950/50 border border-slate-900 rounded-xl p-3">
                  <span className="text-[9px] text-slate-500 block font-bold">{language === 'ar' ? 'معلق ومحلي' : 'Queued'}</span>
                  <span className="text-base font-extrabold text-slate-300 block mt-1 font-outfit">0</span>
                </div>
              </div>

              {/* Fake Map Layout */}
              <div className="bg-slate-950 border border-slate-900 rounded-xl p-3 h-44 relative overflow-hidden flex flex-col justify-between">
                <div className="flex justify-between items-center z-10">
                  <span className="text-[10px] font-bold text-slate-300 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-500" />
                    {language === 'ar' ? 'تتبع فوري لمواقع المهام' : 'Real-time GPS Dispatch'}
                  </span>
                  <span className="text-[8px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">LIVE MAP</span>
                </div>
                <div className="absolute inset-0 top-8 opacity-25 flex flex-col justify-around pointer-events-none px-4">
                  <div className="h-px w-full bg-slate-700" />
                  <div className="h-px w-full bg-slate-700" />
                  <div className="h-full w-px bg-slate-700 absolute left-1/3" />
                  <div className="h-full w-px bg-slate-700 absolute left-2/3" />
                </div>
                <div className="absolute top-1/3 left-1/3 z-10 flex flex-col items-center">
                  <div className="relative flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-600" />
                  </div>
                  <span className="bg-slate-900 border border-slate-800 text-[8px] text-white font-bold px-1.5 py-0.5 rounded-md mt-1 shadow-md whitespace-nowrap">
                    {language === 'ar' ? 'أحمد محمد (في الموقع)' : 'Ahmed M. (On site)'}
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Bento Grid Features Section - Handcrafted look */}
      <section className="py-24 px-4 sm:px-6 border-t border-slate-900/60 bg-[#080c14]/40 relative z-10">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-extrabold md:text-4xl text-white tracking-tight">
              {t.landing.featuresTitle}
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto text-xs sm:text-sm font-medium">
              {t.landing.featuresSubtitle}
            </p>
          </div>

          {/* Bento Box Layout */}
          <div className="grid md:grid-cols-3 gap-6">
            
            {/* Card A: GPS Geofenced Attendance (Wide) */}
            <div className="md:col-span-2 bg-[#0d131f]/60 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700/60 transition-all group min-h-[280px]">
              <div>
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <MapPin className="w-5 h-5 text-blue-500" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{t.landing.features.gpsTitle}</h3>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed max-w-xl">{t.landing.features.gpsDesc}</p>
              </div>

              {/* Mini Static Interactive Mockup inside the card */}
              <div className="mt-6 bg-slate-950/80 border border-slate-900 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-sm">👤</span>
                  <div>
                    <span className="font-bold text-slate-200 block">أحمد محمد (مندوب ميداني)</span>
                    <span className="text-[10px] text-slate-500 font-outfit">Accuracy: +/- 4 meters</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    {language === 'ar' ? 'داخل النطاق الجغرافي (المكتب الرئيسي)' : 'Within Geofence (HQ)'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold bg-slate-900 px-2 py-1 rounded-md border border-slate-800 font-outfit">08:00 AM</span>
                </div>
              </div>
            </div>

            {/* Card B: Offline Queue Status (Small) */}
            <div className="md:col-span-1 bg-[#0d131f]/60 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700/60 transition-all group min-h-[280px]">
              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Cloud className="w-5 h-5 text-amber-500" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{t.landing.features.offlineTitle}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{t.landing.features.offlineDesc}</p>
              </div>

              {/* Offline indicator mockup */}
              <div className="mt-6 bg-slate-950/80 border border-slate-900 rounded-xl p-3 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-bold flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  {language === 'ar' ? 'وضع انقطاع الشبكة نشط' : 'Offline Mode Active'}
                </span>
                <span className="bg-slate-900 border border-slate-800 text-[10px] text-slate-300 font-bold px-2 py-0.5 rounded-md font-outfit">
                  3 {language === 'ar' ? 'مهام في انتظار التزامن' : 'Visits Queued'}
                </span>
              </div>
            </div>

            {/* Card C: Photo Verification Viewfinder (Small) */}
            <div className="md:col-span-1 bg-[#0d131f]/60 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700/60 transition-all group min-h-[280px]">
              <div>
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Smartphone className="w-5 h-5 text-purple-500" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{language === 'ar' ? 'توثيق العمل بالصور الميدانية' : 'Photo Proof Verification'}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  {language === 'ar' ? 'التقاط صور إنجاز المهام ميدانياً مع إرفاق خطوط العرض والطول لضمان صحة التنفيذ.' : 'Capture live photos of tasks directly on site with GPS stamps embedded into every file.'}
                </p>
              </div>

              {/* Viewfinder simulation mockup */}
              <div className="mt-6 border border-dashed border-slate-800 rounded-xl p-3 relative h-20 overflow-hidden flex items-center justify-center bg-slate-950/40">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-outfit">CAMERA PREVIEW VIEW</span>
                <span className="absolute top-1.5 left-1.5 w-2 h-2 border-t-2 border-l-2 border-slate-700" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 border-t-2 border-r-2 border-slate-700" />
                <span className="absolute bottom-1.5 left-1.5 w-2 h-2 border-b-2 border-l-2 border-slate-700" />
                <span className="absolute bottom-1.5 right-1.5 w-2 h-2 border-b-2 border-r-2 border-slate-700" />
              </div>
            </div>

            {/* Card D: Structured PDF Report Preview (Wide) */}
            <div className="md:col-span-2 bg-[#0d131f]/60 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700/60 transition-all group min-h-[280px]">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <BarChart3 className="w-5 h-5 text-emerald-500" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{t.landing.features.analyticsTitle}</h3>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed max-w-xl">{t.landing.features.analyticsDesc}</p>
              </div>

              {/* PDF printable report simulator frame */}
              <div className="mt-6 bg-slate-950 border border-slate-900 rounded-xl p-4 space-y-3 text-[10px] text-slate-400">
                <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                  <span className="font-bold text-slate-200">تقرير الحضور والزيارات اليومي</span>
                  <span className="text-[8px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold uppercase font-outfit">PDF Formatted</span>
                </div>
                <div className="space-y-1">
                  <div className="grid grid-cols-4 gap-2 font-bold text-slate-500 pb-1">
                    <span>الموظف</span>
                    <span>توقيع الحضور</span>
                    <span>توقيع الانصراف</span>
                    <span>الحالة والجودة</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-[9px] border-b border-slate-900/60 pb-1">
                    <span className="font-semibold text-slate-300">أحمد محمد</span>
                    <span className="font-outfit">08:00 AM</span>
                    <span className="font-outfit">04:00 PM</span>
                    <span className="text-emerald-500 font-bold">حضور موثق</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Visual How It Works Horizontal Timeline */}
      <section className="py-24 px-4 sm:px-6 border-t border-slate-900/60 bg-[#080c14]/20 relative z-10">
        <div className="max-w-5xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-extrabold text-white">
              {language === 'ar' ? 'كيف تعمل منصة TaskFlow؟' : 'How TaskFlow Works'}
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto text-xs sm:text-sm font-medium">
              {language === 'ar'
                ? 'دورة عمل موثقة جغرافياً تبدأ من تكليف المدير للمهمة وحتى استخراج التقرير النهائي.'
                : 'A geofenced lifecycle starting from task assignment to final validated PDF/Excel report output.'}
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8 relative">
            {/* Visual connecting line on desktop */}
            <div className="absolute top-8 left-8 right-8 h-[2px] bg-slate-900 hidden md:block z-0" />

            {[
              {
                step: '01',
                title: language === 'ar' ? 'تكليف المهمة والموقع' : 'Assign Task',
                desc: language === 'ar' ? 'يقوم المدير بتحديد إحداثيات الموقع للمهمة وعنوان العميل وإرسال التنبيه للموظف.' : 'Manager defines task coordinates, client name, and assigns it to field staff.'
              },
              {
                step: '02',
                title: language === 'ar' ? 'المطابقة والوصول' : 'Arrival Geofence',
                desc: language === 'ar' ? 'يصل الموظف للموقع، ويتحقق التطبيق من وجوده في نطاق الـ GPS المسموح به للبدء.' : 'Employee arrives. App matches GPS coordinates to ensure they are inside the geofence.'
              },
              {
                step: '03',
                title: language === 'ar' ? 'التقاط الإثبات بالصور' : 'Photo Verification',
                desc: language === 'ar' ? 'يلتقط الموظف صورة للعمل ويضيف الملاحظات ليتم ضغطها ورفعها تلقائياً للسحابة.' : 'Staff takes real-time photos of work progress, auto-compressing and uploading to storage.'
              },
              {
                step: '04',
                title: language === 'ar' ? 'تقارير الإنجاز الموثقة' : 'Verified Reports',
                desc: language === 'ar' ? 'تُسجل كافة البيانات والخطوات مع التوقيت الدقيق لإصدار تقارير PDF جاهزة للمشاركة.' : 'Audit logs are generated with exact timestamps and coordinates to export print-ready PDF files.'
              }
            ].map((node, i) => (
              <div key={i} className="bg-[#0d131f]/40 border border-slate-900 p-6 rounded-2xl relative z-10 hover:border-slate-800/80 transition-all flex flex-col justify-between min-h-[180px]">
                <div className="flex justify-between items-start">
                  <span className="text-blue-500 text-2xl font-black font-outfit">{node.step}</span>
                  <span className="w-7 h-7 rounded-full bg-blue-500/10 flex items-center justify-center"><Check className="w-3.5 h-3.5 text-blue-400" /></span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white mt-4">{node.title}</h3>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{node.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Side-by-Side View Comparer */}
      <section className="py-24 px-4 sm:px-6 border-t border-slate-900/60 relative z-10">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-extrabold text-white">
              {language === 'ar' ? 'إدارتان متكاملتان في منصة واحدة' : 'Two Roles, One Unified Platform'}
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto text-xs sm:text-sm font-medium">
              {language === 'ar' ? 'لوحة تحكم المشرف للمتابعة والتقارير وتطبيق الجوال للمندوبين الميدانيين.' : 'Manager dashboard for tracking & reports, and mobile app for field staff.'}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-stretch">
            {/* Left: Manager Dashboard Mockup */}
            <div className="bg-[#0d131f]/60 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden">
              <div className="space-y-2 mb-6">
                <span className="text-[10px] font-bold text-blue-500 tracking-wider uppercase font-outfit">{language === 'ar' ? 'لوحة المشرفين والمدراء' : 'Manager Operations Hub'}</span>
                <h3 className="text-xl font-bold text-white">{language === 'ar' ? 'التحليلات والمتابعة الإدارية' : 'Desktop Dashboard & Analytics'}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{language === 'ar' ? 'لوحة تحكم المشرف متكاملة وسلسة لمراجعة الحضور وسجل المهام والزيارات والموافقة على الإجازات والمغادرات وتصدير تقارير PDF الموثقة.' : 'Full administrative dashboard to track check-in logs, approve leave requests, review photos, and export high-fidelity reports.'}</p>
              </div>
              <div className="bg-slate-950 border border-slate-900 rounded-xl p-3 text-[10px] space-y-2.5">
                <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                  <span className="font-bold text-slate-300">{language === 'ar' ? 'سجل الحضور والغياب الميداني' : 'Staff Attendance Register'}</span>
                  <span className="text-[8px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-bold uppercase font-outfit">Manager View</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center border-b border-slate-900/60 pb-1">
                    <span className="text-slate-300 font-bold">خالد عمر</span>
                    <span className="text-emerald-500 font-semibold">{language === 'ar' ? 'حضور (ميداني)' : 'Present (Field)'}</span>
                    <span className="text-slate-500 font-outfit">08:15 AM</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-900/60 pb-1">
                    <span className="text-slate-300 font-bold">صالح علي</span>
                    <span className="text-amber-500 font-semibold">{language === 'ar' ? 'إجازة سنوية' : 'On Leave'}</span>
                    <span className="text-slate-500 font-outfit">-</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Employee App Mockup */}
            <div className="bg-[#0d131f]/60 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden">
              <div className="space-y-2 mb-6">
                <span className="text-[10px] font-bold text-purple-500 tracking-wider uppercase font-outfit">{language === 'ar' ? 'تطبيق الموظف الميداني' : 'Field Worker Mobile App'}</span>
                <h3 className="text-xl font-bold text-white">{language === 'ar' ? 'الحركات والزيارات الميدانية' : 'Mobile Attendance & Action'}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{language === 'ar' ? 'تطبيق الهاتف يركز على إتمام الأعمال بسرعة، مثل تسجيل الدوام الجغرافي بضغطة زر، وطلب المغادرة، وإرسال تقرير الزيارة فوراً.' : 'Mobile dashboard optimized for quick field check-ins, leave requests submissions, and photo-documented visits.'}</p>
              </div>
              <div className="bg-slate-950 border border-slate-900 rounded-xl p-4 text-[10px] space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-300">{language === 'ar' ? 'حركات اليوم' : 'Daily Dispatch Card'}</span>
                  <span className="text-[8px] bg-purple-500/10 border border-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded font-bold uppercase font-outfit">Mobile View</span>
                </div>
                <div className="bg-slate-900/60 border border-slate-850 p-2.5 rounded-lg space-y-2">
                  <span className="text-[9px] text-slate-400 block font-semibold">{language === 'ar' ? 'تسجيل حضور الدوام اليومي' : 'Workday Shift Check-in'}</span>
                  <div className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-1.5 text-center rounded-md cursor-pointer transition-colors text-[9px]">
                    {language === 'ar' ? 'تسجيل الحضور الآن' : 'Check-In Shift'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile App Download & Platform Guidelines */}
      <section className="py-24 px-4 sm:px-6 border-t border-slate-900/60 relative z-10">
        <div className="max-w-5xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-extrabold text-white">
              {language === 'ar' ? 'تنزيل تطبيق الجوال للموظفين' : 'Get the Mobile Application'}
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto text-xs sm:text-sm font-medium">
              {language === 'ar' 
                ? 'استخدم تطبيق الجوال المخصص للموظفين الميدانيين لإرسال الزيارات والتقارير وحساب المسافات حتى بدون إنترنت.'
                : 'Download the mobile app package to support offline sync and tracking.'}
            </p>
          </div>

          <div className="grid md:grid-cols-12 gap-8 items-center bg-[#0d131f]/40 border border-slate-800/80 rounded-3xl p-6 md:p-10">
            <div className="col-span-12 md:col-span-7 space-y-6">
              {/* Tab Selector */}
              <div className="flex border border-slate-850 rounded-xl p-1 bg-slate-950 w-fit select-none">
                <button
                  onClick={() => setDownloadPlatform('android')}
                  className={`px-5 py-2 rounded-lg text-xs font-bold transition-all border-none cursor-pointer flex items-center gap-2 ${
                    downloadPlatform === 'android'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-slate-200 bg-transparent'
                  }`}
                >
                  🤖 Android (APK)
                </button>
                <button
                  onClick={() => setDownloadPlatform('ios')}
                  className={`px-5 py-2 rounded-lg text-xs font-bold transition-all border-none cursor-pointer flex items-center gap-2 ${
                    downloadPlatform === 'ios'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-slate-200 bg-transparent'
                  }`}
                >
                  🍏 iOS PWA
                </button>
              </div>

              {/* Tab Content */}
              {downloadPlatform === 'android' ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-white">🤖 {language === 'ar' ? 'تنزيل تطبيق أندرويد المباشر' : 'Install Native Android App'}</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {language === 'ar'
                        ? 'قم بتنزيل ملف الـ APK لتفعيل كامل صلاحيات الـ GPS والتزامن التلقائي بالخلفية.'
                        : 'Download and install the native application package to utilize absolute background synchronization.'}
                    </p>
                  </div>
                  <div className="space-y-3">
                    {[
                      { num: '1', title: language === 'ar' ? 'تنزيل ملف APK' : 'Download APK File', desc: language === 'ar' ? 'انقر على زر التحميل أدناه لتنزيل ملف التثبيت المباشر للهاتف.' : 'Click the download link below to download the direct installation files.' },
                      { num: '2', title: language === 'ar' ? 'السماح بالتثبيت' : 'Security Clearance', desc: language === 'ar' ? 'اسمح بالتثبيت من مصادر غير معروفة إذا طلب الهاتف ذلك.' : 'Enable install from unknown resources inside browser settings if requested.' },
                      { num: '3', title: language === 'ar' ? 'تثبيت وبدء العمل' : 'Install & Run', desc: language === 'ar' ? 'افتح ملف التنزيلات، اضغط تثبيت وقم بتسجيل الدخول الفوري.' : 'Open download folder, click install and launch TaskFlow.' }
                    ].map((step) => (
                      <div key={step.num} className="flex gap-4 items-start text-xs">
                        <span className="w-5.5 h-5.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0">{step.num}</span>
                        <div>
                          <h4 className="font-bold text-slate-200">{step.title}</h4>
                          <p className="text-slate-500 mt-0.5 leading-relaxed">{step.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2">
                    <a
                      href="https://github.com/mom056/taskflow/releases/latest/download/app-release.apk"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-5 py-3 rounded-xl transition-all shadow-md text-decoration-none"
                    >
                      <Download className="w-4 h-4" />
                      <span>{language === 'ar' ? 'تحميل ملف التطبيق APK' : 'Download Application (APK)'}</span>
                    </a>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-white">🍏 {language === 'ar' ? 'تثبيت التطبيق على آيفون (Safari)' : 'Install as iOS PWA'}</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {language === 'ar'
                        ? 'تثبيت التطبيق كـ PWA خفيف جداً على هاتفك الايفون دون الحاجة لمتجر التطبيقات.'
                        : 'Deploy the lightweight web app shortcut on Apple iOS Safari.'}
                    </p>
                  </div>
                  <div className="space-y-3">
                    {[
                      { num: '1', title: language === 'ar' ? 'افتح Safari' : 'Launch Safari Browser', desc: language === 'ar' ? 'افتح المتصفح الرسمي Safari واذهب لرابط التطبيق الإلكتروني.' : 'Browse taskflow system domain using default Safari.' },
                      { num: '2', title: language === 'ar' ? 'قائمة المشاركة' : 'Tap Share Menu', desc: language === 'ar' ? 'اضغط زر مشاركة (مربع بسهم لأعلى) في شريط التحكم السفلي.' : 'Tap share icon in the bottom menu bar of Safari.' },
                      { num: '3', title: language === 'ar' ? 'الإضافة للشاشة الرئيسية' : 'Add to Home Screen', desc: language === 'ar' ? 'اضغط خيار "إضافة للشاشة الرئيسية" (Add to Home screen) ثم تأكيد.' : 'Scroll and choose Add to Home Screen option, then save.' }
                    ].map((step) => (
                      <div key={step.num} className="flex gap-4 items-start text-xs">
                        <span className="w-5.5 h-5.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0">{step.num}</span>
                        <div>
                          <h4 className="font-bold text-slate-200">{step.title}</h4>
                          <p className="text-slate-500 mt-0.5 leading-relaxed">{step.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Side: QR Code scan card - Theme-Protected wrapper */}
            <div className="col-span-12 md:col-span-5 hidden md:flex flex-col items-center justify-center space-y-4">
              <div className="bg-slate-950 border border-slate-900 rounded-2xl p-6 shadow-xl flex flex-col items-center space-y-4 relative w-60 select-none">
                {/* Forced WHITE container to protect scannability from global .dark overrides */}
                <div 
                  className="bg-white-forced p-3 rounded-xl flex items-center justify-center shadow-md"
                  style={{ backgroundColor: '#ffffff' }}
                >
                  {qrCodeUrl ? (
                    <img 
                      src={qrCodeUrl} 
                      alt="Scan to open TaskFlow website" 
                      className="w-32 h-32 border border-slate-100 object-contain rounded"
                    />
                  ) : (
                    <div className="w-32 h-32 bg-slate-100 animate-pulse rounded flex items-center justify-center text-[9px] text-slate-400">
                      Generating QR...
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <span className="text-xs font-bold text-slate-300 block">{language === 'ar' ? 'امسح الرمز لتنزيل التطبيق' : 'Scan QR to Download'}</span>
                  <span className="text-[9px] text-slate-500 mt-1 block">{language === 'ar' ? 'افتح كاميرا هاتفك لتثبيت التطبيق مباشرة' : 'Aim your camera to download PWA/APK'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 relative z-10">
        <div className="max-w-4xl mx-auto bg-blue-600 rounded-3xl p-8 md:p-14 text-center space-y-6 relative shadow-xl shadow-blue-900/30">
          <h2 className="text-2xl md:text-3xl font-extrabold text-white">
            {t.landing.ctaTitle}
          </h2>
          <p className="text-blue-100 max-w-xl mx-auto text-xs sm:text-sm leading-relaxed">
            {t.landing.ctaDesc}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <button 
              onClick={() => handleGoToAuth(false)}
              className="w-full sm:w-auto bg-white hover:bg-slate-50 text-blue-600 text-xs sm:text-sm font-bold px-8 py-3.5 rounded-xl transition-all cursor-pointer border-none"
            >
              {t.landing.startFree}
            </button>
            <button 
              onClick={() => handleGoToAuth(true)}
              className="w-full sm:w-auto bg-blue-700/60 hover:bg-blue-700 border border-blue-400/20 text-white text-xs sm:text-sm font-bold px-8 py-3.5 rounded-xl transition-all cursor-pointer"
            >
              {t.landing.haveAccount}
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-900/80 py-8 text-center text-[10px] text-slate-500 font-semibold bg-slate-950/40 relative z-10">
        <p>© {new Date().getFullYear()} {t.common.appName}. All rights reserved.</p>
      </footer>
    </div>
  );
}
