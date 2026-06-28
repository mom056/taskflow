import { Task, User, statusLabels, statusColors, TaskStatus } from '../types';
import { format } from 'date-fns';
import { Edit2, Trash2, MapPin } from 'lucide-react';
import { useTranslation } from '../contexts/LanguageContext';
import { openExternalUrl } from '../lib/nativeServices';

interface TasksTableProps {
  tasks: Task[];
  employees: User[];
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onView?: (task: Task) => void;
}

export default function TasksTable({ tasks, employees, onEdit, onDelete, onView }: TasksTableProps) {
  const { language } = useTranslation();

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

  const handleLocationClick = async (e: React.MouseEvent, task: Task) => {
    e.stopPropagation(); // Prevent card details popup
    if (task.latitude && task.longitude) {
      const mapUrl = `https://www.google.com/maps/search/?api=1&query=${task.latitude},${task.longitude}`;
      await openExternalUrl(mapUrl);
    } else if (task.location) {
      const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.location)}`;
      await openExternalUrl(mapUrl);
    }
  };

  return (
    <div className="w-full">
      {/* 🖥️ Desktop Table View (Hidden on mobile) */}
      <div className="hidden md:block overflow-x-auto">
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
                className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
              >
                <td className="p-4 border-b border-slate-100 dark:border-slate-700">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{task.title}</div>
                  {task.description && <div className="text-xs text-slate-500 mt-1 truncate max-w-xs">{task.description}</div>}
                </td>
                <td className="p-4 border-b border-slate-100 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300">
                  {getEmployeeName(task.employeeId)}
                </td>
                <td className="p-4 border-b border-slate-100 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400">
                  {task.location ? (
                    <button 
                      onClick={(e) => handleLocationClick(e, task)} 
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 border-none bg-transparent cursor-pointer text-right p-0"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="truncate max-w-xs">{task.location}</span>
                    </button>
                  ) : '-'}
                </td>
                <td className="p-4 border-b border-slate-100 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400">
                  {task.dueDate ? format(task.dueDate, 'yyyy/MM/dd') : '-'}
                </td>
                <td className="p-4 border-b border-slate-100 dark:border-slate-700">
                  <span className={`px-3 py-1 inline-flex text-xs font-semibold rounded-full ${statusColors[task.status]}`}>
                    {getStatusLabel(task.status)}
                  </span>
                </td>
                <td className="p-4 border-b border-slate-100 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400">
                  {format(task.createdAt, 'yyyy/MM/dd')}
                </td>
                {(onEdit || onDelete) && (
                  <td className="p-4 border-b border-slate-100 dark:border-slate-700 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-center gap-2">
                      {onEdit && (
                        <button onClick={() => onEdit(task)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors border-none bg-transparent cursor-pointer" title={language === 'ar' ? 'تعديل' : 'Edit'}>
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {onDelete && (
                        <button onClick={() => onDelete(task)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors border-none bg-transparent cursor-pointer" title={language === 'ar' ? 'حذف' : 'Delete'}>
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

      {/* 📱 Mobile Action-First Cards View (Hidden on desktop) */}
      <div className="block md:hidden space-y-3 px-1">
        {tasks.map(task => (
          <div
            key={task.id}
            onClick={() => onView?.(task)}
            className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 border border-slate-100 dark:border-slate-700/60 transition-transform active:scale-[0.99] cursor-pointer relative status-edge-${task.status}`}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{task.title}</h3>
                {task.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {task.description}
                  </p>
                )}
              </div>
              <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${statusColors[task.status]}`}>
                {getStatusLabel(task.status)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-y-2 gap-x-4 mt-3 pt-3 border-t border-slate-50 dark:border-slate-700/40 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">{language === 'ar' ? 'الموظف المسند' : 'Assigned Employee'}</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{getEmployeeName(task.employeeId)}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">{language === 'ar' ? 'تاريخ التنفيذ' : 'Due Date'}</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {task.dueDate ? format(task.dueDate, 'yyyy/MM/dd') : '-'}
                </span>
              </div>
              {task.location && (
                <div className="col-span-2">
                  <span className="text-slate-400 block mb-1">{language === 'ar' ? 'الموقع الجغرافي' : 'Location'}</span>
                  <button 
                    onClick={(e) => handleLocationClick(e, task)} 
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 border-none bg-transparent cursor-pointer font-medium text-right p-0"
                  >
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate max-w-[260px]">{task.location}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Actions overlay footer for mobile cards */}
            {(onEdit || onDelete) && (
              <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-slate-50 dark:border-slate-700/40" onClick={(e) => e.stopPropagation()}>
                {onEdit && (
                  <button 
                    onClick={() => onEdit(task)} 
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded-lg transition-colors border border-blue-100 dark:border-blue-900/50 bg-transparent cursor-pointer font-medium"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>{language === 'ar' ? 'تعديل' : 'Edit'}</span>
                  </button>
                )}
                {onDelete && (
                  <button 
                    onClick={() => onDelete(task)} 
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors border border-red-100 dark:border-red-900/50 bg-transparent cursor-pointer font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{language === 'ar' ? 'حذف' : 'Delete'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {tasks.length === 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-8 text-center text-slate-500 border border-slate-100 dark:border-slate-700/50">
            {language === 'ar' ? 'لا توجد مهام مطابقة' : 'No matching tasks'}
          </div>
        )}
      </div>
    </div>
  );
}
