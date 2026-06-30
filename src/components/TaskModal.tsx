import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Task, TaskStatus, User } from '../types';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useActivityLog } from '../hooks/useActivityLog';
import toast from 'react-hot-toast';
import { useTranslation } from '../contexts/LanguageContext';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task?: Task | null;
  employees: User[];
  currentUserId: string;
}

export default function TaskModal({ isOpen, onClose, task, employees, currentUserId }: TaskModalProps) {
  const { profile } = useAuth();
  const { logActivity } = useActivityLog();
  const { t, language } = useTranslation();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    employeeId: '',
    location: '',
    status: 'new' as TaskStatus,
    dueDate: '',
    targetLatitude: '',
    targetLongitude: '',
  });
  const [isLocating, setIsLocating] = useState(false);
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
        targetLatitude: task.targetLatitude !== undefined && task.targetLatitude !== null ? task.targetLatitude.toString() : '',
        targetLongitude: task.targetLongitude !== undefined && task.targetLongitude !== null ? task.targetLongitude.toString() : '',
      });
    } else {
      setFormData({
        title: '',
        description: '',
        employeeId: '',
        location: '',
        status: 'new',
        dueDate: '',
        targetLatitude: '',
        targetLongitude: '',
      });
    }
  }, [task, isOpen]);

  if (!isOpen) return null;

  const handleAutoLocate = async () => {
    setIsLocating(true);
    try {
      const { getNativeLocation } = await import('../lib/nativeServices');
      const loc = await getNativeLocation();
      setFormData(prev => ({
        ...prev,
        targetLatitude: loc.latitude.toFixed(6),
        targetLongitude: loc.longitude.toFixed(6)
      }));
      toast.success(language === 'ar' ? 'تم جلب موقعك الحالي كإحداثيات مستهدفة!' : 'Current location loaded as target coordinates!');
    } catch (err: any) {
      toast.error(err.message || (language === 'ar' ? 'فشل جلب الموقع الجغرافي' : 'Failed to retrieve location'));
    } finally {
      setIsLocating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Parse the date and set time to noon to avoid timezone shift issues
    const dueDateTimestamp = formData.dueDate ? new Date(`${formData.dueDate}T12:00:00`).getTime() : null;

    const targetLatitudeNum = formData.targetLatitude ? parseFloat(formData.targetLatitude) : null;
    const targetLongitudeNum = formData.targetLongitude ? parseFloat(formData.targetLongitude) : null;

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
            target_latitude: targetLatitudeNum,
            target_longitude: targetLongitudeNum,
            updated_at: Date.now()
          })
          .eq('id', task.id);
          
        if (error) throw error;
        logActivity('task_updated', 'task', task.id, { title: formData.title });
        toast.success(language === 'ar' ? 'تم تعديل المهمة بنجاح' : 'Task updated successfully');
      } else {
        // Create new task
        const { data, error } = await supabase
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
            target_latitude: targetLatitudeNum,
            target_longitude: targetLongitudeNum,
            created_at: Date.now(),
            updated_at: Date.now()
          }])
          .select('id')
          .single();
          
        if (error) throw error;
        
        // Notify assigned employee if present
        if (formData.employeeId) {
          await supabase.from('notifications').insert([{
            user_id: formData.employeeId,
            title: language === 'ar' ? 'مهمة جديدة مسندة إليك' : 'New Task Assigned to You',
            body: formData.title,
            link: '/employee',
            company_id: profile?.company_id,
            created_at: Date.now()
          }]);
        }

        logActivity('task_created', 'task', data?.id, { title: formData.title });
        toast.success(language === 'ar' ? 'تمت إضافة المهمة بنجاح' : 'Task created successfully');
      }
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onClose();
    } catch (error: any) {
      console.error('[TaskModal] Error:', error);
      const isPermissionError = error?.code === '42501' || error?.message?.includes('policy');
      toast.error(isPermissionError
        ? (language === 'ar' ? 'ليس لديك صلاحية لهذا الإجراء' : 'Permission denied')
        : (language === 'ar' ? 'حدث خطأ غير متوقع، يرجى المحاولة مجدداً' : 'An error occurred, please try again')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity" aria-hidden="true" onClick={onClose}></div>
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
        <div className={`relative z-10 inline-block align-bottom bg-white rounded-2xl ${language === 'ar' ? 'text-right' : 'text-left'} overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-slate-100`}>
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <h3 className="text-xl font-bold text-slate-900 mb-6" id="modal-title">
                {task 
                  ? (language === 'ar' ? 'تعديل المهمة' : 'Edit Task') 
                  : (language === 'ar' ? 'إنشاء مهمة جديدة' : 'Create New Task')}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    {language === 'ar' ? 'عنوان المهمة' : 'Task Title'}
                  </label>
                  <input 
                    required
                    type="text" 
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    className="w-full border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-3 border outline-none transition" 
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    {language === 'ar' ? 'وصف المهمة (اختياري)' : 'Task Description (Optional)'}
                  </label>
                  <textarea 
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="w-full border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-3 border outline-none transition" 
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      {language === 'ar' ? 'تاريخ التنفيذ' : 'Due Date'}
                    </label>
                    <input 
                      type="date" 
                      value={formData.dueDate}
                      onChange={e => setFormData({...formData, dueDate: e.target.value})}
                      className="w-full border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-3 border outline-none transition" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      {language === 'ar' ? 'اسم العميل أو المكان' : 'Client / Location'}
                    </label>
                    <input 
                      type="text" 
                      value={formData.location}
                      onChange={e => setFormData({...formData, location: e.target.value})}
                      className="w-full border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-3 border outline-none transition" 
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-sm font-semibold text-slate-700">
                      {language === 'ar' ? 'إحداثيات السياج الجغرافي (اختياري)' : 'Geofence Coordinates (Optional)'}
                    </label>
                    <button
                      type="button"
                      onClick={handleAutoLocate}
                      disabled={isLocating}
                      className="text-[10px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      📍 {isLocating ? (language === 'ar' ? 'جاري التحديد...' : 'Locating...') : (language === 'ar' ? 'تحديد موقعي الحالي' : 'Use Current Location')}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <input 
                        type="number" 
                        step="any"
                        placeholder={language === 'ar' ? 'خط العرض (Latitude)' : 'Latitude'}
                        value={formData.targetLatitude}
                        onChange={e => setFormData({...formData, targetLatitude: e.target.value})}
                        className="w-full border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-3 border outline-none transition" 
                      />
                    </div>
                    <div>
                      <input 
                        type="number" 
                        step="any"
                        placeholder={language === 'ar' ? 'خط الطول (Longitude)' : 'Longitude'}
                        value={formData.targetLongitude}
                        onChange={e => setFormData({...formData, targetLongitude: e.target.value})}
                        className="w-full border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-3 border outline-none transition" 
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 mb-0">
                    {language === 'ar' 
                      ? 'يسمح بتحديد نطاق وصول الموظف لمسافة 100 متر حول الموقع قبل تمكينه من تسجيل الدخول.' 
                      : 'Enables verification of employee arrival within 100m before they check-in.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      {language === 'ar' ? 'الموظف المسؤول' : 'Assigned Employee'}
                    </label>
                    <select
                      required
                      value={formData.employeeId}
                      onChange={e => setFormData({...formData, employeeId: e.target.value})}
                      className="w-full border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-3 border outline-none transition bg-white"
                    >
                      <option value="">{language === 'ar' ? '-- اختر موظف --' : '-- Choose Employee --'}</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  {task && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        {language === 'ar' ? 'حالة المهمة' : 'Task Status'}
                      </label>
                      <select
                        required
                        value={formData.status}
                        onChange={e => setFormData({...formData, status: e.target.value as TaskStatus})}
                        className="w-full border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-3 border outline-none transition bg-white"
                      >
                        <option value="new">{language === 'ar' ? 'جديدة' : 'New'}</option>
                        <option value="in_progress">{language === 'ar' ? 'جاري العمل' : 'In Progress'}</option>
                        <option value="completed">{language === 'ar' ? 'مكتملة' : 'Completed'}</option>
                        <option value="pending">{language === 'ar' ? 'معلقة' : 'Pending'}</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className={`bg-slate-50 px-4 py-4 sm:px-6 sm:flex ${language === 'ar' ? 'sm:flex-row-reverse' : 'sm:flex-row'} border-t border-slate-100 gap-3`}>
              <button disabled={isSubmitting} type="submit" className="w-full inline-flex justify-center rounded-xl border border-transparent px-6 py-2.5 bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none sm:w-auto disabled:opacity-50 border-none cursor-pointer">
                {isSubmitting 
                  ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') 
                  : (language === 'ar' ? 'حفظ المهمة' : 'Save Task')}
              </button>
              <button disabled={isSubmitting} type="button" onClick={onClose} className="mt-3 sm:mt-0 w-full inline-flex justify-center rounded-xl border border-slate-300 shadow-sm px-6 py-2.5 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none sm:w-auto disabled:opacity-50 cursor-pointer">
                {t.common.cancel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
