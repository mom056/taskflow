import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Task } from '../../types';
import { startOfDay, subDays, format, isSameDay } from 'date-fns';
import { ar } from 'date-fns/locale';

interface WeeklyPerformanceChartProps {
  tasks: Task[];
}

export default function WeeklyPerformanceChart({ tasks }: WeeklyPerformanceChartProps) {
  const chartData = useMemo(() => {
    const completedTasks = tasks.filter(t => t.status === 'completed' && t.updatedAt);
    
    // Generate last 7 days
    return Array.from({ length: 7 }).map((_, i) => {
      const date = subDays(new Date(), 6 - i);
      const dayName = format(date, 'EEEE', { locale: ar });
      
      const count = completedTasks.filter(t => {
        const taskDate = new Date(t.updatedAt);
        return isSameDay(startOfDay(date), startOfDay(taskDate));
      }).length;

      return {
        name: dayName,
        'المهام المنجزة': count,
      };
    });
  }, [tasks]);

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
      <div>
        <h3 className="font-bold text-slate-800 text-sm md:text-base">معدل الإنجاز الأسبوعي</h3>
        <p className="text-xs text-slate-400 mt-0.5">عدد المهام التي تم إنجازها يومياً خلال الـ 7 أيام الماضية</p>
      </div>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%" minHeight={200}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
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
            />
            <Tooltip 
              contentStyle={{ 
                direction: 'rtl', 
                textAlign: 'right', 
                borderRadius: '12px', 
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                fontFamily: 'system-ui',
                fontSize: '12px'
              }} 
            />
            <Area 
              type="monotone" 
              dataKey="المهام المنجزة" 
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
