import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Task } from '../../types';
import { startOfDay, subDays, format, isSameDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useTranslation } from '../../contexts/LanguageContext';

interface WeeklyPerformanceChartProps {
  tasks: Task[];
}

export default function WeeklyPerformanceChart({ tasks }: WeeklyPerformanceChartProps) {
  const { language } = useTranslation();

  const chartData = useMemo(() => {
    const completedTasks = tasks.filter(t => t.status === 'completed' && t.updatedAt);
    
    // Generate last 7 days
    return Array.from({ length: 7 }).map((_, i) => {
      const date = subDays(new Date(), 6 - i);
      const dayName = format(date, 'EEEE', { locale: language === 'ar' ? ar : undefined });
      
      const count = completedTasks.filter(t => {
        const taskDate = new Date(t.updatedAt);
        return isSameDay(startOfDay(date), startOfDay(taskDate));
      }).length;

      const keyName = language === 'ar' ? 'المهام المنجزة' : 'Completed Tasks';

      return {
        name: dayName,
        [keyName]: count,
      };
    });
  }, [tasks, language]);

  const keyName = language === 'ar' ? 'المهام المنجزة' : 'Completed Tasks';

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
      <div>
        <h3 className="font-bold text-slate-800 text-sm md:text-base">
          {language === 'ar' ? 'معدل الإنجاز الأسبوعي' : 'Weekly Completion Rate'}
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          {language === 'ar' 
            ? 'عدد المهام التي تم إنجازها يومياً خلال الـ 7 أيام الماضية' 
            : 'Number of tasks completed daily over the past 7 days'}
        </p>
      </div>
      <div className="h-[250px] w-full" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <ResponsiveContainer width="100%" height="100%" minHeight={200}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: language === 'ar' ? -25 : -15, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0.01}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="name" 
              tickLine={false} 
              axisLine={false} 
              tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'system-ui' }} 
            />
            <YAxis 
              tickLine={false} 
              axisLine={false} 
              tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'system-ui' }} 
              allowDecimals={false}
              orientation={language === 'ar' ? 'right' : 'left'}
            />
            <Tooltip 
              contentStyle={{ 
                direction: language === 'ar' ? 'rtl' : 'ltr', 
                textAlign: language === 'ar' ? 'right' : 'left', 
                borderRadius: '12px', 
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                fontFamily: 'system-ui',
                fontSize: '12px'
              }} 
            />
            <Area 
              type="monotone" 
              dataKey={keyName} 
              stroke="#2563eb" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorCompleted)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
