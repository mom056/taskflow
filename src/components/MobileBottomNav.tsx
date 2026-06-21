import { LayoutDashboard, CheckSquare, MapPin, Users, BarChart3, History } from 'lucide-react';
import { useTranslation } from '../contexts/LanguageContext';

interface MobileBottomNavProps {
  activeTab: 'overview' | 'tasks' | 'visits' | 'employees' | 'analytics' | 'activity';
  onChange: (tab: 'overview' | 'tasks' | 'visits' | 'employees' | 'analytics' | 'activity') => void;
}

const items = [
  { id: 'overview' as const, icon: LayoutDashboard },
  { id: 'tasks' as const, icon: CheckSquare },
  { id: 'visits' as const, icon: MapPin },
  { id: 'employees' as const, icon: Users },
  { id: 'activity' as const, icon: History },
  { id: 'analytics' as const, icon: BarChart3 },
];

export default function MobileBottomNav({ activeTab, onChange }: MobileBottomNavProps) {
  const { language } = useTranslation();

  const getLabel = (id: string) => {
    switch (id) {
      case 'overview': return language === 'ar' ? 'الرئيسية' : 'Overview';
      case 'tasks': return language === 'ar' ? 'المهام' : 'Tasks';
      case 'visits': return language === 'ar' ? 'الزيارات' : 'Visits';
      case 'employees': return language === 'ar' ? 'الفريق' : 'Team';
      case 'activity': return language === 'ar' ? 'السجل' : 'Activity';
      case 'analytics': return language === 'ar' ? 'التقارير' : 'Reports';
      default: return '';
    }
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex md:hidden z-50 shadow-[0_-2px_16px_rgba(0,0,0,0.06)] safe-pb"
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-all duration-200 ${
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
    </nav>
  );
}
