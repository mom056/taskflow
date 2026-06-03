import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Task, User } from '../../types';

interface EmployeePerformanceChartProps {
  tasks: Task[];
  employees: User[];
}

export default function EmployeePerformanceChart({ tasks, employees }: EmployeePerformanceChartProps) {
  const chartData = useMemo(() => {
    return employees.map(emp => {
      const empTasks = tasks.filter(t => t.employeeId === emp.id);
      const completed = empTasks.filter(t => t.status === 'completed').length;
      
      return {
        name: emp.name || emp.email.split('@')[0],
        'إجمالي المهام': empTasks.length,
        'المهام المكتملة': completed,
      };
    });
  }, [tasks, employees]);

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
      <div>
        <h3 className="font-bold text-slate-800 text-sm md:text-base">مقارنة أداء الموظفين</h3>
        <p className="text-xs text-slate-400 mt-0.5">مقارنة المهام الكلية بالمهام المنجزة لكل موظف</p>
      </div>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%" minHeight={200}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
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
            <Legend 
              verticalAlign="top" 
              height={36} 
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: '11px', fontFamily: 'system-ui' }} 
            />
            <Bar dataKey="إجمالي المهام" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={30} opacity={0.3} />
            <Bar dataKey="المهام المكتملة" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
