import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Task, TaskStatus, statusLabels, statusColors, User } from '../types';
import { LogOut, FileText, Search, Plus, MapPin, Calendar, User as UserIcon, ChevronLeft, Map, Edit2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import TaskMap from '../components/TaskMap';
import { openExternalUrl } from '../lib/nativeServices';

import { useTasks } from '../hooks/useTasks';
import { useUsers } from '../hooks/useUsers';
import { useVisits } from '../hooks/useVisits';
import { useQueryClient } from '@tanstack/react-query';

import TasksTable from '../components/TasksTable';
import TaskModal from '../components/TaskModal';
import TaskDetailsModal from '../components/TaskDetailsModal';
import MobileBottomNav from '../components/MobileBottomNav';
import KPICard from '../components/KPICard';
import WeeklyPerformanceChart from '../components/charts/WeeklyPerformanceChart';
import EmployeePerformanceChart from '../components/charts/EmployeePerformanceChart';
import TaskStatusDonut from '../components/charts/TaskStatusDonut';
import { useReportExport } from '../hooks/useReportExport';

import { useBackButton } from '../hooks/useBackButton';

export default function ManagerDashboard() {
  const { signOut, user, profile, company } = useAuth();

  const queryClient = useQueryClient();
  const { tasks, isLoading: tasksLoading, isError: tasksErrorObj, error: tasksError } = useTasks();
  const { users: employees, isLoading: employeesLoading, isError: usersErrorObj, error: usersError } = useUsers('employee');
  const { visits, isLoading: visitsLoading, isError: visitsErrorObj, error: visitsError } = useVisits();

  // Map each employee ID to their active task if they are currently working on one (status = in_progress)
  const employeeActiveTasks = useMemo(() => {
    const activeMap: Record<string, Task> = {};
    tasks.forEach(task => {
      if (task.status === 'in_progress' && task.employeeId) {
        activeMap[task.employeeId] = task;
      }
    });
    return activeMap;
  }, [tasks]);

  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'visits' | 'employees' | 'analytics'>('overview');

  const [isTaskModalOpen, setTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const [isTaskDetailsModalOpen, setTaskDetailsModalOpen] = useState(false);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);

  // Employee management states
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
  const [isEmployeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editEmpName, setEditEmpName] = useState('');
  const [editEmpEmail, setEditEmpEmail] = useState('');
  const [editEmpPassword, setEditEmpPassword] = useState('');
  const [editEmpRole, setEditEmpRole] = useState<'manager' | 'employee'>('employee');
  const [updatingEmployee, setUpdatingEmployee] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');
  const [visitsView, setVisitsView] = useState<'list' | 'map'>('list');

  const isLoading = tasksLoading || employeesLoading || visitsLoading;

  const openTaskDetails = (task: Task) => {
    setViewingTask(task);
    setTaskDetailsModalOpen(true);
  };

  // Intercept hardware back button on Android
  useBackButton(() => {
    if (isTaskModalOpen) {
      setTaskModalOpen(false);
      return true;
    }
    if (isTaskDetailsModalOpen) {
      setTaskDetailsModalOpen(false);
      return true;
    }
    if (selectedTask) {
      setSelectedTask(null);
      return true;
    }
    if (activeTab !== 'overview') {
      setActiveTab('overview');
      return true;
    }
    return false; // Exit app
  }, 10, true);

  useEffect(() => {
    const tasksSub = supabase.channel('manager_tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      }).subscribe();

    const visitsSub = supabase.channel('manager_visits')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => {
        queryClient.invalidateQueries({ queryKey: ['visits'] });
      }).subscribe();

    return () => {
      supabase.removeChannel(tasksSub);
      supabase.removeChannel(visitsSub);
    };
  }, [queryClient]);

  const handleDeleteTask = async (task: Task) => {
    toast(
      (t) => (
        <div className="text-sm" dir="rtl">
          <p className="font-semibold mb-2">هل تريد حذف: <span className="text-red-600">{task.title}</span>؟</p>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                toast.dismiss(t.id);
                try {
                  const { error } = await supabase.from('tasks').delete().eq('id', task.id);
                  if (error) throw error;
                  queryClient.invalidateQueries({ queryKey: ['tasks'] });
                  toast.success('تم حذف المهمة بنجاح');
                } catch {
                  toast.error('تعذر حذف المهمة، يرجى المحاولة مجدداً');
                }
              }}
              className="bg-red-500 text-white px-3 py-1 rounded-lg text-xs font-semibold hover:bg-red-600"
            >
              حذف
            </button>
            <button
              onClick={() => toast.dismiss(t.id)}
              className="bg-slate-100 text-slate-700 px-3 py-1 rounded-lg text-xs font-semibold hover:bg-slate-200"
            >
              إلغاء
            </button>
          </div>
        </div>
      ),
      { duration: 6000 }
    );
  };

  const openEditEmployee = (emp: User) => {
    setSelectedEmployee(emp);
    setEditEmpName(emp.name);
    setEditEmpEmail(emp.email);
    setEditEmpRole(emp.role === 'super_admin' ? 'manager' : emp.role);
    setEditEmpPassword(''); // Reset password field
    setEmployeeModalOpen(true);
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEmpName.trim() || !editEmpEmail.trim()) {
      return toast.error('يرجى ملء الاسم والبريد الإلكتروني');
    }
    if (editEmpPassword && editEmpPassword.length < 6) {
      return toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    }

    setUpdatingEmployee(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          action: 'update',
          userId: selectedEmployee.id,
          name: editEmpName,
          email: editEmpEmail,
          role: editEmpRole,
          password: editEmpPassword ? editEmpPassword : undefined
        }
      });

      if (error) throw new Error(error.message || 'فشل تحديث بيانات الموظف');
      if (data?.error) throw new Error(data.error);

      toast.success('تم تحديث بيانات الموظف بنجاح');
      setEmployeeModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err: any) {
      toast.error(err.message || 'فشل تحديث بيانات الموظف');
    } finally {
      setUpdatingEmployee(false);
    }
  };

  const openDeleteEmployee = (emp: User) => {
    setSelectedEmployee(emp);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteEmployee = async () => {
    if (!selectedEmployee) return;
    setUpdatingEmployee(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          action: 'delete',
          userId: selectedEmployee.id
        }
      });

      if (error) throw new Error(error.message || 'فشل حذف الموظف');
      if (data?.error) throw new Error(data.error);

      toast.success('تم حذف الموظف بنجاح');
      setDeleteConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err: any) {
      toast.error(err.message || 'فشل حذف الموظف');
    } finally {
      setUpdatingEmployee(false);
    }
  };

  const getEmployeeName = (id: string) => employees.find(e => e.id === id)?.name || 'غير معروف';

  const completionRate = useMemo(() => {
    if (tasks.length === 0) return 0;
    const completed = tasks.filter(t => t.status === 'completed').length;
    return Math.round((completed / tasks.length) * 100);
  }, [tasks]);

  const topEmployee = useMemo(() => {
    if (tasks.length === 0 || employees.length === 0) return 'لا يوجد';
    const completedCounts: Record<string, number> = {};
    tasks.filter(t => t.status === 'completed').forEach(t => {
      completedCounts[t.employeeId] = (completedCounts[t.employeeId] || 0) + 1;
    });
    let topEmpId = '';
    let maxCompleted = -1;
    Object.entries(completedCounts).forEach(([empId, count]) => {
      if (count > maxCompleted) {
        maxCompleted = count;
        topEmpId = empId;
      }
    });
    if (!topEmpId) return 'لا يوجد';
    return employees.find(e => e.id === topEmpId)?.name || 'غير معروف';
  }, [tasks, employees]);

  const { exportPDF, printReportHTML } = useReportExport({ tasks, getEmployeeName });

  const stats = {
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    pending: tasks.filter(t => t.status === 'pending').length,
    withLocation: tasks.filter(t => t.location).length,
  };

  const filteredTasks = tasks.filter(task => {
    const employeeName = getEmployeeName(task.employeeId);
    const matchesSearch = !searchQuery ||
      task.title.includes(searchQuery) ||
      (task.description && task.description.includes(searchQuery)) ||
      (task.location && task.location.includes(searchQuery)) ||
      employeeName.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesEmployee = employeeFilter === 'all' || task.employeeId === employeeFilter;
    return matchesSearch && matchesStatus && matchesEmployee;
  });

  const exportToExcel = () => {
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF"
      + "العنوان,الوصف,الموظف,المكان,تاريخ التنفيذ,الحالة,تاريخ الإنشاء\n"
      + filteredTasks.map(t =>
        `"${t.title}","${t.description || ''}","${getEmployeeName(t.employeeId)}","${t.location || ''}","${t.dueDate ? format(t.dueDate, 'yyyy/MM/dd') : ''}","${statusLabels[t.status]}","${format(t.createdAt, 'yyyy/MM/dd')}"`
      ).join("\n");

    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `تقرير_المهام_${format(Date.now(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openAddTask = () => { setSelectedTask(null); setTaskModalOpen(true); };
  const openEditTask = (task: Task) => { setSelectedTask(task); setTaskModalOpen(true); };

  // ─────────────────────────────────────────────────────────────────────────────
  // Mobile task card component (inline)
  // ─────────────────────────────────────────────────────────────────────────────
  const MobileTaskCard = ({ task }: { task: Task }) => (
    <div 
      onClick={() => openTaskDetails(task)}
      className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3 active:scale-[0.99] transition-transform cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-slate-900 text-sm leading-snug flex-1">{task.title}</h3>
        <span className={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full ${statusColors[task.status]}`}>
          {statusLabels[task.status]}
        </span>
      </div>

      {task.description && (
        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <UserIcon className="w-3.5 h-3.5" />
          <span>{getEmployeeName(task.employeeId)}</span>
        </div>
        {task.location && (
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="w-3.5 h-3.5" />
            <span className="truncate max-w-[120px]">{task.location}</span>
          </div>
        )}
        {task.dueDate && (
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Calendar className="w-3.5 h-3.5" />
            <span>{format(task.dueDate, 'yyyy/MM/dd')}</span>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-1 border-t border-slate-50" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => openEditTask(task)}
          className="flex-1 py-2 rounded-xl text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
        >
          تعديل
        </button>
        <button
          onClick={() => handleDeleteTask(task)}
          className="flex-1 py-2 rounded-xl text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
        >
          حذف
        </button>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Tab content sections
  // ─────────────────────────────────────────────────────────────────────────────
  const tabTitle: Record<typeof activeTab, string> = {
    overview: 'نظرة عامة',
    tasks: 'إدارة المهام',
    visits: 'سجل الزيارات',
    employees: 'فريق العمل',
    analytics: 'التحليلات والتقارير'
  };

  return (
    <div className="flex h-screen w-screen bg-slate-50 font-sans overflow-hidden text-slate-900" dir="rtl">

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="w-[240px] bg-white border-l border-slate-200 flex-col p-6 shrink-0 z-10 hidden md:flex">
        <div className="mb-10">
          <div className="text-2xl font-bold text-blue-600">TaskFlow</div>
          {company && (
            <div className="text-xs font-semibold text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
              <span>{company.name}</span>
              <span className="bg-blue-100 text-blue-800 text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase">{company.plan}</span>
            </div>
          )}
        </div>

        <nav className="flex flex-col flex-1 gap-1">
          {(['overview', 'tasks', 'visits', 'employees', 'analytics'] as const).map(tab => {
            const labels = { 
              overview: 'لوحة التحكم', 
              tasks: 'المهام اليومية', 
              visits: 'سجل الزيارات', 
              employees: 'الموظفين',
              analytics: 'التحليلات والتقارير'
            };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex justify-start items-center px-4 py-3 rounded-xl font-medium border-none transition-all duration-200 ${
                  activeTab === tab
                    ? 'bg-blue-50 text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:bg-slate-50 bg-transparent hover:text-slate-800'
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto pt-4 border-t border-slate-200 space-y-3">
          <Link to="/profile" className="flex items-center gap-3 hover:bg-slate-50 p-2 rounded-xl transition-colors cursor-pointer text-slate-800 decoration-none no-underline">
            <div className="w-9 h-9 bg-linear-to-br from-blue-500 to-blue-700 rounded-full shrink-0 flex items-center justify-center text-white text-sm font-bold overflow-hidden border border-blue-100">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="المدير" className="w-full h-full object-cover" />
              ) : (
                (profile?.name || user?.email || 'م')[0].toUpperCase()
              )}
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-semibold truncate leading-tight">{profile?.name || user?.email?.split('@')[0] || 'المدير'}</div>
              <div className="text-xs text-slate-400 mt-0.5">مدير النظام</div>
            </div>
          </Link>
          <button
            onClick={signOut}
            className="flex items-center text-slate-500 hover:text-red-500 px-2 py-2 transition-colors w-full rounded-lg hover:bg-red-50"
          >
            <LogOut className="w-4 h-4 ml-2" />
            <span className="text-sm font-medium">تسجيل خروج</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* ── MOBILE HEADER ── */}
        <header className="md:hidden bg-white border-b border-slate-100 px-4 pb-3 safe-pt flex items-center justify-between sticky top-0 z-20 shadow-sm">
          <Link to="/profile" className="flex items-center gap-3 text-slate-800 decoration-none no-underline">
            <div className="w-8 h-8 bg-linear-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden border border-blue-100">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="المدير" className="w-full h-full object-cover" />
              ) : (
                (profile?.name || user?.email || 'م')[0].toUpperCase()
              )}
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">{tabTitle[activeTab]}</div>
              <div className="text-[10px] text-slate-400">
                {profile?.name || user?.email?.split('@')[0]} {company ? `| ${company.name}` : ''}
              </div>
            </div>
          </Link>
          <button onClick={signOut} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <LogOut className="w-4 h-4 text-slate-500" />
          </button>
        </header>

        {/* ── DESKTOP HEADER ── */}
        <header className="hidden md:flex bg-white border-b border-slate-100 px-8 py-4 items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl font-bold text-slate-900 m-0">{tabTitle[activeTab]}</h1>
            <p className="text-slate-400 text-sm mt-0.5 m-0">متابعة سير العمل والمهام لـ {company?.name || 'المؤسسة'}</p>
          </div>
          <div className="flex items-center gap-3">
            {(activeTab === 'overview' || activeTab === 'tasks') && (
              <>
                <button onClick={exportToExcel} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-sm font-semibold flex items-center gap-2 transition-colors">
                  <FileText className="w-4 h-4" />
                  تصدير CSV
                </button>
                <button onClick={openAddTask} className="bg-blue-600 text-white border-none py-2 px-5 rounded-xl font-semibold cursor-pointer hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm shadow-blue-200">
                  <Plus className="w-4 h-4" />
                  مهمة جديدة
                </button>
              </>
            )}
            {activeTab === 'analytics' && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={printReportHTML} 
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                >
                  طباعة التقرير 🖨️
                </button>
                <button 
                  onClick={exportPDF} 
                  className="bg-blue-600 text-white border-none py-2.5 px-5 rounded-xl font-semibold cursor-pointer hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm shadow-blue-200"
                >
                  تحميل PDF 📄
                </button>
              </div>
            )}
          </div>
        </header>

        {/* ── SCROLLABLE CONTENT AREA ── */}
        <div className="flex-1 overflow-y-auto relative">
          {isLoading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-20 flex items-center justify-center">
              <div className="rounded-full h-8 w-8 bg-blue-600 animate-ping" />
            </div>
          )}

          {(tasksErrorObj || usersErrorObj || visitsErrorObj) && (
            <div className="m-4 bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                <span className="text-amber-600 font-bold text-sm">!</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800">تعذر جلب بعض البيانات</p>
                <p className="text-xs text-amber-600 mt-0.5">يرجى التأكد من إعداد جداول قاعدة البيانات بشكل صحيح</p>
              </div>
              <button onClick={() => window.location.reload()} className="text-xs font-semibold text-amber-700 hover:text-amber-900 border-none bg-transparent cursor-pointer">
                تحديث
              </button>
            </div>
          )}

          {/* ══ OVERVIEW ══ */}
          {activeTab === 'overview' && (
            <div className="p-4 md:p-8 space-y-6 pb-24 md:pb-8">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
                {[
                  { label: 'إجمالي المهام', value: stats.total, color: 'text-slate-800', bg: 'bg-white' },
                  { label: 'جاري العمل', value: stats.inProgress, color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: 'المهام المكتملة', value: stats.completed, color: 'text-green-600', bg: 'bg-green-50' },
                  { label: 'زيارات ميدانية', value: stats.withLocation, color: 'text-blue-600', bg: 'bg-blue-50' },
                ].map(s => (
                  <div key={s.label} className={`${s.bg} p-4 md:p-6 rounded-2xl border border-slate-100 shadow-sm`}>
                    <p className="text-xs md:text-sm text-slate-500 font-medium">{s.label}</p>
                    <p className={`text-3xl md:text-4xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Recent Tasks — desktop: table, mobile: cards */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-50 flex justify-between items-center">
                  <h2 className="text-base font-bold text-slate-800">آخر المهام</h2>
                  <button onClick={() => setActiveTab('tasks')} className="text-blue-600 text-xs font-semibold hover:underline bg-transparent border-none cursor-pointer flex items-center gap-1">
                    عرض الكل <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Desktop table */}
                <div className="hidden md:block">
                  <TasksTable tasks={tasks.slice(0, 5)} employees={employees} onEdit={openEditTask} onDelete={handleDeleteTask} onView={openTaskDetails} />
                </div>

                {/* Mobile cards */}
                <div className="md:hidden p-4 space-y-3">
                  {tasks.slice(0, 5).map(task => <MobileTaskCard key={task.id} task={task} />)}
                  {tasks.length === 0 && <p className="text-center text-slate-400 text-sm py-6">لا توجد مهام مسجلة حالياً</p>}
                </div>
              </div>
            </div>
          )}

          {/* ══ TASKS ══ */}
          {activeTab === 'tasks' && (
            <div className="p-4 md:p-8 space-y-4 pb-24 md:pb-8">
              {/* Filter bar */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="ابحث عن مهمة أو موظف..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-3 pr-10 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 focus:bg-white transition-colors"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                </div>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as TaskStatus | 'all')}
                  className="border border-slate-200 rounded-xl text-sm px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                >
                  <option value="all">كل الحالات</option>
                  <option value="new">جديدة</option>
                  <option value="in_progress">جاري العمل</option>
                  <option value="completed">مكتملة</option>
                  <option value="pending">معلقة</option>
                </select>
                <select
                  value={employeeFilter}
                  onChange={e => setEmployeeFilter(e.target.value)}
                  className="border border-slate-200 rounded-xl text-sm px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                >
                  <option value="all">كل الموظفين</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
              </div>

              {/* Desktop table */}
              <div className="hidden md:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <TasksTable tasks={filteredTasks} employees={employees} onEdit={openEditTask} onDelete={handleDeleteTask} onView={openTaskDetails} />
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {filteredTasks.map(task => <MobileTaskCard key={task.id} task={task} />)}
                {filteredTasks.length === 0 && (
                  <div className="text-center py-12 text-slate-400 text-sm bg-white rounded-2xl border border-slate-100">
                    لا توجد مهام مطابقة
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ EMPLOYEES ══ */}
          {activeTab === 'employees' && (
            <div className="p-4 md:p-8 pb-24 md:pb-8">
              {/* Desktop table */}
              <div className="hidden md:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-50">
                  <h2 className="text-base font-bold text-slate-800">قائمة الموظفين</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="text-right p-4 border-b border-slate-100 text-slate-400 text-sm font-medium">الاسم</th>
                        <th className="text-right p-4 border-b border-slate-100 text-slate-400 text-sm font-medium">البريد الإلكتروني</th>
                        <th className="text-right p-4 border-b border-slate-100 text-slate-400 text-sm font-medium">الدور الوظيفي</th>
                        <th className="text-right p-4 border-b border-slate-100 text-slate-400 text-sm font-medium">الحالة الحالية</th>
                        <th className="text-right p-4 border-b border-slate-100 text-slate-400 text-sm font-medium">تاريخ الانضمام</th>
                        <th className="text-center p-4 border-b border-slate-100 text-slate-400 text-sm font-medium w-32">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map(emp => {
                        const activeTask = employeeActiveTasks[emp.id];
                        const isSelf = emp.id === user?.id;
                        return (
                          <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 border-b border-slate-50 text-sm font-semibold text-slate-900">{emp.name}</td>
                            <td className="p-4 border-b border-slate-50 text-sm text-slate-500">{emp.email}</td>
                            <td className="p-4 border-b border-slate-50 text-sm">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                                emp.role === 'manager' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-slate-50 text-slate-700 border border-slate-100'
                              }`}>
                                {emp.role === 'manager' ? 'مدير' : 'موظف'}
                              </span>
                            </td>
                            <td className="p-4 border-b border-slate-50 text-sm">
                              {activeTask ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                  </span>
                                  في مهمة: <span className="font-bold truncate max-w-[120px]">{activeTask.title}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                  <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                                  متاح
                                </span>
                              )}
                            </td>
                            <td className="p-4 border-b border-slate-50 text-sm text-slate-500">{format(emp.createdAt, 'yyyy/MM/dd')}</td>
                            <td className="p-4 border-b border-slate-50 text-center">
                              <div className="flex justify-center gap-2">
                                <button
                                  onClick={() => openEditEmployee(emp)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 border-none bg-transparent rounded-lg transition-colors cursor-pointer"
                                  title="تعديل بيانات الموظف"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                {!isSelf && (
                                  <button
                                    onClick={() => openDeleteEmployee(emp)}
                                    className="p-1.5 text-rose-600 hover:bg-rose-50 border-none bg-transparent rounded-lg transition-colors cursor-pointer"
                                    title="حذف الموظف نهائياً"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {employees.length === 0 && (
                        <tr><td colSpan={6} className="p-6 text-center text-slate-400">لا يوجد موظفون مسجلون</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {employees.map(emp => {
                  const activeTask = employeeActiveTasks[emp.id];
                  const isSelf = emp.id === user?.id;
                  return (
                    <div key={emp.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-linear-to-br from-slate-400 to-slate-600 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                          {emp.name?.[0]?.toUpperCase() || '؟'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-900 text-sm">{emp.name}</div>
                          <div className="text-xs text-slate-400 mt-0.5 truncate">{emp.email}</div>
                        </div>
                        <div className="text-[10px] text-slate-400 shrink-0">{format(emp.createdAt, 'yyyy/MM/dd')}</div>
                      </div>

                      <div className="pt-2 border-t border-slate-50 flex items-center justify-between">
                        <span className="text-xs text-slate-400">الدور الوظيفي</span>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          emp.role === 'manager' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-slate-50 text-slate-700 border border-slate-100'
                        }`}>
                          {emp.role === 'manager' ? 'مدير' : 'موظف'}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-50 flex items-center justify-between">
                        <span className="text-xs text-slate-400">الحالة الميدانية</span>
                        {activeTask ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                            </span>
                            في مهمة: <span className="font-bold truncate max-w-[120px]">{activeTask.title}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                            متاح
                          </span>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-50 flex justify-end gap-3">
                        <button
                          onClick={() => openEditEmployee(emp)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs text-blue-600 bg-blue-50/50 hover:bg-blue-50 border border-blue-100 rounded-xl transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          تعديل
                        </button>
                        {!isSelf && (
                          <button
                            onClick={() => openDeleteEmployee(emp)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs text-rose-600 bg-rose-50/50 hover:bg-rose-50 border border-rose-100 rounded-xl transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            حذف
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {employees.length === 0 && (
                  <div className="text-center py-12 text-slate-400 text-sm bg-white rounded-2xl border border-slate-100">
                    لا يوجد موظفون مسجلون
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ VISITS (field tasks with location) ══ */}
          {activeTab === 'visits' && (
            <div className="p-4 md:p-8 pb-24 md:pb-8">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between flex-wrap gap-3">
                  <h2 className="text-base font-bold text-slate-800">سجل الزيارات الميدانية</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setVisitsView('list')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border-none cursor-pointer transition-all ${
                        visitsView === 'list'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      قائمة الزيارات
                    </button>
                    <button
                      onClick={() => setVisitsView('map')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border-none cursor-pointer transition-all flex items-center gap-1.5 ${
                        visitsView === 'map'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Map className="w-3.5 h-3.5" />
                      الخريطة التفاعلية
                    </button>
                  </div>
                  <span className="text-xs text-slate-400 bg-slate-50 px-3 py-1 rounded-full font-medium">
                    {tasks.filter(t => t.location).length} زيارة
                  </span>
                </div>
                <div className="p-4 space-y-3">
                  {visitsView === 'map' ? (
                    <TaskMap tasks={tasks} getEmployeeName={getEmployeeName} />
                  ) : (
                    tasks.filter(t => t.location).length > 0 ? (
                      tasks.filter(t => t.location).map(task => (
                        <div key={task.id} className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 space-y-2.5">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <h3 className="font-semibold text-slate-900 text-sm">{task.title}</h3>
                              <p className="text-xs text-slate-400 mt-0.5">{getEmployeeName(task.employeeId)}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                              {task.startLatitude && (
                                <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-bold">
                                  بدء موثق
                                </span>
                              )}
                              {task.latitude && (
                                <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-bold">
                                  إتمام موثق
                                </span>
                              )}
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${statusColors[task.status]}`}>
                                {statusLabels[task.status]}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-600">
                            <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span>{task.location}</span>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-0.5">
                            {task.startLatitude && task.startLongitude && (
                              <button
                                onClick={() => openExternalUrl(`https://www.google.com/maps/search/?api=1&query=${task.startLatitude},${task.startLongitude}`)}
                                className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-[11px] font-semibold border-none cursor-pointer flex items-center gap-1 transition-colors"
                              >
                                📌 موقع البدء (GPS)
                              </button>
                            )}
                            {task.latitude && task.longitude && (
                              <button
                                onClick={() => openExternalUrl(`https://www.google.com/maps/search/?api=1&query=${task.latitude},${task.longitude}`)}
                                className="px-2.5 py-1 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-[11px] font-semibold border-none cursor-pointer flex items-center gap-1 transition-colors"
                              >
                                📍 موقع الإتمام (GPS)
                              </button>
                            )}
                          </div>
                          {task.notes && (
                            <p className="text-xs text-slate-500 bg-white rounded-lg px-3 py-2 border border-slate-100">{task.notes}</p>
                          )}
                          {task.imageUrl && (
                            <a href={task.imageUrl}
                              onClick={(e) => {
                                e.preventDefault();
                                openExternalUrl(task.imageUrl!);
                              }}
                              className="block overflow-hidden rounded-lg border border-slate-200 max-w-[200px]">
                              <img src={task.imageUrl} alt="صورة الزيارة" className="w-full h-24 object-cover hover:scale-105 transition-transform" />
                            </a>
                          )}
                          <div className="text-[10px] text-slate-400 pt-1">
                            {task.createdAt ? new Date(task.createdAt).toLocaleDateString('ar-SA') : ''}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-10 text-slate-400 text-sm">لا توجد زيارات ميدانية مسجلة</div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══ ANALYTICS & REPORTS ══ */}
          {activeTab === 'analytics' && (
            <div className="p-4 md:p-8 space-y-6 pb-24 md:pb-8">
              {/* Mobile Print Buttons */}
              <div className="flex md:hidden gap-2">
                <button 
                  onClick={printReportHTML} 
                  className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  طباعة التقرير 🖨️
                </button>
                <button 
                  onClick={exportPDF} 
                  className="flex-1 py-2.5 bg-blue-600 text-white border-none rounded-xl hover:bg-blue-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
                >
                  تحميل PDF 📄
                </button>
              </div>

              {/* KPI Cards Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
                <KPICard 
                  title="معدل إنجاز المهام" 
                  value={`${completionRate}%`} 
                  change={completionRate >= 70 ? "+ جيد جداً" : "- يحتاج تحسين"} 
                  isPositive={completionRate >= 70}
                  icon={<FileText className="w-5 h-5" />} 
                />
                <KPICard 
                  title="متوسط وقت الإنجاز" 
                  value="1.8 يوم" 
                  change="ضمن المهلة" 
                  isPositive={true}
                  icon={<Calendar className="w-5 h-5" />} 
                />
                <KPICard 
                  title="زيارات موثقة GPS" 
                  value={tasks.filter(t => t.latitude).length} 
                  change={`${Math.round((tasks.filter(t => t.latitude).length / (tasks.filter(t => t.location).length || 1)) * 100)}% موثق`} 
                  isPositive={true}
                  icon={<MapPin className="w-5 h-5" />} 
                />
                <KPICard 
                  title="الموظف الأكثر نشاطاً" 
                  value={topEmployee} 
                  change="الأكثر إنجازاً" 
                  isPositive={true}
                  icon={<UserIcon className="w-5 h-5" />} 
                />
              </div>

              {/* Charts Row 1: Weekly + Status Donut */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <WeeklyPerformanceChart tasks={tasks} />
                </div>
                <div className="lg:col-span-1">
                  <TaskStatusDonut tasks={tasks} />
                </div>
              </div>

              {/* Charts Row 2: Employee Performance */}
              <div className="grid grid-cols-1">
                <EmployeePerformanceChart tasks={tasks} employees={employees} />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── MOBILE FAB (Add Task) ── */}
      {(activeTab === 'overview' || activeTab === 'tasks') && (
        <button
          onClick={openAddTask}
          className="md:hidden fixed bottom-20 left-4 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-300/50 flex items-center justify-center z-40 hover:bg-blue-700 active:scale-95 transition-all"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* ── MOBILE BOTTOM NAV ── */}
      <MobileBottomNav activeTab={activeTab} onChange={setActiveTab} />

      {/* ── TASK MODAL ── */}
      {user && (
        <TaskModal
          isOpen={isTaskModalOpen}
          onClose={() => { setTaskModalOpen(false); setSelectedTask(null); }}
          task={selectedTask}
          employees={employees}
          currentUserId={user.id}
        />
      )}

      {/* ── TASK DETAILS MODAL ── */}
      {isTaskDetailsModalOpen && (
        <TaskDetailsModal
          isOpen={isTaskDetailsModalOpen}
          onClose={() => { setTaskDetailsModalOpen(false); setViewingTask(null); }}
          task={viewingTask}
          employees={employees}
          onEditClick={(task) => {
            setTaskDetailsModalOpen(false);
            setViewingTask(null);
            openEditTask(task);
          }}
        />
      )}

      {/* ── EMPLOYEE EDIT MODAL ── */}
      {isEmployeeModalOpen && selectedEmployee && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl w-full max-w-md overflow-hidden animate-scale-up" dir="rtl">
            <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800 m-0">تعديل بيانات الموظف</h2>
              <button
                onClick={() => setEmployeeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 bg-transparent border-none text-base cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdateEmployee} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">الاسم كامل</label>
                <input
                  type="text"
                  value={editEmpName}
                  onChange={(e) => setEditEmpName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">البريد الإلكتروني (حساب الدخول)</label>
                <input
                  type="email"
                  value={editEmpEmail}
                  onChange={(e) => setEditEmpEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                  required
                />
                <p className="text-[10px] text-amber-600 mt-1.5 font-medium leading-relaxed bg-amber-50 px-3 py-2 rounded-xl border border-amber-100/50">
                  ⚠️ تنبيه: تعديل البريد الإلكتروني سيغير اسم المستخدم الذي يسجل به الموظف دخوله فوراً.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">الدور الوظيفي</label>
                <select
                  value={editEmpRole}
                  onChange={(e) => setEditEmpRole(e.target.value as 'manager' | 'employee')}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                >
                  <option value="employee">موظف ميداني</option>
                  <option value="manager">مدير</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">كلمة مرور جديدة (اختياري)</label>
                <input
                  type="password"
                  placeholder="اتركه فارغاً للاحتفاظ بكلمة المرور الحالية"
                  value={editEmpPassword}
                  onChange={(e) => setEditEmpPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-50">
                <button
                  type="submit"
                  disabled={updatingEmployee}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors border-none cursor-pointer flex items-center justify-center"
                >
                  {updatingEmployee ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                </button>
                <button
                  type="button"
                  onClick={() => setEmployeeModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors border-none cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EMPLOYEE DELETE CONFIRM MODAL ── */}
      {isDeleteConfirmOpen && selectedEmployee && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl w-full max-w-sm p-6 space-y-4 text-center animate-scale-up" dir="rtl">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center text-xl mx-auto border border-rose-100">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">حذف الموظف نهائياً</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                هل أنت متأكد من رغبتك في حذف الموظف <span className="font-bold text-slate-800">{selectedEmployee.name}</span>؟<br />
                سيتم إلغاء حساب دخول الموظف فوراً ولن يتمكن من الوصول للتطبيق مجدداً. هذا الإجراء لا يمكن التراجع عنه.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleDeleteEmployee}
                disabled={updatingEmployee}
                className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-semibold hover:bg-rose-700 disabled:opacity-50 transition-colors border-none cursor-pointer flex items-center justify-center"
              >
                {updatingEmployee ? 'جاري الحذف...' : 'نعم، احذف الحساب'}
              </button>
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors border-none cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
