import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Task, statusLabels, TaskStatus } from '../../types';
import { useTranslation } from '../../contexts/LanguageContext';

interface TaskStatusDonutProps {
  tasks: Task[];
}

export default function TaskStatusDonut({ tasks }: TaskStatusDonutProps) {
  const { language } = useTranslation();

  const getStatusLabel = (status: TaskStatus) => {
    if (language === 'en') {
      const labels: Record<TaskStatus, string> = {
        new: 'New',
        pending: 'Pending',
        in_progress: 'In Progress',
        completed: 'Completed',
      };
      return labels[status];
    }
    return statusLabels[status];
  };

  const chartData = useMemo(() => {
    const counts = {
      new: tasks.filter(t => t.status === 'new').length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      pending: tasks.filter(t => t.status === 'pending').length,
    };

    return [
      { name: getStatusLabel('new'), value: counts.new, color: '#3b82f6' },
      { name: getStatusLabel('in_progress'), value: counts.in_progress, color: '#f59e0b' },
      { name: getStatusLabel('completed'), value: counts.completed, color: '#10b981' },
      { name: getStatusLabel('pending'), value: counts.pending, color: '#ef4444' },
    ].filter(item => item.value > 0); // Only display statuses with > 0 tasks
  }, [tasks, language]);

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between h-full">
      <div>
        <h3 className="font-bold text-slate-800 text-sm md:text-base">
          {language === 'ar' ? 'توزيع حالات المهام' : 'Task Status Distribution'}
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          {language === 'ar' 
            ? 'نسب ومقادير توزيع المهام حسب حالتها الحالية' 
            : 'Proportion of tasks assigned by their current status'}
        </p>
      </div>
      
      {chartData.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-xs text-slate-400 font-semibold">
          {language === 'ar' ? 'لا تتوفر مهام لتصنيفها حالياً' : 'No tasks available to classify'}
        </div>
      ) : (
        <div className="h-[200px] w-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%" minHeight={180}>
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
                  direction: language === 'ar' ? 'rtl' : 'ltr', 
                  textAlign: language === 'ar' ? 'right' : 'left', 
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
