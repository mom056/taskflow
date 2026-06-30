import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Task, TaskStatus, statusLabels, statusColors, User } from '../types';
import { LogOut, FileText, Search, Plus, MapPin, Calendar, User as UserIcon, ChevronLeft, Map, Edit2, Trash2, Clock, UserPlus, Settings, CheckCircle, History } from 'lucide-react';
import { useActivityLog } from '../hooks/useActivityLog';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import TaskMap from '../components/TaskMap';
import { openExternalUrl, triggerHaptic } from '../lib/nativeServices';

import { useTasks } from '../hooks/useTasks';
import { useUsers } from '../hooks/useUsers';
import { useVisits } from '../hooks/useVisits';
import { useQueryClient } from '@tanstack/react-query';
import PullToRefresh from '../components/PullToRefresh';
import NotificationCenter from '../components/NotificationCenter';
import AppLogo from '../components/AppLogo';
import AppLoader from '../components/AppLoader';
import AttendanceTable from '../components/AttendanceTable';
import LeaveRequestsPanel from '../components/LeaveRequestsPanel';

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
import { useTranslation } from '../contexts/LanguageContext';

export default function ManagerDashboard() {
  const { signOut, user, profile, company } = useAuth();
  const { logActivity, activities, isLoading: isActivityLoading } = useActivityLog();
  const { t, language } = useTranslation();

  const queryClient = useQueryClient();
  const { tasks, isLoading: tasksLoading, isError: tasksErrorObj } = useTasks();

  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['tasks'] }),
      queryClient.invalidateQueries({ queryKey: ['users'] }),
      queryClient.invalidateQueries({ queryKey: ['visits'] }),
      queryClient.invalidateQueries({ queryKey: ['activity_log'] })
    ]);
  };
  const { users: employees, isLoading: employeesLoading, isError: usersErrorObj } = useUsers('employee');
  const { visits, isLoading: visitsLoading, isError: visitsErrorObj } = useVisits();

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

  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'visits' | 'employees' | 'analytics' | 'activity' | 'attendance' | 'leaves'>('overview');

  const [isTaskModalOpen, setTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const [isTaskDetailsModalOpen, setTaskDetailsModalOpen] = useState(false);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);

  // Employee management states
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
  const [isEmployeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isLogoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [editEmpName, setEditEmpName] = useState('');
  const [editEmpEmail, setEditEmpEmail] = useState('');
  const [editEmpPassword, setEditEmpPassword] = useState('');
  const [editEmpRole, setEditEmpRole] = useState<'employee' | 'super_admin' | 'manager'>('employee');
  const [updatingEmployee, setUpdatingEmployee] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [visitsView, setVisitsView] = useState<'list' | 'map'>('list');

  const isLoading = tasksLoading || employeesLoading || visitsLoading || isActivityLoading;

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

  // Realtime updates
  useEffect(() => {
    if (!profile?.company_id) return;
    const channelName = `manager_db_${profile.company_id}_${Math.random().toString(36).substring(2, 15)}`;
    const sub = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `company_id=eq.${profile.company_id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `company_id=eq.${profile.company_id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['users'] });
      })
      .subscribe((status, err) => {
        if (err) console.warn('[ManagerDashboard] Realtime error (non-fatal):', err.message);
      });
    return () => { supabase.removeChannel(sub); };
  }, [profile?.company_id, queryClient]);

  // Filters logic
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch = 
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.location || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      const matchesEmployee = employeeFilter === 'all' || task.employeeId === employeeFilter;

      let matchesDate = true;
      if (startDate) {
        const start = new Date(startDate).getTime();
        matchesDate = matchesDate && task.createdAt >= start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && task.createdAt <= end.getTime();
      }

      return matchesSearch && matchesStatus && matchesEmployee && matchesDate;
    });
  }, [tasks, searchQuery, statusFilter, employeeFilter, startDate, endDate]);

  const dateFilteredTasks = useMemo(() => {
    return tasks.filter(task => {
      let matchesDate = true;
      if (startDate) {
        const start = new Date(startDate).getTime();
        matchesDate = matchesDate && task.createdAt >= start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && task.createdAt <= end.getTime();
      }
      return matchesDate;
    });
  }, [tasks, startDate, endDate]);

  // Report statistics
  const stats = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter(t => t.status === 'completed').length;
    const inProgress = filteredTasks.filter(t => t.status === 'in_progress').length;
    const withLocation = filteredTasks.filter(t => t.location).length;

    return { total, completed, inProgress, withLocation };
  }, [filteredTasks]);

  const completionRate = useMemo(() => {
    const total = dateFilteredTasks.length;
    if (total === 0) return 0;
    const completed = dateFilteredTasks.filter(t => t.status === 'completed').length;
    return Math.round((completed / total) * 100);
  }, [dateFilteredTasks]);

  const topEmployee = useMemo(() => {
    if (employees.length === 0) return language === 'ar' ? 'لا يوجد' : 'None';
    const counts: Record<string, number> = {};
    dateFilteredTasks.forEach(t => {
      if (t.status === 'completed' && t.employeeId) {
        counts[t.employeeId] = (counts[t.employeeId] || 0) + 1;
      }
    });
    let max = -1;
    let topId = '';
    Object.entries(counts).forEach(([id, count]) => {
      if (count > max) {
        max = count;
        topId = id;
      }
    });
    const found = employees.find(e => e.id === topId);
    return found ? found.name : (language === 'ar' ? 'لا يوجد' : 'None');
  }, [dateFilteredTasks, employees, language]);

  const getEmployeeName = (id: string | null) => {
    if (!id) return language === 'ar' ? 'غير مسندة' : 'Unassigned';
    const found = employees.find(e => e.id === id);
    return found ? found.name : (language === 'ar' ? 'موظف محذوف' : 'Deleted employee');
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

  const openAddTask = () => { setSelectedTask(null); setTaskModalOpen(true); };
  const openEditTask = (task: Task) => { setSelectedTask(task); setTaskModalOpen(true); };

  const handleDeleteTask = async (task: Task) => {
    const confirmed = window.confirm(language === 'ar' ? `هل أنت متأكد من حذف المهمة "${task.title}"؟` : `Are you sure you want to delete "${task.title}"?`);
    if (!confirmed) return;
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', task.id);
      if (error) throw error;
      logActivity('task_deleted', 'task', task.id, { title: task.title });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      triggerHaptic('success');
      toast.success(language === 'ar' ? 'تم حذف المهمة بنجاح' : 'Task deleted successfully');
    } catch (err: any) {
      triggerHaptic('error');
      toast.error(err.message || (language === 'ar' ? 'تعذر حذف المهمة' : 'Could not delete task'));
    }
  };

  // Employee Edit / Update / Delete handlers
  const openEditEmployee = (emp: User) => {
    setSelectedEmployee(emp);
    setEditEmpName(emp.name);
    setEditEmpEmail(emp.email);
    setEditEmpRole(emp.role);
    setEditEmpPassword('');
    setEmployeeModalOpen(true);
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    setUpdatingEmployee(true);
    try {
      const cleanEmail = editEmpEmail.trim().toLowerCase();
      
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          action: 'update',
          userId: selectedEmployee.id,
          name: editEmpName,
          email: cleanEmail,
          password: editEmpPassword.trim() || undefined,
          role: editEmpRole
        }
      });
      if (error) throw new Error(error.message || 'Failed to update employee');
      if (data?.error) throw new Error(data.error);

      logActivity('employee_updated', 'employee', selectedEmployee.id, { name: editEmpName });
      triggerHaptic('success');
      toast.success(language === 'ar' ? 'تم تحديث بيانات الموظف بنجاح' : 'Employee details updated successfully');
      setEmployeeModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err: any) {
      triggerHaptic('error');
      console.error('[Update Employee]', err);
      toast.error(err.message || (language === 'ar' ? 'حدث خطأ أثناء تحديث بيانات الموظف' : 'An error occurred while updating employee'));
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
      if (error) throw new Error(error.message || 'Failed to delete employee');
      if (data?.error) throw new Error(data.error);

      logActivity('employee_deleted', 'employee', selectedEmployee.id, { name: selectedEmployee.name });
      triggerHaptic('success');
      toast.success(language === 'ar' ? 'تم حذف الموظف نهائياً بنجاح' : 'Employee deleted successfully');
      setDeleteConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err: any) {
      triggerHaptic('error');
      console.error('[Delete Employee]', err);
      toast.error(err.message || (language === 'ar' ? 'تعذر حذف حساب الموظف' : 'Could not delete employee account'));
    } finally {
      setUpdatingEmployee(false);
    }
  };

  // Export & Print report functions
  const { printReportHTML, exportPDF } = useReportExport({
    tasks: filteredTasks,
    getEmployeeName: (id: string | null) => getEmployeeName(id),
  });

  const exportToExcel = () => {
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF"
      + (language === 'ar' 
        ? "العنوان,الوصف,الموظف,المكان,تاريخ التنفيذ,الحالة,تاريخ الإنشاء\n"
        : "Title,Description,Employee,Location,Due Date,Status,Created At\n")
      + filteredTasks.map(t =>
        `"${t.title}","${t.description || ''}","${getEmployeeName(t.employeeId)}","${t.location || ''}","${t.dueDate ? format(t.dueDate, 'yyyy/MM/dd') : ''}","${getStatusLabel(t.status)}","${format(t.createdAt, 'yyyy/MM/dd')}"`
      ).join("\n");

    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", language === 'ar' ? `تقرير_المهام_${format(Date.now(), 'yyyy-MM-dd')}.csv` : `Tasks_Report_${format(Date.now(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Mobile task card component
  const MobileTaskCard = ({ task }: { task: Task }) => (
    <div 
      onClick={() => openTaskDetails(task)}
      className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3 active:scale-[0.99] transition-transform cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-slate-900 text-sm leading-snug flex-1">{task.title}</h3>
        <span className={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full ${statusColors[task.status]}`}>
          {getStatusLabel(task.status)}
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
          className="flex-1 py-2 rounded-xl text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors border-none cursor-pointer"
        >
          {language === 'ar' ? 'تعديل' : 'Edit'}
        </button>
        <button
          onClick={() => handleDeleteTask(task)}
          className="flex-1 py-2 rounded-xl text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 transition-colors border-none cursor-pointer"
        >
          {language === 'ar' ? 'حذف' : 'Delete'}
        </button>
      </div>
    </div>
  );

  const getTabTitle = (tab: typeof activeTab) => {
    if (language === 'en') {
      const titles: Record<typeof activeTab, string> = {
        overview: 'Overview',
        tasks: 'Task Management',
        visits: 'Visit Logs',
        employees: 'Work Team',
        activity: 'Activity Logs',
        analytics: 'Analytics & Reports',
        attendance: 'Attendance Logs',
        leaves: 'Leave Requests'
      };
      return titles[tab];
    }
    const titles: Record<typeof activeTab, string> = {
      overview: 'نظرة عامة',
      tasks: 'إدارة المهام',
      visits: 'سجل الزيارات',
      employees: 'فريق العمل',
      activity: 'سجل العمليات',
      analytics: 'التحليلات والتقارير',
      attendance: 'سجل الحضور والغياب',
      leaves: 'طلبات المغادرة والإجازات'
    };
    return titles[tab];
  };

  return (
    <div className="flex h-screen w-screen bg-slate-50 font-sans overflow-hidden text-slate-900" dir={language === 'ar' ? 'rtl' : 'ltr'}>

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className={`w-[240px] bg-white ${language === 'ar' ? 'border-l' : 'border-r'} border-slate-200 flex-col p-6 shrink-0 z-10 hidden md:flex`}>
        <div className="mb-10">
          <AppLogo size={30} theme="light" showText={true} />
          {company && (
            <div className="text-xs font-semibold text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
              <span>{company.name}</span>
              <span className="bg-blue-100 text-blue-800 text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase">{company.plan}</span>
            </div>
          )}
        </div>

        <nav className="flex flex-col flex-1 gap-1">
          {(['overview', 'tasks', 'visits', 'attendance', 'leaves', 'employees', 'activity', 'analytics'] as const).map(tab => {
            const getSidebarLabel = (tId: typeof tab) => {
              if (language === 'en') {
                const labelsEn: Record<typeof tab, string> = {
                  overview: 'Dashboard',
                  tasks: 'Daily Tasks',
                  visits: 'Visit Logs',
                  attendance: 'Attendance Logs',
                  leaves: 'Leave Requests',
                  employees: 'Employees',
                  activity: 'Activity Logs',
                  analytics: 'Analytics & Reports'
                };
                return labelsEn[tId];
              }
              const labelsAr: Record<typeof tab, string> = {
                overview: 'لوحة التحكم',
                tasks: 'المهام اليومية',
                visits: 'سجل الزيارات',
                attendance: 'حضور وانصراف',
                leaves: 'طلبات الإجازات',
                employees: 'الموظفين',
                activity: 'سجل العمليات',
                analytics: 'التحليلات والتقارير'
              };
              return labelsAr[tId];
            };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex justify-start items-center px-4 py-3 rounded-xl font-medium border-none transition-all duration-200 cursor-pointer ${
                  activeTab === tab
                    ? 'bg-blue-50 text-blue-600 shadow-xs'
                    : 'text-slate-500 hover:bg-slate-50 bg-transparent hover:text-slate-800'
                }`}
              >
                {getSidebarLabel(tab)}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto pt-4 border-t border-slate-200 space-y-3">
          <Link to="/profile" className="flex items-center gap-3 hover:bg-slate-50 p-2 rounded-xl transition-colors cursor-pointer text-slate-800 decoration-none no-underline">
            <div className="w-9 h-9 bg-linear-to-br from-blue-50 to-blue-700 rounded-full shrink-0 flex items-center justify-center text-white text-sm font-bold overflow-hidden border border-blue-100">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Manager" className="w-full h-full object-cover" />
              ) : (
                (profile?.name || user?.email || 'م')[0].toUpperCase()
              )}
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-semibold truncate leading-tight">{profile?.name || user?.email?.split('@')[0] || 'المدير'}</div>
              <div className="text-xs text-slate-400 mt-0.5">{language === 'ar' ? 'مدير النظام' : 'Manager'}</div>
            </div>
          </Link>
          <button
            onClick={() => setLogoutConfirmOpen(true)}
            className="flex items-center text-slate-500 hover:text-red-500 px-2 py-2 transition-colors w-full rounded-lg hover:bg-red-50 cursor-pointer border-none bg-transparent"
          >
            <LogOut className={`w-4 h-4 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
            <span className="text-sm font-medium">{t.common.logout}</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* ── MOBILE HEADER ── */}
        <header className="md:hidden bg-white border-b border-slate-100 px-4 pb-3 safe-pt flex items-center justify-between sticky top-0 z-20 shadow-xs">
          <Link to="/profile" className="flex items-center gap-3 text-slate-800 decoration-none no-underline">
            <div className="w-8 h-8 bg-linear-to-br from-blue-50 to-blue-700 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden border border-blue-100">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Manager" className="w-full h-full object-cover" />
              ) : (
                (profile?.name || user?.email || 'م')[0].toUpperCase()
              )}
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">{getTabTitle(activeTab)}</div>
              <div className="text-[10px] text-slate-400">
                {profile?.name || user?.email?.split('@')[0]} {company ? `| ${company.name}` : ''}
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <NotificationCenter />
            <button onClick={() => setLogoutConfirmOpen(true)} className="p-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer border-none bg-transparent">
              <LogOut className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </header>

        {/* ── DESKTOP HEADER ── */}
        <header className="hidden md:flex bg-white border-b border-slate-100 px-8 py-4 items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl font-bold text-slate-900 m-0">{getTabTitle(activeTab)}</h1>
            <p className="text-slate-400 text-sm mt-0.5 m-0">
              {language === 'ar' 
                ? `متابعة سير العمل والمهام لـ ${company?.name || 'المؤسسة'}`
                : `Monitor workflow and tasks for ${company?.name || 'the organization'}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationCenter />
            {(activeTab === 'overview' || activeTab === 'tasks') && (
              <>
                <button onClick={exportToExcel} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer">
                  <FileText className="w-4 h-4" />
                  {language === 'ar' ? 'تصدير CSV' : 'Export CSV'}
                </button>
                <button onClick={openAddTask} className="bg-blue-600 text-white border-none py-2 px-5 rounded-xl font-semibold cursor-pointer hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-xs shadow-blue-200">
                  <Plus className="w-4 h-4" />
                  {language === 'ar' ? 'مهمة جديدة' : 'New Task'}
                </button>
              </>
            )}
            {activeTab === 'analytics' && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={printReportHTML} 
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                >
                  {language === 'ar' ? 'طباعة التقرير 🖨️' : 'Print Report 🖨️'}
                </button>
                <button 
                  onClick={exportPDF} 
                  className="bg-blue-600 text-white border-none py-2.5 px-5 rounded-xl font-semibold cursor-pointer hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-xs shadow-blue-200"
                >
                  {language === 'ar' ? 'تحميل PDF 📄' : 'Download PDF 📄'}
                </button>
              </div>
            )}
          </div>
        </header>

        {/* ── SCROLLABLE CONTENT AREA ── */}
        <div className="flex-1 overflow-y-auto relative">
          <PullToRefresh onRefresh={handleRefresh}>
          {isLoading && (
            <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xs z-20 flex items-center justify-center">
              <AppLoader size={44} />
            </div>
          )}

          {(tasksErrorObj || usersErrorObj || visitsErrorObj) && (
            <div className="m-4 bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                <span className="text-amber-600 font-bold text-sm">!</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800">{language === 'ar' ? 'تعذر جلب بعض البيانات' : 'Could not fetch some data'}</p>
                <p className="text-xs text-amber-600 mt-0.5">{language === 'ar' ? 'يرجى التأكد من إعداد جداول قاعدة البيانات بشكل صحيح' : 'Please check your database schemas'}</p>
              </div>
              <button onClick={() => window.location.reload()} className="text-xs font-semibold text-amber-700 hover:text-amber-900 border-none bg-transparent cursor-pointer">
                {language === 'ar' ? 'تحديث' : 'Refresh'}
              </button>
            </div>
          )}

          {/* ══ OVERVIEW ══ */}
          {activeTab === 'overview' && (
            <div className="p-4 md:p-8 space-y-6 pb-24 md:pb-8">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
                {[
                  { label: language === 'ar' ? 'إجمالي المهام' : 'Total Tasks', value: stats.total, color: 'text-slate-800', bg: 'bg-white' },
                  { label: language === 'ar' ? 'جاري العمل' : 'In Progress', value: stats.inProgress, color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: language === 'ar' ? 'المهام المكتملة' : 'Completed Tasks', value: stats.completed, color: 'text-green-600', bg: 'bg-green-50' },
                  { label: language === 'ar' ? 'زيارات ميدانية' : 'Field Visits', value: stats.withLocation, color: 'text-blue-600', bg: 'bg-blue-50' },
                ].map(s => (
                  <div key={s.label} className={`${s.bg} p-4 md:p-6 rounded-2xl border border-slate-100 shadow-xs`}>
                    <p className="text-xs md:text-sm text-slate-500 font-medium">{s.label}</p>
                    <p className={`text-3xl md:text-4xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Quick Actions for Attendance & Leaves */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('attendance')}
                  className="bg-linear-to-br from-blue-50 to-blue-100/60 p-5 rounded-3xl border border-blue-100/70 text-right cursor-pointer hover:shadow-xs active:scale-[0.99] transition-all"
                  dir={language === 'ar' ? 'rtl' : 'ltr'}
                >
                  <span className="w-10 h-10 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-lg font-bold shadow-md shadow-blue-200">⏰</span>
                  <h3 className={`font-bold text-slate-800 text-sm mt-3 mb-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'سجل الحضور والانصراف' : 'Attendance Logs'}</h3>
                  <p className={`text-[10px] text-slate-400 m-0 leading-relaxed ${language === 'ar' ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'متابعة أوقات دخول وخروج الموظفين والمسافات الجغرافية ولحظات التأخير' : 'Monitor check-in/out timings, spatial constraints, and latency logs'}</p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('leaves')}
                  className="bg-linear-to-br from-indigo-50 to-indigo-100/60 p-5 rounded-3xl border border-indigo-100/70 text-right cursor-pointer hover:shadow-xs active:scale-[0.99] transition-all"
                  dir={language === 'ar' ? 'rtl' : 'ltr'}
                >
                  <span className="w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-lg font-bold shadow-md shadow-indigo-200">📄</span>
                  <h3 className={`font-bold text-slate-800 text-sm mt-3 mb-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'طلبات المغادرة والإجازات' : 'Leave & Excuse Requests'}</h3>
                  <p className={`text-[10px] text-slate-400 m-0 leading-relaxed ${language === 'ar' ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'مراجعة وتدقيق وقبول أو رفض طلبات مغادرات الموظفين والإجازات المرضية والسنوية' : 'Review, approve, or reject employee excuse, sickness, or annual leaves'}</p>
                </button>
              </div>

              {/* Recent Tasks */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-xs overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-50 dark:border-slate-700/40 flex justify-between items-center">
                  <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">{language === 'ar' ? 'آخر المهام' : 'Recent Tasks'}</h2>
                  <button onClick={() => setActiveTab('tasks')} className="text-blue-600 dark:text-blue-400 text-xs font-semibold hover:underline bg-transparent border-none cursor-pointer flex items-center gap-1">
                    {language === 'ar' ? 'عرض الكل' : 'View All'} <ChevronLeft className={`w-3.5 h-3.5 ${language === 'en' ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                <div className="p-4 md:p-0">
                  <TasksTable tasks={tasks.slice(0, 5)} employees={employees} onEdit={openEditTask} onDelete={handleDeleteTask} onView={openTaskDetails} />
                </div>
              </div>
            </div>
          )}

          {/* ══ TASKS ══ */}
          {activeTab === 'tasks' && (
            <div className="p-4 md:p-8 space-y-4 pb-24 md:pb-8">
              {/* Filter bar */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-xs p-4 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder={language === 'ar' ? 'ابحث عن مهمة أو موظف...' : 'Search task or employee...'}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-3 pr-10 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 dark:bg-slate-900/40 focus:bg-white transition-colors"
                  />
                  <Search className={`w-4 h-4 text-slate-400 absolute top-3 ${language === 'ar' ? 'right-3' : 'left-3'}`} />
                </div>
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  {/* Status Segmented Controller */}
                  <div className="flex border border-slate-200 dark:border-slate-700/60 rounded-xl p-1 bg-slate-50 dark:bg-slate-800/40 overflow-x-auto shrink-0 select-none">
                    {([
                      { id: 'all', label: language === 'ar' ? 'الكل' : 'All' },
                      { id: 'new', label: language === 'ar' ? 'جديدة' : 'New' },
                      { id: 'in_progress', label: language === 'ar' ? 'جاري العمل' : 'In Progress' },
                      { id: 'completed', label: language === 'ar' ? 'مكتملة' : 'Completed' },
                      { id: 'pending', label: language === 'ar' ? 'معلقة' : 'Pending' },
                    ] as const).map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setStatusFilter(item.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer whitespace-nowrap ${
                          statusFilter === item.id 
                            ? 'bg-blue-600 text-white shadow-xs' 
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-transparent'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <select
                    value={employeeFilter}
                    onChange={e => setEmployeeFilter(e.target.value)}
                    className="border border-slate-200 dark:border-slate-700 rounded-xl text-sm px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    <option value="all">{language === 'ar' ? 'كل الموظفين' : 'All Employees'}</option>
                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <div className="flex gap-2 items-center">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold shrink-0">{language === 'ar' ? 'من:' : 'From:'}</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="border border-slate-200 dark:border-slate-700 rounded-xl text-xs px-2.5 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 cursor-pointer"
                    />
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold shrink-0">{language === 'ar' ? 'إلى:' : 'To:'}</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="border border-slate-200 dark:border-slate-700 rounded-xl text-xs px-2.5 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 cursor-pointer"
                    />
                  </div>
                  {(startDate || endDate) && (
                    <button
                      onClick={() => { setStartDate(''); setEndDate(''); }}
                      className="px-3 py-2 rounded-xl text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 border-none cursor-pointer transition-colors"
                    >
                      {language === 'ar' ? 'تصفير التواريخ' : 'Reset Dates'}
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-xs overflow-hidden p-4 md:p-0">
                <TasksTable tasks={filteredTasks} employees={employees} onEdit={openEditTask} onDelete={handleDeleteTask} onView={openTaskDetails} />
              </div>
            </div>
          )}

          {/* ══ EMPLOYEES ══ */}
          {activeTab === 'employees' && (
            <div className="p-4 md:p-8 pb-24 md:pb-8">
              {/* Desktop table */}
              <div className="hidden md:block bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-800 m-0">{language === 'ar' ? 'قائمة الموظفين' : 'Employees List'}</h2>
                  <Link
                    to="/profile#register-employee"
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold decoration-none no-underline shadow-xs shadow-blue-200 transition-colors cursor-pointer border-none"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    {language === 'ar' ? 'تسجيل موظف جديد' : 'Register New Employee'}
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className={`${language === 'ar' ? 'text-right' : 'text-left'} p-4 border-b border-slate-100 text-slate-400 text-sm font-medium`}>{language === 'ar' ? 'الاسم' : 'Name'}</th>
                        <th className={`${language === 'ar' ? 'text-right' : 'text-left'} p-4 border-b border-slate-100 text-slate-400 text-sm font-medium`}>{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</th>
                        <th className={`${language === 'ar' ? 'text-right' : 'text-left'} p-4 border-b border-slate-100 text-slate-400 text-sm font-medium`}>{language === 'ar' ? 'الدور الوظيفي' : 'Role'}</th>
                        <th className={`${language === 'ar' ? 'text-right' : 'text-left'} p-4 border-b border-slate-100 text-slate-400 text-sm font-medium`}>{language === 'ar' ? 'الحالة الحالية' : 'Current Status'}</th>
                        <th className={`${language === 'ar' ? 'text-right' : 'text-left'} p-4 border-b border-slate-100 text-slate-400 text-sm font-medium`}>{language === 'ar' ? 'تاريخ الانضمام' : 'Join Date'}</th>
                        <th className="text-center p-4 border-b border-slate-100 text-slate-400 text-sm font-medium w-32">{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
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
                                {emp.role === 'manager' ? (language === 'ar' ? 'مدير' : 'Manager') : (language === 'ar' ? 'موظف' : 'Employee')}
                              </span>
                            </td>
                            <td className="p-4 border-b border-slate-50 text-sm">
                              {activeTask ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                  </span>
                                  {language === 'ar' ? 'في مهمة:' : 'Working on:'} <span className="font-bold truncate max-w-[120px]">{activeTask.title}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                  <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                                  {language === 'ar' ? 'متاح' : 'Available'}
                                </span>
                              )}
                            </td>
                            <td className="p-4 border-b border-slate-50 text-sm text-slate-500">{format(emp.createdAt, 'yyyy/MM/dd')}</td>
                            <td className="p-4 border-b border-slate-50 text-center">
                              <div className="flex justify-center gap-2">
                                <button
                                  onClick={() => openEditEmployee(emp)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 border-none bg-transparent rounded-lg transition-colors cursor-pointer"
                                  title={language === 'ar' ? 'تعديل بيانات الموظف' : 'Edit Employee'}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                {!isSelf && (
                                  <button
                                    onClick={() => openDeleteEmployee(emp)}
                                    className="p-1.5 text-rose-600 hover:bg-rose-50 border-none bg-transparent rounded-lg transition-colors cursor-pointer"
                                    title={language === 'ar' ? 'حذف الموظف نهائياً' : 'Delete Employee'}
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
                        <tr><td colSpan={6} className="p-6 text-center text-slate-400">{language === 'ar' ? 'لا يوجد موظفون مسجلون' : 'No registered employees'}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                <div className="flex items-center justify-between mb-1 bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
                  <span className="text-sm font-bold text-slate-800">{language === 'ar' ? 'أعضاء الفريق' : 'Team Members'}</span>
                  <Link
                    to="/profile#register-employee"
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[11px] font-bold decoration-none no-underline transition-colors cursor-pointer border-none"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    {language === 'ar' ? 'إضافة موظف' : 'Add Employee'}
                  </Link>
                </div>
                {employees.map(emp => {
                  const activeTask = employeeActiveTasks[emp.id];
                  const isSelf = emp.id === user?.id;
                  return (
                    <div key={emp.id} className="bg-white rounded-2xl border border-slate-100 shadow-xs p-4 flex flex-col gap-3">
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
                        <span className="text-xs text-slate-400">{language === 'ar' ? 'الدور الوظيفي' : 'Role'}</span>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          emp.role === 'manager' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-slate-50 text-slate-700 border border-slate-100'
                        }`}>
                          {emp.role === 'manager' ? (language === 'ar' ? 'مدير' : 'Manager') : (language === 'ar' ? 'موظف' : 'Employee')}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-50 flex items-center justify-between">
                        <span className="text-xs text-slate-400">{language === 'ar' ? 'الحالة الميدانية' : 'Field Status'}</span>
                        {activeTask ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                            </span>
                            {language === 'ar' ? 'في مهمة:' : 'In task:'} <span className="font-bold truncate max-w-[120px]">{activeTask.title}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                            {language === 'ar' ? 'متاح' : 'Available'}
                          </span>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-50 flex justify-end gap-3">
                        <button
                          onClick={() => openEditEmployee(emp)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs text-blue-600 bg-blue-50/50 hover:bg-blue-50 border border-blue-100 rounded-xl transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          {language === 'ar' ? 'تعديل' : 'Edit'}
                        </button>
                        {!isSelf && (
                          <button
                            onClick={() => openDeleteEmployee(emp)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs text-rose-600 bg-rose-50/50 hover:bg-rose-50 border border-rose-100 rounded-xl transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {language === 'ar' ? 'حذف' : 'Delete'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {employees.length === 0 && (
                  <div className="text-center py-12 text-slate-400 text-sm bg-white rounded-2xl border border-slate-100 shadow-xs">
                    {language === 'ar' ? 'لا يوجد موظفون مسجلون' : 'No registered employees'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ VISITS ══ */}
          {activeTab === 'visits' && (
            <div className="p-4 md:p-8 pb-24 md:pb-8">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between flex-wrap gap-3">
                  <h2 className="text-base font-bold text-slate-800">{language === 'ar' ? 'سجل الزيارات الميدانية' : 'Field Visits Log'}</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setVisitsView('list')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border-none cursor-pointer transition-all ${
                        visitsView === 'list'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {language === 'ar' ? 'قائمة الزيارات' : 'Visits List'}
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
                      {language === 'ar' ? 'الخريطة التفاعلية' : 'Interactive Map'}
                    </button>
                  </div>
                  <span className="text-xs text-slate-400 bg-slate-50 px-3 py-1 rounded-full font-medium">
                    {tasks.filter(t => t.location).length} {language === 'ar' ? 'زيارة' : 'visits'}
                  </span>
                </div>
                <div className="p-4 space-y-3">
                  {visitsView === 'map' ? (
                    <TaskMap tasks={filteredTasks} getEmployeeName={getEmployeeName} />
                  ) : (
                    filteredTasks.filter(t => t.location).length > 0 ? (
                      filteredTasks.filter(t => t.location).map(task => (
                        <div key={task.id} className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 space-y-2.5">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <h3 className="font-semibold text-slate-900 text-sm">{task.title}</h3>
                              <p className="text-xs text-slate-400 mt-0.5">{getEmployeeName(task.employeeId)}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                              {task.startLatitude && (
                                <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-bold">
                                  {language === 'ar' ? 'بدء موثق' : 'Verified Start'}
                                </span>
                              )}
                              {task.latitude && (
                                <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-bold">
                                  {language === 'ar' ? 'إتمام موثق' : 'Verified Completion'}
                                </span>
                              )}
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${statusColors[task.status]}`}>
                                {getStatusLabel(task.status)}
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
                                📌 {language === 'ar' ? 'موقع البدء (GPS)' : 'Start Location (GPS)'}
                              </button>
                            )}
                            {task.latitude && task.longitude && (
                              <button
                                onClick={() => openExternalUrl(`https://www.google.com/maps/search/?api=1&query=${task.latitude},${task.longitude}`)}
                                className="px-2.5 py-1 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-[11px] font-semibold border-none cursor-pointer flex items-center gap-1 transition-colors"
                              >
                                📍 {language === 'ar' ? 'موقع الإتمام (GPS)' : 'End Location (GPS)'}
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
                              <img src={task.imageUrl} alt="Visit" className="w-full h-24 object-cover hover:scale-105 transition-transform" />
                            </a>
                          )}
                          <div className="text-[10px] text-slate-400 pt-1">
                            {task.createdAt ? new Date(task.createdAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') : ''}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-10 text-slate-400 text-sm">{language === 'ar' ? 'لا توجد زيارات ميدانية مسجلة' : 'No registered field visits'}</div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══ ATTENDANCE ══ */}
          {activeTab === 'attendance' && (
            <div className="p-4 md:p-8 pb-24 md:pb-8">
              <AttendanceTable />
            </div>
          )}

          {/* ══ LEAVES ══ */}
          {activeTab === 'leaves' && (
            <div className="p-4 md:p-8 pb-24 md:pb-8">
              <LeaveRequestsPanel />
            </div>
          )}

          {/* ══ ACTIVITY LOG ══ */}
          {activeTab === 'activity' && (
            <div className="p-4 md:p-8 pb-24 md:pb-8">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between flex-wrap gap-3">
                  <h2 className="text-base font-bold text-slate-800">{language === 'ar' ? 'سجل عمليات النظام (Audit Log)' : 'System Audit Log'}</h2>
                  <span className="text-xs text-slate-400 bg-slate-50 px-3 py-1 rounded-full font-medium">
                    {activities.length} {language === 'ar' ? 'عملية مسجلة' : 'activities logged'}
                  </span>
                </div>
                <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
                  {activities.length > 0 ? (
                    activities.map((act) => {
                      let Icon = Clock;
                      let iconColor = 'text-slate-500 bg-slate-50';
                      let actionName = act.action;

                      if (act.action === 'task_created') {
                        Icon = Plus;
                        iconColor = 'text-green-600 bg-green-50';
                        actionName = language === 'ar' ? 'إنشاء مهمة جديدة' : 'Created new task';
                      } else if (act.action === 'task_updated') {
                        Icon = Edit2;
                        iconColor = 'text-blue-600 bg-blue-50';
                        actionName = language === 'ar' ? 'تعديل مهمة' : 'Updated task';
                      } else if (act.action === 'task_deleted') {
                        Icon = Trash2;
                        iconColor = 'text-rose-600 bg-rose-50';
                        actionName = language === 'ar' ? 'حذف مهمة' : 'Deleted task';
                      } else if (act.action === 'employee_added') {
                        Icon = UserPlus;
                        iconColor = 'text-emerald-600 bg-emerald-50';
                        actionName = language === 'ar' ? 'إضافة موظف جديد' : 'Added new employee';
                      } else if (act.action === 'employee_updated') {
                        Icon = UserIcon;
                        iconColor = 'text-indigo-600 bg-indigo-50';
                        actionName = language === 'ar' ? 'تعديل بيانات موظف' : 'Updated employee details';
                      } else if (act.action === 'employee_deleted') {
                        Icon = Trash2;
                        iconColor = 'text-red-600 bg-red-50';
                        actionName = language === 'ar' ? 'حذف موظف' : 'Deleted employee';
                      } else if (act.action === 'company_settings_updated') {
                        Icon = Settings;
                        iconColor = 'text-amber-600 bg-amber-50';
                        actionName = language === 'ar' ? 'تحديث إعدادات الشركة' : 'Updated settings';
                      } else if (act.action === 'task_status_changed') {
                        Icon = CheckCircle;
                        iconColor = 'text-purple-600 bg-purple-50';
                        actionName = language === 'ar' ? 'تغيير حالة المهمة' : 'Changed task status';
                      }

                      return (
                        <div key={act.id} className="p-4 flex items-start gap-3 hover:bg-slate-50/50 transition-colors">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconColor}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-slate-800 text-sm">{actionName}</span>
                              <span className="text-[10px] text-slate-400 font-medium shrink-0">
                                {format(new Date(act.createdAt), 'yyyy/MM/dd HH:mm')}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                              <span>{language === 'ar' ? 'بواسطة:' : 'By:'}</span>
                              <span className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-sm">
                                {act.actorName}
                              </span>
                              {act.metadata && Object.keys(act.metadata).length > 0 && (
                                <>
                                  <span className="text-slate-300">|</span>
                                  <span>{language === 'ar' ? 'تفاصيل:' : 'Details:'}</span>
                                  <span className="text-slate-600 font-medium">
                                    {act.metadata.title || act.metadata.name || act.metadata.companyName || JSON.stringify(act.metadata)}
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-12 text-slate-400 text-sm">
                      {language === 'ar' ? 'لا توجد عمليات مسجلة في السجل حالياً' : 'No system activity logged yet'}
                    </div>
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
                  {language === 'ar' ? 'طباعة التقرير 🖨️' : 'Print Report 🖨️'}
                </button>
                <button 
                  onClick={exportPDF} 
                  className="flex-1 py-2.5 bg-blue-600 text-white border-none rounded-xl hover:bg-blue-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                >
                  {language === 'ar' ? 'تحميل PDF 📄' : 'Download PDF 📄'}
                </button>
              </div>

              {/* KPI Cards Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
                <KPICard 
                  title={language === 'ar' ? 'معدل إنجاز المهام' : 'Completion Rate'} 
                  value={`${completionRate}%`} 
                  change={completionRate >= 70 ? (language === 'ar' ? "+ جيد جداً" : "+ Very Good") : (language === 'ar' ? "- يحتاج تحسين" : "- Needs work")} 
                  isPositive={completionRate >= 70}
                  icon={<FileText className="w-5 h-5" />} 
                />
                <KPICard 
                  title={language === 'ar' ? 'متوسط وقت الإنجاز' : 'Avg Completion Time'} 
                  value={language === 'ar' ? '1.8 يوم' : '1.8 Days'} 
                  change={language === 'ar' ? 'ضمن المهلة' : 'Within SLA'} 
                  isPositive={true}
                  icon={<Calendar className="w-5 h-5" />} 
                />
                <KPICard 
                  title={language === 'ar' ? 'زيارات موثقة GPS' : 'GPS Verified Visits'} 
                  value={dateFilteredTasks.filter(t => t.latitude).length} 
                  change={`${Math.round((dateFilteredTasks.filter(t => t.latitude).length / (dateFilteredTasks.filter(t => t.location).length || 1)) * 100)}%`} 
                  isPositive={true}
                  icon={<MapPin className="w-5 h-5" />} 
                />
                <KPICard 
                  title={language === 'ar' ? 'الموظف الأكثر نشاطاً' : 'Most Active Employee'} 
                  value={topEmployee} 
                  change={language === 'ar' ? 'الأكثر إنجازاً' : 'Highest efficiency'} 
                  isPositive={true}
                  icon={<UserIcon className="w-5 h-5" />} 
                />
              </div>

              {/* Charts Row 1: Weekly + Status Donut */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
                  <WeeklyPerformanceChart tasks={dateFilteredTasks} />
                </div>
                <div className="lg:col-span-1 bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
                  <TaskStatusDonut tasks={dateFilteredTasks} />
                </div>
              </div>

              {/* Charts Row 2: Employee Performance */}
              <div className="grid grid-cols-1 bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
                <EmployeePerformanceChart tasks={dateFilteredTasks} employees={employees} />
              </div>
            </div>
          )}
          </PullToRefresh>
        </div>
      </main>

      {/* ── MOBILE FAB (Add Task) ── */}
      {(activeTab === 'overview' || activeTab === 'tasks') && (
        <button
          onClick={openAddTask}
          className="md:hidden fixed bottom-20 left-4 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-300/50 flex items-center justify-center z-40 hover:bg-blue-700 active:scale-95 transition-all border-none cursor-pointer"
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
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl w-full max-w-md overflow-hidden animate-scale-up" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800 m-0">{language === 'ar' ? 'تعديل بيانات الموظف' : 'Edit Employee Details'}</h2>
              <button
                onClick={() => setEmployeeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 bg-transparent border-none text-base cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdateEmployee} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">{language === 'ar' ? 'الاسم كامل' : 'Full Name'}</label>
                <input
                  type="text"
                  value={editEmpName}
                  onChange={(e) => setEditEmpName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">{language === 'ar' ? 'البريد الإلكتروني (حساب الدخول)' : 'Email (Login Account)'}</label>
                <input
                  type="email"
                  value={editEmpEmail}
                  onChange={(e) => setEditEmpEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                  required
                />
                <p className="text-[10px] text-amber-600 mt-1.5 font-medium leading-relaxed bg-amber-50 px-3 py-2 rounded-xl border border-amber-100/50">
                  {language === 'ar' 
                    ? '⚠️ تنبيه: تعديل البريد الإلكتروني سيغير اسم المستخدم الذي يسجل به الموظف دخوله فوراً.'
                    : '⚠️ Warning: Changing the email address will immediately update the employee login credentials.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">{language === 'ar' ? 'الدور الوظيفي' : 'Role'}</label>
                <select
                  value={editEmpRole}
                  onChange={(e) => setEditEmpRole(e.target.value as 'manager' | 'employee')}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-colors cursor-pointer"
                >
                  <option value="employee">{language === 'ar' ? 'موظف ميداني' : 'Field Employee'}</option>
                  <option value="manager">{language === 'ar' ? 'مدير' : 'Manager'}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">{language === 'ar' ? 'كلمة مرور جديدة (اختياري)' : 'New Password (Optional)'}</label>
                <input
                  type="password"
                  placeholder={language === 'ar' ? 'اتركه فارغاً للاحتفاظ بكلمة المرور الحالية' : 'Leave empty to keep current password'}
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
                  {updatingEmployee ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (language === 'ar' ? 'حفظ التغييرات' : 'Save Changes')}
                </button>
                <button
                  type="button"
                  onClick={() => setEmployeeModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors border-none cursor-pointer"
                >
                  {t.common.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EMPLOYEE DELETE CONFIRM MODAL ── */}
      {isDeleteConfirmOpen && selectedEmployee && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl w-full max-w-sm p-6 space-y-4 text-center animate-scale-up" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center text-xl mx-auto border border-rose-100">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">{language === 'ar' ? 'حذف الموظف نهائياً' : 'Delete Employee Account'}</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                {language === 'ar' ? (
                  <>
                    هل أنت متأكد من رغبتك في حذف الموظف <span className="font-bold text-slate-800">{selectedEmployee.name}</span>؟<br />
                    سيتم إلغاء حساب دخول الموظف فوراً ولن يتمكن من الوصول للتطبيق مجدداً. هذا الإجراء لا يمكن التراجع عنه.
                  </>
                ) : (
                  <>
                    Are you sure you want to delete employee <span className="font-bold text-slate-800">{selectedEmployee.name}</span>?<br />
                    The login credentials will be revoked immediately and access will be blocked forever. This action is irreversible.
                  </>
                )}
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleDeleteEmployee}
                disabled={updatingEmployee}
                className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-semibold hover:bg-rose-700 disabled:opacity-50 transition-colors border-none cursor-pointer flex items-center justify-center"
              >
                {updatingEmployee ? (language === 'ar' ? 'جاري الحذف...' : 'Deleting...') : (language === 'ar' ? 'نعم، احذف الحساب' : 'Yes, Delete Account')}
              </button>
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors border-none cursor-pointer"
              >
                {t.common.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LOGOUT CONFIRM MODAL ── */}
      {isLogoutConfirmOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setLogoutConfirmOpen(false)}>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl w-full max-w-sm p-6 space-y-4 text-center animate-scale-up" onClick={(e) => e.stopPropagation()} dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center text-xl mx-auto border border-amber-100">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">{t.common.logoutConfirmTitle}</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                {t.common.logoutConfirmDesc}
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setLogoutConfirmOpen(false); signOut(); }}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors border-none cursor-pointer"
              >
                {t.common.yesLogout}
              </button>
              <button
                onClick={() => setLogoutConfirmOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors border-none cursor-pointer"
              >
                {t.common.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
