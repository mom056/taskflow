import { X, MapPin, Bell, Settings, Lock } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

interface PermissionGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'gps' | 'push';
  language: 'ar' | 'en';
}

export default function PermissionGuideModal({ isOpen, onClose, type, language }: PermissionGuideModalProps) {
  if (!isOpen) return null;

  const isAr = language === 'ar';
  const isNative = Capacitor.isNativePlatform();
  const isIos = Capacitor.getPlatform() === 'ios';

  const title = type === 'gps'
    ? (isAr ? '📍 تفعيل صلاحيات الموقع (GPS)' : '📍 Enable Location Services (GPS)')
    : (isAr ? '🔔 تفعيل إشعارات المهام' : '🔔 Enable Notifications');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in" onClick={onClose}>
      <div 
        className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-2xl w-full max-w-md overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        dir={isAr ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm md:text-base flex items-center gap-2">
            {title}
          </h3>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 border-none bg-transparent cursor-pointer transition-colors"
          >
            <X className="w-5 h-5 text-slate-400 dark:text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs md:text-sm text-slate-600 dark:text-slate-300">
          {type === 'gps' ? (
            isNative ? (
              // Native Mobile GPS Guide
              <div className="space-y-3">
                <p className="font-medium text-slate-700 dark:text-slate-200">
                  {isAr 
                    ? 'يحتاج التطبيق للوصول لموقعك للتحقق من تواجدك في موقع المهمة مِيدانياً:' 
                    : 'The app requires access to your location to verify field arrival:'}
                </p>
                <ol className="list-decimal list-inside space-y-2 leading-relaxed">
                  <li>
                    {isAr 
                      ? 'افتح إعدادات الهاتف السريعة وتأكد من تفعيل خدمة تحديد الموقع (GPS).' 
                      : 'Open quick settings and ensure Location/GPS is turned on.'}
                  </li>
                  <li>
                    {isAr 
                      ? `اذهب إلى إعدادات الهاتف ➔ التطبيقات ➔ TaskFlow.` 
                      : `Go to Phone Settings ➔ Apps ➔ TaskFlow.`}
                  </li>
                  <li>
                    {isAr 
                      ? 'اختر "الأذونات" ثم "الموقع الجغرافي".' 
                      : 'Select "Permissions" then "Location".'}
                  </li>
                  <li>
                    {isAr 
                      ? 'حدد خيار "السماح عند استخدام التطبيق فقط" مع تفعيل "الموقع الجغرافي الدقيق".' 
                      : 'Select "Allow only while using the app" and enable "Use precise location".'}
                  </li>
                </ol>
              </div>
            ) : (
              // Web GPS Guide
              <div className="space-y-3">
                <p className="font-medium text-slate-700 dark:text-slate-200">
                  {isAr 
                    ? 'يرجى السماح للويب بالوصول إلى موقعك الجغرافي:' 
                    : 'Please allow the browser to access your location:'}
                </p>
                <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-950/30 p-3 rounded-xl border border-blue-100 dark:border-blue-900/50">
                  <Lock className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <p className="font-bold text-blue-800 dark:text-blue-300 text-xs">
                      {isAr ? 'خطوات التفعيل في المتصفح:' : 'Steps to enable in Browser:'}
                    </p>
                    <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1">
                      {isAr 
                        ? 'انقر على رمز القفل 🔒 أو النقاط الثلاث الموجودة بجانب رابط الموقع في شريط العناوين العلوي، ثم قم بتغيير صلاحية الموقع (Location) إلى "سماح" (Allow).' 
                        : 'Click on the lock icon 🔒 or the site settings icon next to the URL in the address bar, then change Location permission to "Allow".'}
                    </p>
                  </div>
                </div>
              </div>
            )
          ) : (
            isNative ? (
              // Native Mobile Push Notification Guide
              <div className="space-y-3">
                <p className="font-medium text-slate-700 dark:text-slate-200">
                  {isAr 
                    ? 'لتلقي إشعارات المهام المباشرة الصادرة من الإدارة:' 
                    : 'To receive push notifications for tasks assigned by managers:'}
                </p>
                <ol className="list-decimal list-inside space-y-2 leading-relaxed">
                  <li>
                    {isAr 
                      ? `اذهب إلى إعدادات الهاتف ➔ التطبيقات ➔ TaskFlow.` 
                      : `Go to Phone Settings ➔ Apps ➔ TaskFlow.`}
                  </li>
                  <li>
                    {isAr 
                      ? 'اختر "الإشعارات".' 
                      : 'Select "Notifications".'}
                  </li>
                  <li>
                    {isAr 
                      ? 'قم بتفعيل خيار "السماح بالإشعارات".' 
                      : 'Enable "Allow Notifications" option.'}
                  </li>
                </ol>
              </div>
            ) : (
              // Web Push Notification Guide
              <div className="space-y-3">
                <p className="font-medium text-slate-700 dark:text-slate-200">
                  {isAr 
                    ? 'يرجى تفعيل إشعارات المتصفح التنبيهية:' 
                    : 'Please enable browser notification alerts:'}
                </p>
                <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-950/30 p-3 rounded-xl border border-blue-100 dark:border-blue-900/50">
                  <Lock className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <p className="font-bold text-blue-800 dark:text-blue-300 text-xs">
                      {isAr ? 'خطوات التفعيل في المتصفح:' : 'Steps to enable in Browser:'}
                    </p>
                    <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1">
                      {isAr 
                        ? 'انقر على رمز القفل 🔒 في شريط عنوان المتصفح بالأعلى، ثم قم بتفعيل الإشعارات (Notifications) وتغيير خيارها إلى "سماح" (Allow).' 
                        : 'Click the lock icon 🔒 in your browser address bar at the top, then locate Notifications and change it to "Allow".'}
                    </p>
                  </div>
                </div>
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors border-none cursor-pointer shadow-xs"
          >
            {isAr ? 'حسناً، فهمت' : 'OK, I Got It'}
          </button>
        </div>
      </div>
    </div>
  );
}
