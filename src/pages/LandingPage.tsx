import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Cloud, BarChart3, Users, ArrowLeft, CheckCircle, Zap, Shield, Smartphone, Download, Share } from 'lucide-react';
import { useTranslation } from '../contexts/LanguageContext';
import AppLogo from '../components/AppLogo';

export default function LandingPage() {
  const navigate = useNavigate();
  const { t, language, changeLanguage } = useTranslation();
  const [downloadPlatform, setDownloadPlatform] = useState<'android' | 'ios'>('android');

  const handleGoToAuth = (isLogin: boolean) => {
    navigate('/login', { state: { isLogin } });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 selection:bg-blue-600 selection:text-white overflow-hidden relative font-sans" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Dynamic Background Gradients */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[150px] pointer-events-none" />

      {/* Header / Navbar */}
      <header className="border-b border-slate-800/80 backdrop-blur-md sticky top-0 z-50 bg-slate-900/90">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <AppLogo size={36} theme="dark" />
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => changeLanguage(language === 'ar' ? 'en' : 'ar')}
              className="text-xs font-bold bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 px-3 py-2 rounded-xl transition-colors cursor-pointer"
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
      <section className="relative pt-20 pb-24 md:pt-28 md:pb-32 px-6">
        <div className="max-w-5xl mx-auto text-center space-y-8 relative z-10">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold px-4 py-1.5 rounded-full">
            <Zap className="w-3.5 h-3.5" />
            <span>{t.landing.subtitle}</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight max-w-4xl mx-auto">
            {language === 'ar' ? (
              <>
                تابع أعمال فريقك الميداني وتأكد من <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">إنجاز المهام بدقة</span>
              </>
            ) : (
              <>
                Track Your Field Team & Ensure <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">Accurate Completion</span>
              </>
            )}
          </h1>
          
          <p className="text-base md:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed font-medium">
            {t.landing.desc}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button 
              onClick={() => handleGoToAuth(false)}
              className={`w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-base font-bold px-8 py-4 rounded-xl transition-all shadow-lg hover:shadow-blue-600/35 hover:-translate-y-0.5 flex items-center justify-center gap-3 cursor-pointer border-none ${language === 'en' ? 'flex-row-reverse' : ''}`}
            >
              <span>{t.landing.startFreeNow}</span>
              <ArrowLeft className={`w-5 h-5 ${language === 'en' ? 'rotate-180' : ''}`} />
            </button>
            <button 
              onClick={() => handleGoToAuth(true)}
              className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-base font-bold px-8 py-4 rounded-xl transition-all hover:-translate-y-0.5 cursor-pointer"
            >
              {t.landing.featuresDemo}
            </button>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto pt-16">
            {[
              { label: t.landing.stats.gpsAccuracy, value: '100%' },
              { label: t.landing.stats.offlineReady, value: 'Offline-First' },
              { label: t.landing.stats.reports, value: 'PDF / Excel' },
              { label: t.landing.stats.realtimeSync, value: 'Realtime' }
            ].map((stat, i) => (
              <div key={i} className="bg-slate-800/40 border border-slate-800/60 p-4 rounded-2xl">
                <p className="text-2xl font-extrabold text-blue-400">{stat.value}</p>
                <p className="text-xs text-slate-400 mt-1 font-semibold">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid Section */}
      <section className="py-24 px-6 border-t border-slate-800/40 bg-slate-900/50">
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
              <div key={idx} className="bg-slate-800/30 border border-slate-800/50 p-6 md:p-8 rounded-3xl hover:border-slate-700/60 transition-all hover:bg-slate-800/40 group">
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
      <section className="py-24 px-6 border-t border-slate-800/40 relative">
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

          <div className="grid md:grid-cols-12 gap-8 items-center bg-slate-800/25 border border-slate-800/60 rounded-4xl p-6 md:p-10 backdrop-blur-xs">
            {/* Left: Setup Guidelines & Platform Tabs */}
            <div className="md:col-span-7 space-y-6">
              {/* Tab Selector */}
              <div className="flex border border-slate-700/60 rounded-xl p-1 bg-slate-900/60 w-fit select-none">
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
                      href="https://github.com/mom056/taskflow/releases/latest"
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

            {/* Right: QR Code Visualizer card */}
            <div className="md:col-span-5 flex flex-col items-center justify-center space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col items-center space-y-4 relative overflow-hidden w-64">
                {/* Visual grid overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:14px_24px] opacity-10 pointer-events-none" />
                
                <div className="bg-white p-3 rounded-2xl shadow-inner relative z-10">
                  <svg width="140" height="140" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-slate-900">
                    <path d="M10 10H50V50H10V10ZM20 20V40H40V20H20Z" fill="currentColor"/>
                    <path d="M90 10H130V50H90V10ZM100 20V40H120V20H100Z" fill="currentColor"/>
                    <path d="M10 90H50V130H10V90ZM20 100V120H40V100H20Z" fill="currentColor"/>
                    <rect x="25" y="25" width="10" height="10" fill="currentColor"/>
                    <rect x="105" y="25" width="10" height="10" fill="currentColor"/>
                    <rect x="25" y="105" width="10" height="10" fill="currentColor"/>
                    <rect x="60" y="10" width="10" height="10" fill="currentColor"/>
                    <rect x="75" y="20" width="10" height="10" fill="currentColor"/>
                    <rect x="60" y="40" width="10" height="10" fill="currentColor"/>
                    <rect x="75" y="50" width="10" height="10" fill="currentColor"/>
                    <rect x="10" y="65" width="10" height="15" fill="currentColor"/>
                    <rect x="30" y="70" width="15" height="10" fill="currentColor"/>
                    <rect x="65" y="70" width="10" height="20" fill="currentColor"/>
                    <rect x="80" y="80" width="20" height="10" fill="currentColor"/>
                    <rect x="110" y="65" width="15" height="15" fill="currentColor"/>
                    <rect x="125" y="90" width="10" height="25" fill="currentColor"/>
                    <rect x="95" y="105" width="15" height="10" fill="currentColor"/>
                    <rect x="60" y="115" width="20" height="10" fill="currentColor"/>
                    <rect x="75" y="95" width="10" height="15" fill="currentColor"/>
                  </svg>
                </div>
                <div className="text-center relative z-10">
                  <span className="text-xs font-bold text-slate-300 block">
                    {language === 'ar' ? 'امسح الرمز ضوئياً' : 'Scan QR Code'}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    {language === 'ar' ? 'لتنزيل التطبيق أو فتحه فوراً بجوالك' : 'To download or view on mobile'}
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
      <footer className="border-t border-slate-800/60 py-8 text-center text-xs text-slate-500 font-semibold bg-slate-950/40">
        <p>© {new Date().getFullYear()} {t.common.appName}. All rights reserved.</p>
      </footer>
    </div>
  );
}
