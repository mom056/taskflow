import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Task, TaskStatus, User } from '../types';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task?: Task | null;
  employees: User[];
  currentUserId: string;
}

export default function TaskModal({ isOpen, onClose, task, employees, currentUserId }: TaskModalProps) {
  const { profile } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    employeeId: '',
    location: '',
    status: 'new' as TaskStatus,
    dueDate: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        description: task.description || '',
        employeeId: task.employeeId,
        location: task.location || '',
        status: task.status,
        dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      });
    } else {
      setFormData({
        title: '',
        description: '',
        employeeId: '',
        location: '',
        status: 'new',
        dueDate: '',
      });
    }
  }, [task, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Parse the date and set time to noon to avoid timezone shift issues
    const dueDateTimestamp = formData.dueDate ? new Date(`${formData.dueDate}T12:00:00`).getTime() : null;

    try {
      if (task) {
        // Edit existing task
        const { error } = await supabase
          .from('tasks')
          .update({
            title: formData.title,
            description: formData.description,
            employee_id: formData.employeeId,
            location: formData.location,
            status: formData.status,
            due_date: dueDateTimestamp,
            updated_at: Date.now()
          })
          .eq('id', task.id);
          
        if (error) throw error;
        toast.success('تم تعديل المهمة بنجاح');
      } else {
        // Create new task
        const { error } = await supabase
          .from('tasks')
          .insert([{
            title: formData.title,
            description: formData.description,
            status: 'new',
            employee_id: formData.employeeId,
            location: formData.location,
            due_date: dueDateTimestamp,
            created_by: currentUserId,
            company_id: profile?.company_id,
            created_at: Date.now(),
            updated_at: Date.now()
          }]);
          
        if (error) throw error;
        toast.success('تمت إضافة المهمة بنجاح');
      }
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onClose();
    } catch (error: any) {
      console.error('[TaskModal] Error:', error);
      const isPermissionError = error?.code === '42501' || error?.message?.includes('policy');
      toast.error(isPermissionError
        ? 'ليس لديك صلاحية لهذا الإجراء'
        : 'حدث خطأ غير متوقع، يرجى المحاولة مجدداً'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true" dir="rtl">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" aria-hidden="true" onClick={onClose}></div>
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
        <div className="relative z-10 inline-block align-bottom bg-white rounded-2xl text-right overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-slate-100">
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <h3 className="text-xl font-bold text-slate-900 mb-6" id="modal-title">
                {task ? 'تعديل المهمة' : 'إنشاء مهمة جديدة'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">عنوان المهمة</label>
                  <input 
                    required
                    type="text" 
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    className="w-full border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-3 border outline-none transition" 
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">وصف المهمة (اختياري)</label>
                  <textarea 
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="w-full border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-3 border outline-none transition" 
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">تاريخ التنفيذ</label>
                    <input 
                      type="date" 
                      value={formData.dueDate}
                      onChange={e => setFormData({...formData, dueDate: e.target.value})}
                      className="w-full border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-3 border outline-none transition" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">اسم العميل أو المكان</label>
                    <input 
                      type="text" 
                      value={formData.location}
                      onChange={e => setFormData({...formData, location: e.target.value})}
                      className="w-full border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-3 border outline-none transition" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">الموظف المسؤول</label>
                    <select
                      required
                      value={formData.employeeId}
                      onChange={e => setFormData({...formData, employeeId: e.target.value})}
                      className="w-full border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-3 border outline-none transition bg-white"
                    >
                      <option value="">-- اختر موظف --</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  {task && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">حالة المهمة</label>
                      <select
                        required
                        value={formData.status}
                        onChange={e => setFormData({...formData, status: e.target.value as TaskStatus})}
                        className="w-full border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-3 border outline-none transition bg-white"
                      >
                        <option value="new">جديدة</option>
                        <option value="in_progress">جاري العمل</option>
                        <option value="completed">مكتملة</option>
                        <option value="pending">معلقة</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="bg-slate-50 px-4 py-4 sm:px-6 sm:flex sm:flex-row-reverse border-t border-slate-100 gap-3">
              <button disabled={isSubmitting} type="submit" className="w-full inline-flex justify-center rounded-xl border border-transparent px-6 py-2.5 bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none sm:w-auto disabled:opacity-50">
                {isSubmitting ? 'جاري الحفظ...' : 'حفظ المهمة'}
              </button>
              <button disabled={isSubmitting} type="button" onClick={onClose} className="mt-3 w-full inline-flex justify-center rounded-xl border border-slate-300 shadow-sm px-6 py-2.5 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none sm:mt-0 sm:w-auto disabled:opacity-50">
                إلغاء
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
