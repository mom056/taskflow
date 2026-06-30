import { useState } from 'react';
import { LayoutDashboard, CheckSquare, MapPin, Users, BarChart3, History, Clock, FileText, Menu, X } from 'lucide-react';
import { useTranslation } from '../contexts/LanguageContext';

interface MobileBottomNavProps {
  activeTab: 'overview' | 'tasks' | 'visits' | 'employees' | 'analytics' | 'activity' | 'attendance' | 'leaves';
  onChange: (tab: 'overview' | 'tasks' | 'visits' | 'employees' | 'analytics' | 'activity' | 'attendance' | 'leaves') => void;
}

export default function MobileBottomNav({ activeTab, onChange }: MobileBottomNavProps) {
  const { language } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const mainItems = [
    { id: 'overview' as const, icon: LayoutDashboard },
    { id: 'tasks' as const, icon: CheckSquare },
    { id: 'visits' as const, icon: MapPin },
    { id: 'employees' as const, icon: Users },
  ];

  const moreItems = [
    { id: 'attendance' as const, icon: Clock, color: 'text-emerald-500 bg-emerald-50' },
    { id: 'leaves' as const, icon: FileText, color: 'text-purple-500 bg-purple-50' },
    { id: 'activity' as const, icon: History, color: 'text-amber-500 bg-amber-50' },
    { id: 'analytics' as const, icon: BarChart3, color: 'text-blue-500 bg-blue-50' },
  ];

  const getLabel = (id: string) => {
    switch (id) {
      case 'overview': return language === 'ar' ? 'الرئيسية' : 'Overview';
      case 'tasks': return language === 'ar' ? 'المهام' : 'Tasks';
      case 'visits': return language === 'ar' ? 'الزيارات' : 'Visits';
      case 'employees': return language === 'ar' ? 'الفريق' : 'Team';
      case 'attendance': return language === 'ar' ? 'حضور وانصراف' : 'Attendance';
      case 'leaves': return language === 'ar' ? 'طلبات الإجازات' : 'Leave Requests';
      case 'activity': return language === 'ar' ? 'سجل العمليات' : 'Activity Logs';
      case 'analytics': return language === 'ar' ? 'التقارير' : 'Reports';
      case 'more': return language === 'ar' ? 'المزيد' : 'More';
      default: return '';
    }
  };

  const isMoreActive = moreItems.some(item => item.id === activeTab);

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex md:hidden z-50 shadow-[0_-2px_16px_rgba(0,0,0,0.06)] safe-pb"
        dir={language === 'ar' ? 'rtl' : 'ltr'}
      >
        {mainItems.map(item => (
          <button
            key={item.id}
            onClick={() => {
              setIsMenuOpen(false);
              onChange(item.id);
            }}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-all duration-200 border-none bg-transparent cursor-pointer ${
              activeTab === item.id
                ? 'text-blue-600'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <div className={`p-1 rounded-lg transition-all duration-200 ${activeTab === item.id ? 'bg-blue-50' : ''}`}>
              <item.icon className="w-4.5 h-4.5" />
            </div>
            <span className={`text-[9px] font-semibold tracking-wide transition-all duration-200 ${activeTab === item.id ? 'text-blue-600' : 'text-slate-400'}`}>
              {getLabel(item.id)}
            </span>
          </button>
        ))}

        {/* More Button */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-all duration-200 border-none bg-transparent cursor-pointer ${
            isMoreActive || isMenuOpen
              ? 'text-blue-600'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <div className={`p-1 rounded-lg transition-all duration-200 ${(isMoreActive || isMenuOpen) ? 'bg-blue-50' : ''}`}>
            {isMenuOpen ? <X className="w-4.5 h-4.5" /> : <Menu className="w-4.5 h-4.5" />}
          </div>
          <span className={`text-[9px] font-semibold tracking-wide transition-all duration-200 ${(isMoreActive || isMenuOpen) ? 'text-blue-600' : 'text-slate-400'}`}>
            {getLabel('more')}
          </span>
        </button>
      </nav>

      {/* Drawer / Bottom Sheet */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden animate-fadeIn">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" 
            onClick={() => setIsMenuOpen(false)}
          />
          
          {/* Bottom Sheet Card */}
          <div 
            className="absolute bottom-20 left-4 right-4 bg-white border border-slate-100 rounded-3xl p-5 shadow-2xl"
            dir={language === 'ar' ? 'rtl' : 'ltr'}
          >
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4" />
            <h4 className="text-xs font-bold text-slate-400 mb-3 px-1 text-start">{language === 'ar' ? 'أقسام إضافية' : 'More Sections'}</h4>
            
            <div className="grid grid-cols-2 gap-3">
              {moreItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    onChange(item.id);
                    setIsMenuOpen(false);
                  }}
                  className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    language === 'ar' ? 'text-right' : 'text-left'
                  } ${
                    activeTab === item.id
                      ? 'border-blue-500 bg-blue-50/30'
                      : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${item.color}`}>
                    <item.icon className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-800 leading-tight">{getLabel(item.id)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
