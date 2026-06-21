import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, Check, Trash2 } from 'lucide-react';
import { useNotifications, Notification } from '../hooks/useNotifications';
import { useTranslation } from '../contexts/LanguageContext';

export default function NotificationCenter() {
  const [isOpen, setOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const { language } = useTranslation();
  const navigate = useNavigate();

  const handleNotificationClick = (notif: Notification) => {
    if (!notif.isRead) {
      markAsRead(notif.id);
    }
    if (notif.link) {
      navigate(notif.link);
      setOpen(false);
    }
  };

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return language === 'ar' ? 'الآن' : 'Just now';
    if (minutes < 60) return language === 'ar' ? `منذ ${minutes} د` : `${minutes}m ago`;
    if (hours < 24) return language === 'ar' ? `منذ ${hours} س` : `${hours}h ago`;
    return language === 'ar' ? `منذ ${days} ي` : `${days}d ago`;
  };

  return (
    <>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(true)}
        className="relative p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer shadow-xs"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white dark:border-slate-900 animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Slide-over Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
          {/* Backdrop Click */}
          <div className="absolute inset-0" onClick={() => setOpen(false)} />

          {/* Drawer Container */}
          <div
            className={`relative w-full max-w-sm h-full bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-2xl flex flex-col z-10 transition-transform ${
              language === 'ar' ? 'border-r rounded-l-3xl' : 'border-l rounded-r-3xl'
            }`}
            dir={language === 'ar' ? 'rtl' : 'ltr'}
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm m-0">
                  {language === 'ar' ? 'مركز الإشعارات' : 'Notification Center'}
                </h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full border-none bg-transparent cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Actions Bar */}
            {notifications.length > 0 && (
              <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-medium">
                  {language === 'ar'
                    ? `لديك ${unreadCount} إشعار غير مقروء`
                    : `You have ${unreadCount} unread`}
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllAsRead()}
                    className="text-blue-600 dark:text-blue-400 hover:underline border-none bg-transparent font-bold cursor-pointer flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {language === 'ar' ? 'تحديد الكل كمقروء' : 'Mark all as read'}
                  </button>
                )}
              </div>
            )}

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800/60">
              {notifications.length > 0 ? (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-4 flex gap-3.5 transition-colors relative group ${
                      notif.isRead
                        ? 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                        : 'bg-blue-50/30 dark:bg-blue-950/10 hover:bg-blue-50/50 dark:hover:bg-blue-950/20'
                    }`}
                  >
                    {/* Unread indicator dot */}
                    {!notif.isRead && (
                      <span className="absolute top-4 right-4 w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full" />
                    )}

                    {/* Notification content */}
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => handleNotificationClick(notif)}
                    >
                      <h4
                        className={`text-sm m-0 ${
                          notif.isRead
                            ? 'text-slate-700 dark:text-slate-300 font-medium'
                            : 'text-slate-900 dark:text-white font-bold'
                        }`}
                      >
                        {notif.title}
                      </h4>
                      {notif.body && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-0 leading-relaxed">
                          {notif.body}
                        </p>
                      )}
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium block mt-2">
                        {formatTime(notif.createdAt)}
                      </span>
                    </div>

                    {/* Delete action */}
                    <button
                      onClick={() => deleteNotification(notif.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 self-center text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all border-none bg-transparent cursor-pointer shrink-0"
                      title={language === 'ar' ? 'حذف الإشعار' : 'Delete notification'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 dark:text-slate-500">
                  <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-4">
                    <Bell className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                  </div>
                  <h5 className="font-bold text-slate-700 dark:text-slate-300 m-0">
                    {language === 'ar' ? 'علبة الوارد فارغة' : 'Inbox is empty'}
                  </h5>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-[200px] mx-auto">
                    {language === 'ar'
                      ? 'لا توجد إشعارات جديدة لديك في الوقت الحالي'
                      : 'You do not have any notifications at the moment'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
