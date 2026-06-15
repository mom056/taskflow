import { Task, User, statusLabels, statusColors, TaskStatus } from '../types';
import { format } from 'date-fns';
import { Edit2, Trash2 } from 'lucide-react';
import { useTranslation } from '../contexts/LanguageContext';

interface TasksTableProps {
  tasks: Task[];
  employees: User[];
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onView?: (task: Task) => void;
}

export default function TasksTable({ tasks, employees, onEdit, onDelete, onView }: TasksTableProps) {
  const { t, language } = useTranslation();

  const getEmployeeName = (id: string | null) => {
    if (!id) return language === 'ar' ? 'غير مسندة' : 'Unassigned';
    return employees.find(e => e.id === id)?.name || (language === 'ar' ? 'غير معروف' : 'Unknown');
  };

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

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={`${language === 'ar' ? 'text-right' : 'text-left'} p-4 border-b-2 border-slate-100 text-slate-500 text-sm font-normal`}>
              {language === 'ar' ? 'المهمة' : 'Task'}
            </th>
            <th className={`${language === 'ar' ? 'text-right' : 'text-left'} p-4 border-b-2 border-slate-100 text-slate-500 text-sm font-normal`}>
              {language === 'ar' ? 'الموظف' : 'Employee'}
            </th>
            <th className={`${language === 'ar' ? 'text-right' : 'text-left'} p-4 border-b-2 border-slate-100 text-slate-500 text-sm font-normal`}>
              {language === 'ar' ? 'المكان' : 'Location'}
            </th>
            <th className={`${language === 'ar' ? 'text-right' : 'text-left'} p-4 border-b-2 border-slate-100 text-slate-500 text-sm font-normal`}>
              {language === 'ar' ? 'تاريخ التنفيذ' : 'Due Date'}
            </th>
            <th className={`${language === 'ar' ? 'text-right' : 'text-left'} p-4 border-b-2 border-slate-100 text-slate-500 text-sm font-normal`}>
              {language === 'ar' ? 'الحالة' : 'Status'}
            </th>
            <th className={`${language === 'ar' ? 'text-right' : 'text-left'} p-4 border-b-2 border-slate-100 text-slate-500 text-sm font-normal`}>
              {language === 'ar' ? 'تاريخ الإنشاء' : 'Created At'}
            </th>
            {(onEdit || onDelete) && (
              <th className="text-center p-4 border-b-2 border-slate-100 text-slate-500 text-sm font-normal">
                {language === 'ar' ? 'إجراءات' : 'Actions'}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {tasks.map(task => (
            <tr 
              key={task.id} 
              onClick={() => onView?.(task)}
              className="hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <td className="p-4 border-b border-slate-100">
                <div className="text-sm font-semibold text-slate-900">{task.title}</div>
                {task.description && <div className="text-xs text-slate-500 mt-1 truncate max-w-xs">{task.description}</div>}
              </td>
              <td className="p-4 border-b border-slate-100 text-sm text-slate-700">
                {getEmployeeName(task.employeeId)}
              </td>
              <td className="p-4 border-b border-slate-100 text-sm text-slate-500">
                {task.location || '-'}
              </td>
              <td className="p-4 border-b border-slate-100 text-sm text-slate-500">
                {task.dueDate ? format(task.dueDate, 'yyyy/MM/dd') : '-'}
              </td>
              <td className="p-4 border-b border-slate-100">
                <span className={`px-3 py-1 inline-flex text-xs font-semibold rounded-full ${statusColors[task.status]}`}>
                  {getStatusLabel(task.status)}
                </span>
              </td>
              <td className="p-4 border-b border-slate-100 text-sm text-slate-500">
                {format(task.createdAt, 'yyyy/MM/dd')}
              </td>
              {(onEdit || onDelete) && (
                <td className="p-4 border-b border-slate-100 text-center" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-center gap-2">
                    {onEdit && (
                      <button onClick={() => onEdit(task)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border-none bg-transparent cursor-pointer" title={language === 'ar' ? 'تعديل' : 'Edit'}>
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    {onDelete && (
                      <button onClick={() => onDelete(task)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border-none bg-transparent cursor-pointer" title={language === 'ar' ? 'حذف' : 'Delete'}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
          {tasks.length === 0 && (
            <tr>
              <td colSpan={(onEdit || onDelete) ? 7 : 6} className="p-6 text-center text-slate-500">
                {language === 'ar' ? 'لا توجد مهام مطابقة' : 'No matching tasks'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
