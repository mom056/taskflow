import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  MapPin, Cloud, BarChart3, Users, ArrowLeft, 
  CheckCircle, Zap, Shield, Smartphone, Download, 
  Share, Play, Check, Clock, Eye, AlertCircle,
  ClipboardList, CheckSquare
} from 'lucide-react';
import { useTranslation } from '../contexts/LanguageContext';
import AppLogo from '../components/AppLogo';

export default function LandingPage() {
  const navigate = useNavigate();
  const { t, language, changeLanguage } = useTranslation();
  const [downloadPlatform, setDownloadPlatform] = useState<'android' | 'ios'>('android');
  const [activeMockupTab, setActiveMockupTab] = useState<'manager' | 'employee'>('manager');
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  // Dynamically generate a scanable QR code pointing to the current domain URL
  useEffect(() => {
    const currentOrigin = window.location.origin;
    const size = 160;
    // Use QR Server API to generate a scanable QR code matching the deployment domain
    setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&color=1e293b&data=${encodeURIComponent(currentOrigin)}`);
  }, []);

  const handleGoToAuth = (isLogin: boolean) => {
    navigate('/login', { state: { isLogin } });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-blue-600 selection:text-white overflow-x-hidden relative font-sans" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      
      {/* Visual Background Accent Grids */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1.2px,transparent_1.2px)] [background-size:24px_24px] opacity-25 pointer-events-none z-0" />
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[130px] pointer-events-none z-0" />
      <div className="absolute bottom-1/4 left-1/3 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[150px] pointer-events-none z-0" />

      {/* Header / Navbar */}
      <header className="border-b border-slate-900/80 backdrop-blur-lg sticky top-0 z-50 bg-slate-950/80">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <AppLogo size={34} theme="dark" />
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => changeLanguage(language === 'ar' ? 'en' : 'ar')}
              className="text-xs font-bold bg-slate-900/90 hover:bg-slate-800 border border-slate-800/80 text-slate-300 px-3.5 py-2 rounded-xl transition-all cursor-pointer"
            >
              {language === 'ar' ? 'English' : 'العربية'}
            </button>
            <button 
              onClick={() => handleGoToAuth(true)}
              className="text-sm font-semibold text-slate-300 hover:text-white transition-colors px-4 py-2 cursor-pointer bg-transparent border-none"
            >
              {t.landing.login}
            </button>
            <button 
              onClick={() => handleGoToAuth(false)}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all shadow-md hover:shadow-blue-600/20 hover:-translate-y-0.5 cursor-pointer border-none"
            >
              {t.landing.startFree}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 px-6 z-10">
        <div className="max-w-5xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold px-4 py-1.5 rounded-full shadow-inner animate-pulse">
            <Zap className="w-3.5 h-3.5" />
            <span>{t.landing.subtitle}</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight leading-tight max-w-4xl mx-auto">
            {language === 'ar' ? (
              <>
                تابع فريقك الميداني وتأكد من <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-400 bg-clip-text text-transparent">إنجاز المهام بدقة</span>
              </>
            ) : (
              <>
                Track Your Field Team & Ensure <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-400 bg-clip-text text-transparent">Accurate Completion</span>
              </>
            )}
          </h1>
          
          <p className="text-base md:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed font-medium">
            {t.landing.desc}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button 
              onClick={() => handleGoToAuth(false)}
              className={`w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white text-base font-bold px-8 py-4 rounded-xl transition-all shadow-lg hover:shadow-blue-600/30 hover:-translate-y-0.5 flex items-center justify-center gap-3 cursor-pointer border-none ${language === 'en' ? 'flex-row-reverse' : ''}`}
            >
              <span>{t.landing.startFreeNow}</span>
              <ArrowLeft className={`w-5 h-5 ${language === 'en' ? 'rotate-180' : ''}`} />
            </button>
            <button 
              onClick={() => handleGoToAuth(true)}
              className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-base font-bold px-8 py-4 rounded-xl transition-all hover:-translate-y-0.5 cursor-pointer"
            >
              {t.landing.featuresDemo}
            </button>
          </div>
        </div>
      </section>

      {/* Product Live Demo Simulation Section */}
      <section className="px-6 pb-24 relative z-10">
        <div className="max-w-5xl mx-auto">
          {/* Mockup Tabs */}
          <div className="flex justify-center mb-6">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-1.5 flex gap-2">
              <button
                onClick={() => setActiveMockupTab('manager')}
                className={`px-5 py-3 rounded-xl text-xs md:text-sm font-bold transition-all border-none cursor-pointer flex items-center gap-2 ${
                  activeMockupTab === 'manager'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 bg-transparent'
                }`}
              >
                <Eye className="w-4 h-4" />
                <span>{language === 'ar' ? 'لوحة تحكم المدير (الويب)' : 'Manager Dashboard (Web)'}</span>
              </button>
              <button
                onClick={() => setActiveMockupTab('employee')}
                className={`px-5 py-3 rounded-xl text-xs md:text-sm font-bold transition-all border-none cursor-pointer flex items-center gap-2 ${
                  activeMockupTab === 'employee'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 bg-transparent'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>{language === 'ar' ? 'تطبيق الموظف (الجوال)' : 'Employee App (Mobile)'}</span>
              </button>
            </div>
          </div>

          {/* Interactive Simulation Frame */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-4 md:p-6 shadow-2xl backdrop-blur-xs relative overflow-hidden">
            {/* Top glass reflection overlay */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-slate-700 to-transparent" />

            {activeMockupTab === 'manager' ? (
              /* MANAGER DESKTOP SIMULATOR */
              <div className="space-y-4">
                {/* Browser bar */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-500 block" />
                    <span className="w-3 h-3 rounded-full bg-amber-500 block" />
                    <span className="w-3 h-3 rounded-full bg-emerald-500 block" />
                  </div>
                  <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg px-6 py-1 text-[10px] text-slate-500 w-1/2 text-center select-none truncate">
                    https://taskflow.app/manager/dashboard
                  </div>
                  <div className="w-10" />
                </div>

                {/* Dashboard layout */}
                <div className="grid grid-cols-12 gap-4">
                  {/* Dashboard Sidebar */}
                  <div className="col-span-3 hidden sm:flex flex-col gap-2.5 pr-2 border-r border-slate-800/50">
                    <div className="flex items-center gap-2 mb-2 p-1">
                      <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-xs text-white">T</div>
                      <span className="text-xs font-bold text-white">TaskFlow</span>
                    </div>
                    {['overview', 'tasks', 'visits', 'team'].map((item) => (
                      <div 
                        key={item} 
                        className={`px-3 py-2 rounded-xl text-[11px] font-bold flex items-center gap-2 cursor-default ${
                          item === 'overview' ? 'bg-blue-600/10 text-blue-400 border border-blue-500/15' : 'text-slate-400'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        <span className="capitalize">{item}</span>
                      </div>
                    ))}
                  </div>

                  {/* Dashboard Content */}
                  <div className="col-span-12 sm:col-span-9 space-y-4">
                    {/* Live stats */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-3">
                        <span className="text-[10px] text-slate-500 block font-semibold">{language === 'ar' ? 'الزيارات النشطة' : 'Active Visits'}</span>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-lg font-black text-white">12</span>
                          <span className="text-[9px] text-emerald-500 font-bold">🟢 نشط</span>
                        </div>
                      </div>
                      <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-3">
                        <span className="text-[10px] text-slate-500 block font-semibold">{language === 'ar' ? 'معدل الإنجاز' : 'Completion Rate'}</span>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-lg font-black text-blue-400">96.8%</span>
                        </div>
                      </div>
                      <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-3">
                        <span className="text-[10px] text-slate-500 block font-semibold">{language === 'ar' ? 'تغطية الـ GPS' : 'GPS Tracking'}</span>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-lg font-black text-white">100%</span>
                          <span className="text-[9px] text-blue-400 font-bold">موثق</span>
                        </div>
                      </div>
                    </div>

                    {/* Columns: Map & Task Feed */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Interactive CSS Map */}
                      <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3 h-52 relative overflow-hidden flex flex-col justify-between">
                        <div className="flex justify-between items-center z-10">
                          <span className="text-[10px] font-bold text-slate-300 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-rose-500" />
                            {language === 'ar' ? 'متابعة المواقع الجغرافية مباشر' : 'Live GPS Fleet Tracking'}
                          </span>
                          <span className="text-[8px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold">Live Map</span>
                        </div>

                        {/* Simulated roads map layout */}
                        <div className="absolute inset-0 top-10 opacity-30 flex flex-col justify-around pointer-events-none px-4">
                          <div className="h-0.5 w-full bg-slate-700" />
                          <div className="h-0.5 w-full bg-slate-700" />
                          <div className="h-full w-0.5 bg-slate-700 absolute left-1/3" />
                          <div className="h-full w-0.5 bg-slate-700 absolute left-2/3" />
                        </div>

                        {/* Pulsing Pin A */}
                        <div className="absolute top-1/3 left-1/3 z-10 flex flex-col items-center">
                          <div className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                          </div>
                          <span className="bg-slate-900 border border-slate-700 text-[8px] text-white font-bold px-1.5 py-0.5 rounded-md mt-1 shadow-md whitespace-nowrap">
                            {language === 'ar' ? 'أحمد محمد (في الموقع)' : 'Ahmed M. (On site)'}
                          </span>
                        </div>

                        {/* Pulsing Pin B */}
                        <div className="absolute bottom-1/4 left-3/5 z-10 flex flex-col items-center">
                          <div className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                          </div>
                          <span className="bg-slate-900 border border-slate-700 text-[8px] text-white font-bold px-1.5 py-0.5 rounded-md mt-1 shadow-md whitespace-nowrap">
                            {language === 'ar' ? 'خالد عمر (بدأ الزيارة)' : 'Khaled O. (Started)'}
                          </span>
                        </div>
                      </div>

                      {/* Live Feed */}
                      <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-3 h-52 overflow-hidden flex flex-col justify-between">
                        <span className="text-[10px] font-bold text-slate-300 block mb-2">
                          {language === 'ar' ? 'سجل العمليات الأخير' : 'Recent Visit History'}
                        </span>
                        <div className="space-y-2 flex-1 overflow-hidden">
                          {[
                            { name: 'أحمد محمد', task: 'صيانة مكيفات البنك', status: 'completed', time: '2m ago' },
                            { name: 'خالد عمر', task: 'تركيب راوتر الألياف', status: 'started', time: '10m ago' },
                            { name: 'صالح علي', task: 'تسليم شحنة للموقع د', status: 'completed', time: '1h ago' }
                          ].map((item, i) => (
                            <div key={i} className="flex justify-between items-center border-b border-slate-900/60 pb-1.5 text-[9px] md:text-[10px]">
                              <div>
                                <span className="font-extrabold text-slate-100">{item.name}</span>
                                <span className="text-slate-500 mx-1">{language === 'ar' ? 'في' : 'on'}</span>
                                <span className="text-slate-300 font-medium truncate inline-block max-w-[120px]">{item.task}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className={`px-1.5 py-0.5 rounded-md font-bold text-[8px] ${
                                  item.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'
                                }`}>
                                  {item.status === 'completed' ? (language === 'ar' ? 'أُنجزت' : 'Done') : (language === 'ar' ? 'بدأت' : 'Started')}
                                </span>
                                <span className="text-slate-500 font-semibold">{item.time}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* EMPLOYEE MOBILE APP SIMULATOR */
              <div className="flex justify-center py-4">
                {/* Smartphone Container */}
                <div className="bg-slate-950 border-[5px] border-slate-800 rounded-[36px] w-[270px] h-[480px] overflow-hidden shadow-2xl relative flex flex-col justify-between select-none">
                  
                  {/* Smartphone camera punch-hole */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-14 h-4 bg-slate-800 rounded-full z-20 flex items-center justify-around px-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-900 block" />
                    <span className="w-1 h-1 rounded-full bg-blue-900 block" />
                  </div>

                  {/* App Header */}
                  <div className="bg-slate-900/80 border-b border-slate-800/60 px-4 pt-7 pb-3 flex items-center justify-between z-10">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 bg-blue-600 rounded-md flex items-center justify-center font-black text-[9px] text-white">T</div>
                      <span className="text-[10px] font-black text-white">TaskFlow</span>
                    </div>
                    <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[8px] font-black text-slate-300">
                      أ
                    </div>
                  </div>

                  {/* App Dashboard Body */}
                  <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                    {/* Visual Path Grid */}
                    <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-2xl space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-slate-300">{language === 'ar' ? 'مسار يوم العمل اليومي' : 'Workday Path'}</span>
                        <span className="text-[8px] text-emerald-400 font-bold">🟢 1.2 كم</span>
                      </div>
                      {/* Path dots */}
                      <div className="flex items-center gap-2 justify-between px-1">
                        {[
                          { label: 'البدء', done: true },
                          { label: 'موقع 1', done: true },
                          { label: 'موقع 2', done: false },
                          { label: 'النهاية', done: false }
                        ].map((node, i) => (
                          <div key={i} className="flex flex-col items-center gap-0.5">
                            <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] ${
                              node.done ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-500'
                            }`}>
                              {node.done ? '✓' : i + 1}
                            </div>
                            <span className="text-[7px] text-slate-500 font-semibold">{node.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Active Task Card */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2 relative overflow-hidden">
                      <div className="absolute top-2 right-2 flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md">
                        <span className="w-1 h-1 rounded-full bg-emerald-500 animate-ping block" />
                        <span className="text-[7px] text-emerald-400 font-black">{language === 'ar' ? 'متاح للبدء' : 'Arrived'}</span>
                      </div>
                      
                      <div className="space-y-0.5">
                        <h4 className="text-[11px] font-bold text-white leading-tight">صيانة الألياف البصرية</h4>
                        <p className="text-[8px] text-slate-400">{language === 'ar' ? 'عميل: شركة النور' : 'Client: Al-Noor Corp'}</p>
                      </div>

                      <div className="flex items-center gap-1.5 text-[8px] text-slate-500">
                        <MapPin className="w-3 h-3 text-rose-500" />
                        <span className="font-semibold">{language === 'ar' ? 'أنت داخل نطاق الـ 10 متر' : 'Within 10m Geofence'}</span>
                      </div>

                      {/* Photo verification zone */}
                      <div className="bg-slate-950/50 border border-dashed border-slate-800 rounded-lg p-2 flex items-center justify-center gap-1 text-[8px] text-slate-400">
                        <Smartphone className="w-3.5 h-3.5 text-blue-500" />
                        <span>{language === 'ar' ? 'التقاط صورة توثيق العمل' : 'Take Verification Photo'}</span>
                      </div>

                      {/* Action Swipe Button */}
                      <div className="bg-blue-600 rounded-xl py-1.5 text-center text-[10px] font-extrabold text-white shadow-md shadow-blue-900/20 cursor-pointer hover:bg-blue-500 transition-colors">
                        {language === 'ar' ? '✓ بدء العمل بالموقع الآن' : '✓ Check-in / Start Visit'}
                      </div>
                    </div>
                  </div>

                  {/* Mobile navigation tab */}
                  <div className="bg-slate-900/90 border-t border-slate-800/80 px-4 py-2 flex items-center justify-around z-10">
                    <div className="flex flex-col items-center text-blue-500"><ClipboardList className="w-4 h-4" /><span className="text-[7px] font-bold mt-0.5">Active</span></div>
                    <div className="flex flex-col items-center text-slate-500"><CheckSquare className="w-4 h-4" /><span className="text-[7px] font-bold mt-0.5">History</span></div>
                    <div className="flex flex-col items-center text-slate-500">
                      <div className="w-4.5 h-4.5 rounded-full border border-slate-700 bg-slate-800 flex items-center justify-center text-[7px] font-bold">أ</div>
                      <span className="text-[7px] font-bold mt-0.5">Profile</span>
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Structured "How it Works" Visual Timeline */}
      <section className="py-24 px-6 border-t border-slate-900/60 bg-slate-950/20">
        <div className="max-w-5xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold md:text-4xl text-white">
              {language === 'ar' ? 'كيف تعمل منصة TaskFlow؟' : 'How TaskFlow Works'}
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto text-sm md:text-base font-medium">
              {language === 'ar'
                ? 'دورة عمل موثقة جغرافياً تبدأ من تكليف المدير للمهمة وحتى استخراج التقرير النهائي.'
                : 'A geofenced lifecycle starting from task assignment to final validated PDF/Excel report output.'}
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6 relative">
            {/* Visual connecting arrow line on desktop */}
            <div className="absolute top-1/4 left-8 right-8 h-[2px] bg-slate-800 hidden md:block z-0" />

            {[
              {
                step: '01',
                title: language === 'ar' ? 'تكليف المهمة والموقع' : 'Assign Task',
                desc: language === 'ar' ? 'يقوم المدير بتحديد إحداثيات الموقع للمهمة وعنوان العميل وإرسال التنبيه للموظف.' : 'Manager defines task coordinates, client name, and assigns it to field staff instantly.'
              },
              {
                step: '02',
                title: language === 'ar' ? 'المطابقة والوصول' : 'Arrival Geofence',
                desc: language === 'ar' ? 'يصل الموظف للموقع، ويتحقق التطبيق من وجوده في نطاق الـ GPS المسموح به للبدء.' : 'Employee arrives. App matches GPS coordinates to ensure they are inside the geofence before starting.'
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
              <div key={i} className="bg-slate-900/60 border border-slate-900 p-6 rounded-3xl relative z-10 hover:border-slate-800/80 transition-all flex flex-col justify-between min-h-[190px]">
                <div className="flex justify-between items-start">
                  <span className="text-blue-500 text-3xl font-black">{node.step}</span>
                  <span className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center"><Check className="w-4 h-4 text-blue-400" /></span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white mt-4">{node.title}</h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">{node.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid Section */}
      <section className="py-24 px-6 border-t border-slate-900/60 bg-slate-950/10">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold md:text-4xl text-white">
              {t.landing.featuresTitle}
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto text-sm md:text-base font-medium">
              {t.landing.featuresSubtitle}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: MapPin,
                title: t.landing.features.gpsTitle,
                desc: t.landing.features.gpsDesc,
                color: 'text-rose-400 bg-rose-500/10 border-rose-500/20'
              },
              {
                icon: Cloud,
                title: t.landing.features.offlineTitle,
                desc: t.landing.features.offlineDesc,
                color: 'text-blue-400 bg-blue-500/10 border-blue-500/20'
              },
              {
                icon: BarChart3,
                title: t.landing.features.analyticsTitle,
                desc: t.landing.features.analyticsDesc,
                color: 'text-amber-400 bg-amber-500/10 border-amber-500/20'
              },
              {
                icon: Users,
                title: t.landing.features.teamTitle,
                desc: t.landing.features.teamDesc,
                color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              },
              {
                icon: Shield,
                title: t.landing.features.securityTitle,
                desc: t.landing.features.securityDesc,
                color: 'text-purple-400 bg-purple-500/10 border-purple-500/20'
              },
              {
                icon: CheckCircle,
                title: t.landing.features.notificationsTitle,
                desc: t.landing.features.notificationsDesc,
                color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'
              }
            ].map((feat, idx) => (
              <div key={idx} className="bg-slate-900/40 border border-slate-900 p-6 md:p-8 rounded-3xl hover:border-slate-800 transition-all hover:bg-slate-900/60 group">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border mb-6 ${feat.color} transition-transform group-hover:scale-110`}>
                  <feat.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-100 mb-3">{feat.title}</h3>
                <p className="text-slate-400 text-xs md:text-sm leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mobile App Download Section */}
      <section className="py-24 px-6 border-t border-slate-900/60 relative">
        <div className="max-w-5xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold px-4 py-1.5 rounded-full">
              <Smartphone className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'تطبيقات الهاتف المحمول' : 'Mobile Applications'}</span>
            </div>
            <h2 className="text-3xl font-bold md:text-4xl text-white">
              {language === 'ar' ? 'قم بتنزيل تطبيق TaskFlow لجوالك' : 'Download TaskFlow Mobile App'}
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto text-sm md:text-base font-medium">
              {language === 'ar' 
                ? 'استخدم تطبيق الجوال المخصص للموظفين الميدانيين لإرسال الزيارات والتقارير وحساب المسافات حتى بدون إنترنت.'
                : 'Use our dedicated mobile application for field workers to log visits, track routes, and work offline.'}
            </p>
          </div>

          <div className="grid md:grid-cols-12 gap-8 items-center bg-slate-900/40 border border-slate-900 rounded-4xl p-6 md:p-10 backdrop-blur-xs">
            {/* Left: Setup Guidelines & Platform Tabs */}
            <div className="md:col-span-7 space-y-6">
              {/* Tab Selector */}
              <div className="flex border border-slate-800 rounded-xl p-1 bg-slate-950 w-fit select-none">
                <button
                  onClick={() => setDownloadPlatform('android')}
                  className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer flex items-center gap-2 ${
                    downloadPlatform === 'android'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 bg-transparent'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Android (APK)</span>
                </button>
                <button
                  onClick={() => setDownloadPlatform('ios')}
                  className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer flex items-center gap-2 ${
                    downloadPlatform === 'ios'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 bg-transparent'
                  }`}
                >
                  <span>iOS PWA (Safari)</span>
                </button>
              </div>

              {/* Dynamic Guidelines Content */}
              {downloadPlatform === 'android' ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      🤖 {language === 'ar' ? 'تثبيت تطبيق الأندرويد' : 'Install Android App'}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {language === 'ar'
                        ? 'قم بتنزيل ملف APK المباشر لضمان الوصول لكافة صلاحيات الـ GPS والتشغيل في الخلفية بدقة كاملة.'
                        : 'Download the native APK package to guarantee full access to geolocation tracking and background sync.'}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {[
                      {
                        num: '1',
                        title: language === 'ar' ? 'تنزيل ملف APK' : 'Download APK File',
                        desc: language === 'ar' ? 'انقر على زر التحميل أدناه أو امسح رمز الاستجابة السريعة بجوالك لتنزيل التطبيق مباشرة.' : 'Click the button below or scan the QR code to start downloading the installer package directly.'
                      },
                      {
                        num: '2',
                        title: language === 'ar' ? 'السماح بالتثبيت' : 'Allow Installation',
                        desc: language === 'ar' ? 'إذا طُلب منك، قم بتمكين خيار "التثبيت من مصادر غير معروفة" في إعدادات متصفحك أو جهازك.' : 'If prompted, enable "Install from Unknown Sources" in your browser or security settings.'
                      },
                      {
                        num: '3',
                        title: language === 'ar' ? 'تثبيت وتشغيل التطبيق' : 'Install & Open App',
                        desc: language === 'ar' ? 'افتح ملف التنزيلات، اضغط على ملف taskflow.apk ثم اختر تثبيت وابدأ بتسجيل الدخول.' : 'Open the downloaded file, click install, launch TaskFlow, and sign in to get started.'
                      }
                    ].map((step) => (
                      <div key={step.num} className="flex gap-4 items-start">
                        <div className="w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                          {step.num}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-100">{step.title}</h4>
                          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{step.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2">
                    <a
                      href="https://github.com/mom056/taskflow/releases/latest/download/app-release.apk"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-6 py-3.5 rounded-xl transition-all shadow-md shadow-blue-900/30 hover:-translate-y-0.5 text-decoration-none"
                    >
                      <Download className="w-4 h-4" />
                      <span>{language === 'ar' ? 'تحميل تطبيق الأندرويد (APK)' : 'Download Android App (APK)'}</span>
                    </a>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      🍏 {language === 'ar' ? 'تثبيت التطبيق على آيفون (PWA)' : 'Install App on iOS (PWA)'}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {language === 'ar'
                        ? 'يمكنك تثبيت تطبيق TaskFlow على أجهزة آبل بسهولة تامة وبحجم خفيف جداً كـ PWA عبر متصفح Safari.'
                        : 'Deploy TaskFlow on Apple iOS devices effortlessly as a lightweight Progressive Web App via Safari.'}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {[
                      {
                        num: '1',
                        title: language === 'ar' ? 'فتح الموقع في Safari' : 'Open in Safari',
                        desc: language === 'ar' ? 'تأكد من فتح هذا الرابط الإلكتروني للمنصة من خلال متصفح Safari الرسمي بجوالك.' : 'Ensure you are browsing this system platform using the native Safari browser on your iPhone.'
                      },
                      {
                        num: '2',
                        title: language === 'ar' ? 'الضغط على أيقونة المشاركة' : 'Tap the Share Button',
                        desc: language === 'ar' ? 'انقر على زر "مشاركة" (أيقونة المربع والسهم للأعلى) في شريط التحكم السفلي للمتصفح.' : 'Tap the "Share" icon (square with an upward arrow) in the browser toolbar.'
                      },
                      {
                        num: '3',
                        title: language === 'ar' ? 'إضافة إلى الصفحة الرئيسية' : 'Add to Home Screen',
                        desc: language === 'ar' ? 'اسحب قائمة الخيارات واضغط على "إضافة إلى الصفحة الرئيسية" (Add to Home Screen)، ثم اضغط إضافة.' : 'Scroll down the share menu and select "Add to Home Screen", then click Add at the top right.'
                      }
                    ].map((step) => (
                      <div key={step.num} className="flex gap-4 items-start">
                        <div className="w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                          {step.num}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-100">{step.title}</h4>
                          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{step.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 flex items-center gap-2 text-xs font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-4 py-3 rounded-xl w-fit">
                    <Share className="w-4 h-4 shrink-0" />
                    <span>{language === 'ar' ? '⚠️ تذكر: هذه الميزة تتطلب متصفح Safari فقط على نظام iOS.' : '⚠️ Remember: This feature requires Safari browser on iOS devices.'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Real Scanable QR Code Visualizer card */}
            <div className="md:col-span-5 flex flex-col items-center justify-center space-y-4">
              <div className="bg-slate-950 border border-slate-900 rounded-3xl p-6 shadow-xl flex flex-col items-center space-y-4 relative overflow-hidden w-64">
                {/* Visual grid overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:14px_24px] opacity-10 pointer-events-none" />
                
                {/* Real Dynamic QR Code image wrapper */}
                <div className="bg-white p-3.5 rounded-2xl shadow-inner relative z-10 flex items-center justify-center">
                  {qrCodeUrl ? (
                    <img 
                      src={qrCodeUrl} 
                      alt="Scanable QR Code to current site domain" 
                      className="w-36 h-36 border border-slate-100 object-contain rounded-lg"
                    />
                  ) : (
                    <div className="w-36 h-36 bg-slate-100 animate-pulse rounded-lg flex items-center justify-center text-[10px] text-slate-400">
                      Generating...
                    </div>
                  )}
                </div>
                <div className="text-center relative z-10">
                  <span className="text-xs font-bold text-slate-300 block">
                    {language === 'ar' ? 'امسح الرمز بكاميرا الجوال' : 'Scan QR with Phone'}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    {language === 'ar' ? 'لفتح وتنزيل تطبيق الويب فوراً بجوالك' : 'To open and install PWA instantly'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="max-w-4xl mx-auto bg-gradient-to-br from-blue-600 to-indigo-700 rounded-4xl p-8 md:p-14 text-center space-y-8 relative shadow-2xl shadow-blue-900/30">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
          <h2 className="text-3xl md:text-4xl font-extrabold text-white">
            {t.landing.ctaTitle}
          </h2>
          <p className="text-blue-100 max-w-xl mx-auto text-sm md:text-base leading-relaxed">
            {t.landing.ctaDesc}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <button 
              onClick={() => handleGoToAuth(false)}
              className="w-full sm:w-auto bg-white hover:bg-blue-50 text-blue-700 text-base font-bold px-8 py-4 rounded-xl transition-all shadow-md cursor-pointer border-none"
            >
              {t.landing.startFree}
            </button>
            <button 
              onClick={() => handleGoToAuth(true)}
              className="w-full sm:w-auto bg-blue-700/50 hover:bg-blue-700/80 border border-blue-400/30 text-white text-base font-bold px-8 py-4 rounded-xl transition-all cursor-pointer"
            >
              {t.landing.haveAccount}
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-900/80 py-8 text-center text-xs text-slate-500 font-semibold bg-slate-950/40">
        <p>© {new Date().getFullYear()} {t.common.appName}. All rights reserved.</p>
      </footer>
    </div>
  );
}
