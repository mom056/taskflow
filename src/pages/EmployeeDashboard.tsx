import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Task, statusLabels, statusColors, TaskStatus } from '../types';
import { LogOut, MapPin, CheckCircle, RefreshCcw, Hand, Camera, X, ImageIcon, ClipboardList, CheckSquare, PlusCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTasks } from '../hooks/useTasks';
import { useImageUpload } from '../hooks/useImageUpload';
import { useQueryClient } from '@tanstack/react-query';

export default function EmployeeDashboard() {
  const { signOut, user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { tasks, isLoading, isError } = useTasks(user?.id);
  const { uploadImage, isUploading, progress } = useImageUpload();

  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

  // Create task modal
  const [isTaskFormOpen, setTaskFormOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', location: '', dueDate: '' });

  // Notes & image modal
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskNotes, setTaskNotes] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const sub = supabase
      .channel('emp_tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `employee_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['tasks', user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [user, queryClient]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsCreating(true);
    try {
      const due = newTask.dueDate ? new Date(`${newTask.dueDate}T12:00:00`).getTime() : null;
      const { error } = await supabase.from('tasks').insert([{
        title: newTask.title,
        description: newTask.description || null,
        location: newTask.location || null,
        status: 'new',
        employee_id: user.id,
        created_by: user.id,
        due_date: due,
        created_at: Date.now(),
        updated_at: Date.now(),
      }]);
      if (error) throw error;
      setNewTask({ title: '', description: '', location: '', dueDate: '' });
      setTaskFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ['tasks', user.id] });
      toast.success('تمت إضافة المهمة بنجاح');
    } catch (err: any) {
      console.error('[CreateTask]', err?.message);
      toast.error('تعذر إنشاء المهمة — تأكد من تطبيق سياسات قاعدة البيانات');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateStatus = async (taskId: string, newStatus: TaskStatus) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({ status: newStatus, updated_at: Date.now() })
        .eq('id', taskId)
        .select();
      if (error) throw error;
      if (!data?.length) {
        toast.error('لا تملك صلاحية تحديث هذه المهمة');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['tasks', user.id] });
      toast.success('تم تحديث حالة المهمة');
    } catch (err: any) {
      console.error('[Task Update]', err);
      toast.error(`خطأ: ${err.message || 'تعذر تحديث الحالة'}`);
    }
  };

  const handleSaveNotes = async () => {
    if (!user || !selectedTask) return;
    try {
      let imageUrl = selectedTask.imageUrl || null;
      if (imageFile) {
        const result = await uploadImage(imageFile, selectedTask.id);
        if (result.error) { toast.error(`فشل رفع الصورة: ${result.error}`); return; }
        imageUrl = result.url;
      }
      const { error } = await supabase.from('tasks')
        .update({ notes: taskNotes, image_url: imageUrl, updated_at: Date.now() })
        .eq('id', selectedTask.id);
      if (error) throw error;
      setSelectedTask(null); setTaskNotes(''); setImageFile(null); setImagePreview(null);
      queryClient.invalidateQueries({ queryKey: ['tasks', user.id] });
      toast.success('تم حفظ الملاحظات');
    } catch {
      toast.error('حدث خطأ أثناء الحفظ');
    }
  };

  const openNotesModal = (task: Task) => {
    setSelectedTask(task); setTaskNotes(task.notes || '');
    setImageFile(null); setImagePreview(task.imageUrl || null);
  };

  const activeTasks = tasks.filter(t => t.status !== 'completed');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const displayTasks = activeTab === 'active' ? activeTasks : completedTasks;

  const avatar = (profile?.name || user?.email || 'م')[0].toUpperCase();

  return (
    <div className="flex h-screen w-screen bg-slate-50 font-sans overflow-hidden text-slate-900" dir="rtl">

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="w-[240px] bg-white border-l border-slate-200 flex-col p-6 shrink-0 z-10 hidden md:flex">
        <div className="text-2xl font-bold text-blue-600 mb-10">TaskFlow</div>
        <nav className="flex flex-col flex-1 gap-1">
          {([
            { id: 'active', icon: ClipboardList, label: 'مهامي النشطة' },
            { id: 'completed', icon: CheckSquare, label: 'المنجزة' },
          ] as const).map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium border-none transition-all ${activeTab === item.id ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50 bg-transparent'}`}>
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="mt-auto pt-4 border-t border-slate-200 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-linear-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white text-sm font-bold">{avatar}</div>
            <div className="overflow-hidden">
              <div className="text-sm font-semibold truncate">{profile?.name || user?.email?.split('@')[0]}</div>
              <div className="text-xs text-slate-400">موظف ميداني</div>
            </div>
          </div>
          <button onClick={signOut} className="flex items-center text-slate-500 hover:text-red-500 px-2 py-2 transition-colors w-full rounded-lg hover:bg-red-50">
            <LogOut className="w-4 h-4 ml-2" /><span className="text-sm font-medium">تسجيل خروج</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Mobile header */}
        <header className="md:hidden bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-linear-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white text-xs font-bold">{avatar}</div>
            <div>
              <div className="text-sm font-bold">{activeTab === 'active' ? 'مهامي النشطة' : 'المنجزة'}</div>
              <div className="text-[10px] text-slate-400">{profile?.name || user?.email?.split('@')[0]}</div>
            </div>
          </div>
          <button onClick={signOut} className="p-2 hover:bg-slate-100 rounded-full"><LogOut className="w-4 h-4 text-slate-500" /></button>
        </header>

        {/* Desktop header */}
        <header className="hidden md:flex bg-white border-b border-slate-100 px-8 py-4 items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl font-bold text-slate-900 m-0">{activeTab === 'active' ? 'مهامي النشطة' : 'المهام المنجزة'}</h1>
            <p className="text-slate-400 text-sm mt-0.5 m-0">تسجيل المهام الميدانية وتحديث حالتها</p>
          </div>
          <button onClick={() => setTaskFormOpen(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors shadow-sm">
            <PlusCircle className="w-4 h-4" />مهمة / زيارة جديدة
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          {isLoading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-20 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin" />
            </div>
          )}

          {isError && (
            <div className="m-4 bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center gap-3">
              <span className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 font-bold shrink-0">!</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800">تعذر جلب المهام</p>
                <p className="text-xs text-amber-600 mt-0.5">تأكد من الاتصال بالإنترنت</p>
              </div>
              <button onClick={() => window.location.reload()} className="text-xs font-semibold text-amber-700 border-none bg-transparent cursor-pointer">تحديث</button>
            </div>
          )}

          <div className="p-4 md:p-8 max-w-5xl mx-auto pb-24 md:pb-8 space-y-4">

            {/* Mobile add button */}
            <div className="flex md:hidden justify-end">
              <button onClick={() => setTaskFormOpen(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors shadow-sm">
                <PlusCircle className="w-4 h-4" />مهمة جديدة
              </button>
            </div>

            {displayTasks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayTasks.map(task => (
                  <div key={task.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                    <div className="p-5 flex-1">
                      <div className="flex justify-between items-start mb-2 gap-2">
                        <h3 className="font-bold text-slate-900 text-base leading-snug">{task.title}</h3>
                        <span className={`shrink-0 px-2 py-0.5 text-xs font-bold rounded-full ${statusColors[task.status]}`}>
                          {statusLabels[task.status]}
                        </span>
                      </div>
                      {task.description && <p className="text-slate-500 text-sm mb-3 leading-relaxed">{task.description}</p>}
                      <div className="space-y-2">
                        {task.location && (
                          <div className="flex items-center text-xs text-slate-400">
                            <MapPin className="w-3.5 h-3.5 ml-1.5 shrink-0 text-blue-400" />
                            <span className="truncate">{task.location}</span>
                          </div>
                        )}
                        {task.notes && (
                          <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-600 border border-slate-100">
                            <span className="font-semibold block mb-1">ملاحظاتي:</span>{task.notes}
                          </div>
                        )}
                        {task.imageUrl && (
                          <a href={task.imageUrl} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-slate-100 mt-2">
                            <img src={task.imageUrl} alt="مرفق" className="w-full h-32 object-cover hover:scale-105 transition-transform duration-300" />
                          </a>
                        )}
                      </div>
                    </div>

                    {activeTab === 'active' && (
                      <div className="p-4 bg-slate-50/50 border-t border-slate-100 space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">تغيير الحالة</p>
                        <div className="flex gap-2 flex-wrap">
                          {task.status !== 'in_progress' && (
                            <button onClick={() => handleUpdateStatus(task.id, 'in_progress')}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-all">
                              <RefreshCcw className="w-3.5 h-3.5" />بدء العمل
                            </button>
                          )}
                          {task.status !== 'completed' && (
                            <button onClick={() => handleUpdateStatus(task.id, 'completed')}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 transition-all">
                              <CheckCircle className="w-3.5 h-3.5" />اكتمل
                            </button>
                          )}
                          {task.status !== 'pending' && (
                            <button onClick={() => handleUpdateStatus(task.id, 'pending')}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-all">
                              <Hand className="w-3.5 h-3.5" />تعليق
                            </button>
                          )}
                          <button onClick={() => openNotesModal(task)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-all ml-auto">
                            <Camera className="w-3.5 h-3.5" />صورة / ملاحظة
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
                {activeTab === 'active'
                  ? <><ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-400 text-sm">لا توجد مهام نشطة — أضف مهمتك الأولى</p></>
                  : <><CheckSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-400 text-sm">لا توجد مهام منجزة بعد</p></>
                }
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex md:hidden z-30 shadow-[0_-2px_16px_rgba(0,0,0,0.06)]">
        {([
          { id: 'active', icon: ClipboardList, label: 'نشطة' },
          { id: 'completed', icon: CheckSquare, label: 'المنجزة' },
        ] as const).map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id)}
            className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-all ${activeTab === item.id ? 'text-blue-600' : 'text-slate-400'}`}>
            <div className={`p-1.5 rounded-xl transition-all ${activeTab === item.id ? 'bg-blue-50' : ''}`}>
              <item.icon className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-semibold">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* ── CREATE TASK MODAL ── */}
      {isTaskFormOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" dir="rtl">
          <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-base">مهمة ميدانية جديدة</h3>
              <button onClick={() => { setTaskFormOpen(false); setNewTask({ title: '', description: '', location: '', dueDate: '' }); }}
                className="p-1.5 rounded-full hover:bg-slate-100"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleCreateTask}>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">عنوان المهمة *</label>
                  <input required type="text" value={newTask.title}
                    onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 focus:bg-white transition"
                    placeholder="ما هي المهمة التي ستقوم بها؟" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    <MapPin className="w-4 h-4 inline ml-1 text-blue-500" />مكان الزيارة *
                  </label>
                  <input required type="text" value={newTask.location}
                    onChange={e => setNewTask({ ...newTask, location: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 focus:bg-white transition"
                    placeholder="اسم العميل أو الموقع..." />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">ملاحظات (اختياري)</label>
                  <textarea value={newTask.description}
                    onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 focus:bg-white transition resize-none"
                    rows={3} placeholder="تفاصيل إضافية..." />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">تاريخ التنفيذ</label>
                  <input type="date" value={newTask.dueDate}
                    onChange={e => setNewTask({ ...newTask, dueDate: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 focus:bg-white transition" />
                </div>
              </div>
              <div className="p-4 border-t border-slate-50 bg-slate-50/50 flex gap-3">
                <button type="submit" disabled={isCreating}
                  className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition disabled:opacity-50 text-sm">
                  {isCreating ? 'جاري الإنشاء...' : 'إنشاء المهمة'}
                </button>
                <button type="button" onClick={() => { setTaskFormOpen(false); setNewTask({ title: '', description: '', location: '', dueDate: '' }); }}
                  className="px-5 bg-white border border-slate-200 text-slate-600 font-semibold py-3 rounded-xl hover:bg-slate-50 transition text-sm">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── NOTES & IMAGE MODAL ── */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-sm">ملاحظات وصورة المهمة</h3>
              <button onClick={() => { setSelectedTask(null); setTaskNotes(''); setImageFile(null); setImagePreview(null); }}
                className="p-1.5 rounded-full hover:bg-slate-100"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-4 overflow-y-auto space-y-4">
              <textarea className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 min-h-[120px] outline-none transition text-sm"
                placeholder="اكتب ملاحظاتك هنا..." value={taskNotes}
                onChange={e => setTaskNotes(e.target.value)} />
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">صورة من الموقع (اختياري)</label>
                {imagePreview ? (
                  <div className="relative">
                    <img src={imagePreview} alt="Preview" className="w-full max-h-48 object-cover rounded-xl border border-slate-200" />
                    <button onClick={() => { setImageFile(null); setImagePreview(null); }}
                      className="absolute top-2 left-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                    <ImageIcon className="w-8 h-8 text-slate-300 mb-2" />
                    <span className="text-xs font-semibold text-slate-500">اضغط لاختيار صورة</span>
                    <span className="text-[10px] text-slate-400 mt-1">أو التقط صورة من الكاميرا</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setImageFile(file);
                        const reader = new FileReader();
                        reader.onloadend = () => setImagePreview(reader.result as string);
                        reader.readAsDataURL(file);
                      }} />
                  </label>
                )}
                {isUploading && progress > 0 && (
                  <div className="mt-2">
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>جاري رفع الصورة...</span><span>{progress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5">
                      <div className="bg-blue-600 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <button onClick={handleSaveNotes} disabled={isUploading}
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition disabled:opacity-50 text-sm">
                {isUploading ? `جاري الرفع... ${progress}%` : 'حفظ التغييرات'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
