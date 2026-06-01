import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Task, statusLabels } from '../../types';

interface TaskStatusDonutProps {
  tasks: Task[];
}

export default function TaskStatusDonut({ tasks }: TaskStatusDonutProps) {
  const chartData = useMemo(() => {
    const counts = {
      new: tasks.filter(t => t.status === 'new').length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      pending: tasks.filter(t => t.status === 'pending').length,
    };

    return [
      { name: statusLabels.new, value: counts.new, color: '#3b82f6' },
      { name: statusLabels.in_progress, value: counts.in_progress, color: '#f59e0b' },
      { name: statusLabels.completed, value: counts.completed, color: '#10b981' },
      { name: statusLabels.pending, value: counts.pending, color: '#ef4444' },
    ].filter(item => item.value > 0); // Only display statuses with > 0 tasks
  }, [tasks]);

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between h-full">
      <div>
        <h3 className="font-bold text-slate-800 text-sm md:text-base">توزيع حالات المهام</h3>
        <p className="text-xs text-slate-400 mt-0.5">نسب ومقادير توزيع المهام حسب حالتها الحالية</p>
      </div>
      
      {chartData.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-xs text-slate-400 font-semibold">
          لا تتوفر مهام لتصنيفها حالياً
        </div>
      ) : (
        <div className="h-[200px] w-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  direction: 'rtl', 
                  textAlign: 'right', 
                  borderRadius: '12px', 
                  border: '1px solid #e2e8f0',
                  fontFamily: 'system-ui',
                  fontSize: '11px'
                }} 
              />
              <Legend 
                verticalAlign="bottom" 
                height={36} 
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '11px', fontFamily: 'system-ui' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
