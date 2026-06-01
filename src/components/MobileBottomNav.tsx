import { LayoutDashboard, CheckSquare, MapPin, Users, BarChart3 } from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: 'overview' | 'tasks' | 'visits' | 'employees' | 'analytics';
  onChange: (tab: 'overview' | 'tasks' | 'visits' | 'employees' | 'analytics') => void;
}

const items = [
  { id: 'overview' as const, icon: LayoutDashboard, label: 'الرئيسية' },
  { id: 'tasks' as const, icon: CheckSquare, label: 'المهام' },
  { id: 'visits' as const, icon: MapPin, label: 'الزيارات' },
  { id: 'employees' as const, icon: Users, label: 'الفريق' },
  { id: 'analytics' as const, icon: BarChart3, label: 'التقارير' },
];

export default function MobileBottomNav({ activeTab, onChange }: MobileBottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex md:hidden z-50 shadow-[0_-2px_16px_rgba(0,0,0,0.06)]"
      dir="rtl"
    >
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-all duration-200 ${
            activeTab === item.id
              ? 'text-blue-600'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <div className={`p-1.5 rounded-xl transition-all duration-200 ${activeTab === item.id ? 'bg-blue-50' : ''}`}>
            <item.icon className={`transition-all duration-200 ${activeTab === item.id ? 'w-5 h-5' : 'w-5 h-5'}`} />
          </div>
          <span className={`text-[10px] font-semibold tracking-wide transition-all duration-200 ${activeTab === item.id ? 'text-blue-600' : 'text-slate-400'}`}>
            {item.label}
          </span>
        </button>
      ))}
    </nav>
  );
}
