import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Task, statusLabels, statusColors, TaskStatus } from '../types';
import { LogOut, MapPin, CheckCircle, RefreshCcw, Hand, Camera, X, ImageIcon, ClipboardList, CheckSquare, PlusCircle, Cloud, CloudOff, Zap, TrendingUp, Info } from 'lucide-react';
import { useOfflineQueue, QueueItem } from '../hooks/useOfflineQueue';
import toast from 'react-hot-toast';
import { useTasks } from '../hooks/useTasks';
import { useImageUpload } from '../hooks/useImageUpload';
import { useQueryClient } from '@tanstack/react-query';
import { useGeoLocation, LocationCoords } from '../hooks/useGeoLocation';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { Capacitor } from '@capacitor/core';
import { openExternalUrl, takeNativePhoto, triggerHaptic } from '../lib/nativeServices';
import { useBackButton } from '../hooks/useBackButton';
import { useActivityLog } from '../hooks/useActivityLog';
import { useTranslation } from '../contexts/LanguageContext';
import PullToRefresh from '../components/PullToRefresh';
import NotificationCenter from '../components/NotificationCenter';
import AppLogo from '../components/AppLogo';
import AppLoader from '../components/AppLoader';
import PermissionGuideModal from '../components/PermissionGuideModal';
import AttendanceCard from '../components/AttendanceCard';
import LeaveRequestModal from '../components/LeaveRequestModal';
import VisitModal from '../components/VisitModal';
import { Briefcase, CalendarDays } from 'lucide-react';

// Helper function to calculate distance using the Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

export default function EmployeeDashboard() {
  const { signOut, user, profile, company } = useAuth();
  const { logActivity } = useActivityLog(false);
  const { t, language } = useTranslation();
  const queryClient = useQueryClient();
  const { tasks, isLoading, isError } = useTasks(user?.id);

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['tasks', user?.id] });
  };
  const { uploadImage, isUploading, progress, statusText } = useImageUpload();
  const { isOnline, queue, queueLength, addToQueue } = useOfflineQueue(() => {
    queryClient.invalidateQueries({ queryKey: ['tasks', user?.id] });
  });
  const { getCoordinates, loading: isLocating } = useGeoLocation();
  const { permission, isSubscribed, subscribeUser, loading: isSubscribing, isChecking: isCheckingPush } = usePushNotifications(user?.id);

  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [isLogoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  // Phase 4 States
  const [userCoords, setUserCoords] = useState<LocationCoords | null>(null);
  const [sortByProximity, setSortByProximity] = useState(false);
  const [isPermissionGuideOpen, setIsPermissionGuideOpen] = useState(false);
  const [permissionGuideType, setPermissionGuideType] = useState<'gps' | 'push'>('gps');
  const [updateInfo, setUpdateInfo] = useState<{ hasUpdate: boolean; latestTag: string; downloadUrl: string } | null>(null);
  const [isGpsDenied, setIsGpsDenied] = useState(false);

  // Swipe gesture states
  const [touchStart, setTouchStart] = useState<{ id: string; x: number; y: number } | null>(null);
  const [swipeTranslate, setSwipeTranslate] = useState<{ id: string; x: number } | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  // Get current user location on mount and on refresh
  useEffect(() => {
    getCoordinates()
      .then(coords => {
        setUserCoords(coords);
        setIsGpsDenied(false);
      })
      .catch(err => {
        console.log('[GPS] Initial coordinates fetch failed or denied:', err);
        // If it was denied or requires activation, set isGpsDenied to true
        if (
          err.message?.includes('صلاحية') || 
          err.message?.includes('permission') || 
          err.message?.includes('تفعيل') || 
          err.message?.includes('disabled') ||
          err.code === 1
        ) {
          setIsGpsDenied(true);
        }
      });
  }, [getCoordinates]);

  // Check for in-app updates on startup (cached for 24 hours to prevent GitHub API rate limits)
  useEffect(() => {
    const checkUpdates = async () => {
      try {
        const lastCheck = localStorage.getItem('last_version_check_time');
        const now = Date.now();
        // Skip check if we already checked in the last 24 hours (86,400,000 ms)
        if (lastCheck && now - parseInt(lastCheck, 10) < 86400000) {
          console.log('[Update Checker] Skipped. Last check was less than 24 hours ago.');
          return;
        }

        const res = await fetch('https://api.github.com/repos/mom056/taskflow/releases/latest');
        if (!res.ok) return;
        const data = await res.json();
        const latestTag = data.tag_name; // e.g., "v1.4.0"
        const localVersion = 'v2.0.5'; // current build version

        // Record check timestamp
        localStorage.setItem('last_version_check_time', now.toString());

        if (latestTag && latestTag !== localVersion) {
          setUpdateInfo({
            hasUpdate: true,
            latestTag,
            downloadUrl: `https://github.com/mom056/taskflow/releases/latest/download/app-release.apk`
          });
        }
      } catch (err) {
        console.warn('[Update Checker] Failed to fetch latest release details:', err);
      }
    };

    if (isOnline) {
      checkUpdates();
    }
  }, [isOnline]);

  // Auto-request push notification permissions on first app open
  useEffect(() => {
    if (user?.id && !isSubscribed && isOnline) {
      // Small timeout to ensure dashboard render is complete and smooth
      const timer = setTimeout(() => {
        subscribeUser().catch((err) => {
          console.log('[PushNotifications] Auto-prompt skipped or failed:', err);
        });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [user?.id, isSubscribed, subscribeUser, isOnline]);

  // Compute stats for KPI cards
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;

    // completed this week (since Sunday)
    const startOfWeek = new Date();
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfWeekTimestamp = startOfWeek.getTime();

    const completedThisWeek = tasks.filter(
      t => t.status === 'completed' && t.updatedAt && t.updatedAt >= startOfWeekTimestamp
    ).length;

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      inProgress,
      completedThisWeek,
      completionRate,
    };
  }, [tasks]);

  // Create task modal
  const [isTaskFormOpen, setTaskFormOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', location: '', dueDate: '' });

  // Attendance & Leaves & Visits states
  const [isLeaveModalOpen, setLeaveModalOpen] = useState(false);
  const [isVisitModalOpen, setVisitModalOpen] = useState(false);

  // Notes & image modal
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskNotes, setTaskNotes] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

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

  // Intercept hardware back button on Android
  useBackButton(() => {
    if (isTaskFormOpen) {
      setTaskFormOpen(false);
      return true;
    }
    if (selectedTask) {
      setSelectedTask(null);
      return true;
    }
    if (activeTab !== 'active') {
      setActiveTab('active');
      return true;
    }
    return false; // Exit app
  }, 10, true);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channelName = `emp_tasks_${user.id}_${Math.random().toString(36).substring(2, 15)}`;
    const sub = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `employee_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['tasks', user.id] });
      })
      .subscribe((status, err) => {
        if (err) console.warn('[EmployeeDashboard] Realtime error (non-fatal):', err.message);
      });
    return () => { supabase.removeChannel(sub); };
  }, [user, queryClient]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsCreating(true);
    try {
      const due = newTask.dueDate ? new Date(`${newTask.dueDate}T12:00:00`).getTime() : null;
      const taskPayload = {
        title: newTask.title,
        description: newTask.description || null,
        location: newTask.location || null,
        status: 'new',
        employee_id: user.id,
        created_by: user.id,
        company_id: profile?.company_id,
        due_date: due,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      if (!isOnline) {
        addToQueue('create_task', taskPayload);
        setNewTask({ title: '', description: '', location: '', dueDate: '' });
        setTaskFormOpen(false);
        return;
      }

      const { data, error } = await supabase
        .from('tasks')
        .insert([taskPayload])
        .select('id')
        .single();
      if (error) throw error;
      logActivity('task_created', 'task', data?.id, { title: newTask.title });
      setNewTask({ title: '', description: '', location: '', dueDate: '' });
      setTaskFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ['tasks', user.id] });
      toast.success(language === 'ar' ? 'تمت إضافة المهمة بنجاح' : 'Task added successfully');
    } catch (err: any) {
      console.error('[CreateTask]', err?.message);
      toast.error(language === 'ar' ? 'تعذر إنشاء المهمة — تأكد من تطبيق سياسات قاعدة البيانات' : 'Could not create task. Check policies.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateStatus = async (taskId: string, newStatus: TaskStatus) => {
    if (!user) return;
    if (updatingTaskId) return; // Debounce concurrent clicks
    setUpdatingTaskId(taskId);

    const isTempTask = taskId.length < 15;

    let latitude = null;
    let longitude = null;
    let locationVerifiedAt = null;

    const isStart = newStatus === 'in_progress';
    const isComplete = newStatus === 'completed';

    try {
      if (isStart || isComplete) {
        const toastId = toast.loading(isStart 
          ? (language === 'ar' ? 'جاري تحديد موقعك الجغرافي لتوثيق بدء العمل على المهمة...' : 'Getting GPS location to document task start...')
          : (language === 'ar' ? 'جاري تحديد موقعك الجغرافي للتحقق من إتمام المهمة ميدانياً...' : 'Getting GPS location to verify task completion...')
        );
        try {
          const coords = await getCoordinates();
          latitude = coords.latitude;
          longitude = coords.longitude;
          locationVerifiedAt = Date.now();
          setUserCoords(coords); // Update coordinates state
          toast.success(isStart 
            ? (language === 'ar' ? 'تم توثيق موقع بدء العمل بنجاح ✓' : 'Start location verified ✓') 
            : (language === 'ar' ? 'تم التقاط إحداثيات الموقع الجغرافي بنجاح ✓' : 'GPS location captured successfully ✓'), 
            { id: toastId }
          );
          // Warn when location is approximate (cached or low-accuracy)
          if (coords.approximate) {
            toast(language === 'ar' 
              ? '⚠️ تنبيه: الموقع المسجل تقريبي وقد لا يمثل مكانك الحالي بدقة. حاول الانتقال لمكان مفتوح لتحسين الدقة.'
              : '⚠️ Warning: GPS is approximate. Try moving to an open area for better accuracy.', {
              duration: 6000,
              icon: '📍',
            });
          }
        } catch (err: any) {
          triggerHaptic('error');
          setPermissionGuideType('gps');
          setIsPermissionGuideOpen(true);
          toast.error(err.message || (language === 'ar' ? 'فشل جلب الموقع الجغرافي. يجب السماح بالوصول للـ GPS لتغيير حالة المهمة.' : 'GPS failure. Access permission is required to update task status.'), { id: toastId });
          return; // Block status change if GPS coordinate capture fails
        }
      }

      const payload: any = { status: newStatus };
      if (isStart) {
        payload.start_latitude = latitude;
        payload.start_longitude = longitude;
        payload.start_location_verified_at = locationVerifiedAt;
      } else if (isComplete) {
        payload.latitude = latitude;
        payload.longitude = longitude;
        payload.location_verified_at = locationVerifiedAt;
      }

      if (!isOnline || isTempTask) {
        addToQueue('update_status', payload, taskId);
        return;
      }

      try {
        const dbUpdatePayload: any = { 
          status: newStatus, 
          updated_at: Date.now()
        };
        
        if (isStart) {
          dbUpdatePayload.start_latitude = latitude;
          dbUpdatePayload.start_longitude = longitude;
          dbUpdatePayload.start_location_verified_at = locationVerifiedAt;
        } else if (isComplete) {
          dbUpdatePayload.latitude = latitude;
          dbUpdatePayload.longitude = longitude;
          dbUpdatePayload.location_verified_at = locationVerifiedAt;
        }

        const { data, error } = await supabase
          .from('tasks')
          .update(dbUpdatePayload)
          .eq('id', taskId)
          .select();
        if (error) throw error;
        if (!data?.length) {
          toast.error(language === 'ar' ? 'لا تملك صلاحية تحديث هذه المهمة' : 'You do not have permission to update this task');
          return;
        }

        // Notify the manager/creator of the task
        const updatedTask = data[0];
        if (updatedTask.created_by && updatedTask.created_by !== user.id) {
          const statusText = newStatus === 'in_progress' ? 'بدأ العمل على' : 'أتمّ';
          const statusTextEn = newStatus === 'in_progress' ? 'started working on' : 'completed';
          await supabase.from('notifications').insert([{
            user_id: updatedTask.created_by,
            title: language === 'ar' ? 'تحديث على حالة مهمة' : 'Task Status Updated',
            body: language === 'ar'
              ? `${profile?.name || 'الموظف'} ${statusText} المهمة: ${updatedTask.title}`
              : `${profile?.name || 'Employee'} ${statusTextEn} the task: ${updatedTask.title}`,
            link: '/manager',
            company_id: profile?.company_id,
            created_at: Date.now()
          }]);
        }

        logActivity('task_status_changed', 'task', taskId, {
          title: data[0]?.title || 'task',
          oldStatus: tasks.find(t => t.id === taskId)?.status,
          newStatus: newStatus
        });
        triggerHaptic(isComplete ? 'success' : 'light');
        queryClient.invalidateQueries({ queryKey: ['tasks', user.id] });
        toast.success(isStart 
          ? (language === 'ar' ? 'تم بدء العمل على المهمة وتوثيق موقعك' : 'Task started and location documented') 
          : (language === 'ar' ? 'تم إتمام المهمة وتوثيق موقعك' : 'Task completed and location documented')
        );
      } catch (err: any) {
        triggerHaptic('error');
        console.error('[Task Update]', err);
        toast.error(language === 'ar' ? `خطأ: ${err.message || 'تعذر تحديث الحالة'}` : `Error: ${err.message || 'Could not update status'}`);
      }
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleSaveNotes = async () => {
    if (!user || !selectedTask) return;
    const isTempTask = selectedTask.id.length < 15;
    try {
      let imageUrl = selectedTask.imageUrl || null;
      if (imageFile) {
        if (!isOnline) {
          toast.loading(language === 'ar' ? 'جاري حفظ الصورة محلياً للرفع اللاحق...' : 'Saving image locally to upload later...');
          const reader = new FileReader();
          reader.readAsDataURL(imageFile);
          reader.onloadend = async () => {
            const base64data = reader.result as string;
            addToQueue('update_notes', { notes: taskNotes, imageUrl: base64data }, selectedTask.id);
            setSelectedTask(null); setTaskNotes(''); setImageFile(null); setImagePreview(null);
            toast.dismiss();
          };
          return;
        }

        const result = await uploadImage(imageFile, selectedTask.id);
        if (result.error) { toast.error(language === 'ar' ? `فشل رفع الصورة: ${result.error}` : `Image upload failed: ${result.error}`); return; }
        imageUrl = result.url;
      }

      if (!isOnline || isTempTask) {
        addToQueue('update_notes', { notes: taskNotes, imageUrl }, selectedTask.id);
        setSelectedTask(null); setTaskNotes(''); setImageFile(null); setImagePreview(null);
        return;
      }

      const { error } = await supabase.from('tasks')
        .update({ notes: taskNotes, image_url: imageUrl, updated_at: Date.now() })
        .eq('id', selectedTask.id);
      if (error) throw error;
      logActivity('task_updated', 'task', selectedTask.id, {
        title: selectedTask.title,
        notes: taskNotes,
        hasImage: !!imageUrl
      });
      setSelectedTask(null); setTaskNotes(''); setImageFile(null); setImagePreview(null);
      queryClient.invalidateQueries({ queryKey: ['tasks', user.id] });
      toast.success(language === 'ar' ? 'تم حفظ الملاحظات' : 'Notes saved successfully');
    } catch {
      toast.error(language === 'ar' ? 'حدث خطأ أثناء الحفظ' : 'An error occurred while saving');
    }
  };

  const openNotesModal = (task: Task) => {
    setSelectedTask(task); setTaskNotes(task.notes || '');
    setImageFile(null); setImagePreview(task.imageUrl || null);
  };

  // Merge offline queue items for visual display
  const getMergedTasks = () => {
    const merged = [...tasks];
    
    // Read from hook state (no direct localStorage dependency)
    const offlineQueue: QueueItem[] = queue;
    
    offlineQueue.forEach(item => {
      if (item.type === 'create_task') {
        const exists = merged.some(t => t.title === item.payload.title && t.createdAt === item.payload.created_at);
        if (!exists) {
          const tempTask = {
            id: item.id, // temp local id
            title: item.payload.title,
            description: item.payload.description,
            status: item.payload.status || 'new',
            location: item.payload.location,
            dueDate: item.payload.due_date,
            createdBy: item.payload.created_by,
            createdAt: item.payload.created_at,
            updatedAt: item.payload.updated_at,
            employeeId: item.payload.employee_id,
            isOfflinePending: true
          };
          merged.unshift(tempTask as any);
        }
      } else if (item.type === 'update_status') {
        const target = merged.find(t => t.id === item.taskId);
        if (target) {
          target.status = item.payload.status;
          (target as any).isOfflinePending = true;
        }
      } else if (item.type === 'update_notes') {
        const target = merged.find(t => t.id === item.taskId);
        if (target) {
          target.notes = item.payload.notes;
          target.imageUrl = item.payload.imageUrl;
          (target as any).isOfflinePending = true;
        }
      }
    });
    
    return merged;
  };

  const allMergedTasks = getMergedTasks();
  const activeTasks = allMergedTasks.filter(t => t.status !== 'completed');
  const completedTasks = allMergedTasks.filter(t => t.status === 'completed');
  const displayTasks = activeTab === 'active' ? activeTasks : completedTasks;

  // Chronologically ordered workday tasks for the workday path
  const workdayTasks = useMemo(() => {
    return [...allMergedTasks].sort((a, b) => {
      const dueA = a.dueDate || 0;
      const dueB = b.dueDate || 0;
      if (dueA !== dueB) return dueA - dueB;
      return a.createdAt - b.createdAt;
    });
  }, [allMergedTasks]);

  // Sort and process tasks by proximity if toggled
  const processedTasks = useMemo(() => {
    let list = [...displayTasks];
    if (activeTab === 'active' && sortByProximity && userCoords) {
      list.sort((a, b) => {
        const hasA = a.targetLatitude !== undefined && a.targetLatitude !== null && a.targetLongitude !== undefined && a.targetLongitude !== null;
        const hasB = b.targetLatitude !== undefined && b.targetLatitude !== null && b.targetLongitude !== undefined && b.targetLongitude !== null;
        
        if (!hasA && !hasB) return 0;
        if (!hasA) return 1;
        if (!hasB) return -1;
        
        const distA = calculateDistance(userCoords.latitude, userCoords.longitude, a.targetLatitude!, a.targetLongitude!);
        const distB = calculateDistance(userCoords.latitude, userCoords.longitude, b.targetLatitude!, b.targetLongitude!);
        return distA - distB;
      });
    }
    return list;
  }, [displayTasks, activeTab, sortByProximity, userCoords]);

  const getTaskDistance = (task: Task) => {
    if (!userCoords || !task.targetLatitude || !task.targetLongitude) return null;
    return calculateDistance(userCoords.latitude, userCoords.longitude, task.targetLatitude, task.targetLongitude);
  };

  const formatDistance = (dist: number) => {
    if (dist < 1) {
      const meters = Math.round(dist * 1000);
      return language === 'ar' ? `على بعد ${meters} متر` : `${meters}m away`;
    }
    return language === 'ar' ? `تبعد ${dist.toFixed(1)} كم` : `${dist.toFixed(1)}km away`;
  };

  const handleNodeClick = (taskId: string) => {
    const element = document.getElementById(`task-card-${taskId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('ring-4', 'ring-blue-500', 'ring-offset-2', 'dark:ring-offset-slate-900');
      triggerHaptic('light');
      setTimeout(() => {
        element.classList.remove('ring-4', 'ring-blue-500', 'ring-offset-2', 'dark:ring-offset-slate-900');
      }, 2000);
    }
  };

  // Swipe Gestures Handlers
  const handleTouchStart = (e: React.TouchEvent, taskId: string) => {
    if (!Capacitor.isNativePlatform() && window.innerWidth >= 768) return; // Only on mobile viewport or native
    const touch = e.touches[0];
    setTouchStart({ id: taskId, x: touch.clientX, y: touch.clientY });
  };

  const handleTouchMove = (e: React.TouchEvent, taskId: string) => {
    if (!touchStart || touchStart.id !== taskId) return;
    const touch = e.touches[0];
    const diffX = touch.clientX - touchStart.x;
    const diffY = touch.clientY - touchStart.y;
    
    if (Math.abs(diffX) > Math.abs(diffY)) {
      // limit swipe translation
      const limitedX = Math.max(-120, Math.min(120, diffX));
      setSwipeTranslate({ id: taskId, x: limitedX });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent, task: Task) => {
    if (!touchStart || touchStart.id !== task.id || !swipeTranslate || swipeTranslate.id !== task.id) {
      setTouchStart(null);
      setSwipeTranslate(null);
      return;
    }
    
    const diffX = swipeTranslate.x;
    
    if (diffX > 80) {
      // Swipe Right -> Start task
      if (task.status === 'new' || task.status === 'pending') {
        triggerHaptic('light');
        handleUpdateStatus(task.id, 'in_progress');
      }
    } else if (diffX < -80) {
      // Swipe Left -> Open Camera/Notes modal
      if (task.status === 'in_progress') {
        triggerHaptic('light');
        openNotesModal(task);
      }
    }
    
    setTouchStart(null);
    setSwipeTranslate(null);
  };

  const getCardStyle = (taskId: string) => {
    if (swipeTranslate && swipeTranslate.id === taskId) {
      return { transform: `translateX(${swipeTranslate.x}px)`, transition: 'none' };
    }
    return { transform: 'translateX(0px)', transition: 'transform 0.2s ease' };
  };

  const avatar = (profile?.name || user?.email || 'م')[0].toUpperCase();

  return (
    <div className="flex h-screen w-screen bg-slate-50 font-sans overflow-hidden text-slate-900" dir={language === 'ar' ? 'rtl' : 'ltr'}>

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className={`w-[240px] bg-white ${language === 'ar' ? 'border-l' : 'border-r'} border-slate-200 flex-col p-6 shrink-0 z-10 hidden md:flex`}>
        <div className="mb-10">
          <AppLogo size={30} theme="light" showText={true} />
          {company && (
            <div className="text-xs font-semibold text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
              <span>{company.name}</span>
            </div>
          )}
        </div>
        <nav className="flex flex-col flex-1 gap-1">
          {([
            { id: 'active', icon: ClipboardList, label: language === 'ar' ? 'مهامي النشطة' : 'My Active Tasks' },
            { id: 'completed', icon: CheckSquare, label: language === 'ar' ? 'المنجزة' : 'Completed' },
          ] as const).map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium border-none transition-all cursor-pointer ${activeTab === item.id ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50 bg-transparent'}`}>
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="mt-auto pt-4 border-t border-slate-200 space-y-3">
          <Link to="/profile" className="flex items-center gap-3 hover:bg-slate-50 p-2 rounded-xl transition-colors cursor-pointer text-slate-800 decoration-none no-underline">
            <div className="w-9 h-9 bg-linear-to-br from-blue-50 to-blue-700 rounded-full flex items-center justify-center text-white text-sm font-bold overflow-hidden border border-blue-100 shrink-0">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="User" className="w-full h-full object-cover" />
              ) : (
                avatar
              )}
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-semibold truncate">{profile?.name || user?.email?.split('@')[0]}</div>
              <div className="text-xs text-slate-400">{language === 'ar' ? 'موظف ميداني' : 'Field Employee'}</div>
            </div>
          </Link>
          <button onClick={() => setLogoutConfirmOpen(true)} className="flex items-center text-slate-500 hover:text-red-500 px-2 py-2 transition-colors w-full rounded-lg hover:bg-red-50 cursor-pointer border-none bg-transparent">
            <LogOut className={`w-4 h-4 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} /><span className="text-sm font-medium">{t.common.logout}</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Mobile header */}
        <header className="md:hidden bg-white border-b border-slate-100 px-4 pb-3 safe-pt flex items-center justify-between sticky top-0 z-20 shadow-xs">
          <Link to="/profile" className="flex items-center gap-3 text-slate-800 decoration-none no-underline">
            <div className="w-8 h-8 bg-linear-to-br from-blue-50 to-blue-700 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden border border-blue-100 shrink-0">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="User" className="w-full h-full object-cover" />
              ) : (
                avatar
              )}
            </div>
            <div>
              <div className="text-sm font-bold flex items-center gap-1.5">
                {activeTab === 'active' ? (language === 'ar' ? 'مهامي النشطة' : 'My Active Tasks') : (language === 'ar' ? 'المنجزة' : 'Completed')}
                {!isOnline && (
                  <span className="inline-flex items-center gap-0.5 bg-red-50 text-red-600 text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                    <CloudOff className="w-2.5 h-2.5" />
                    {queueLength > 0 ? (language === 'ar' ? `${queueLength} معلقة` : `${queueLength} pending`) : (language === 'ar' ? 'أوفلاين' : 'Offline')}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-400">
                {profile?.name || user?.email?.split('@')[0]} {company ? `| ${company.name}` : ''}
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <NotificationCenter />
            <button onClick={() => setLogoutConfirmOpen(true)} className="p-2 hover:bg-slate-100 rounded-full cursor-pointer border-none bg-transparent">
              <LogOut className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </header>

        {/* Desktop header */}
        <header className="hidden md:flex bg-white border-b border-slate-100 px-8 py-4 items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900 m-0">
                {activeTab === 'active' ? (language === 'ar' ? 'مهامي النشطة' : 'My Active Tasks') : (language === 'ar' ? 'المهام المنجزة' : 'Completed Tasks')}
              </h1>
              <p className="text-slate-400 text-sm mt-0.5 m-0">
                {language === 'ar' 
                  ? `تسجيل المهام الميدانية وتحديث حالتها لـ ${company?.name || 'المؤسسة'}`
                  : `Record field tasks and update their status for ${company?.name || 'the company'}`}
              </p>
            </div>
            {!isOnline ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 px-3 py-1 rounded-xl animate-pulse">
                <CloudOff className="w-4 h-4" />
                {language === 'ar' ? `غير متصل بالإنترنت (${queueLength} تعديلات معلقة الحفظ)` : `Offline (${queueLength} pending changes)`}
              </span>
            ) : (
              queueLength > 0 && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-xl">
                  <Cloud className="w-4 h-4" />
                  {language === 'ar' ? `جاري مزامنة ${queueLength} تعديل...` : `Syncing ${queueLength} updates...`}
                </span>
              )
            )}
          </div>
          <div className="flex items-center gap-3">
            <NotificationCenter />
            <button onClick={() => setTaskFormOpen(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors shadow-xs cursor-pointer border-none">
              <PlusCircle className="w-4 h-4" />{language === 'ar' ? 'مهمة / زيارة جديدة' : 'New Task / Visit'}
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
          {isLoading && (
            <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xs z-20 flex items-center justify-center">
              <AppLoader size={44} />
            </div>
          )}

          {isError && (
            <div className="m-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 p-4 rounded-2xl flex items-center gap-3">
              <span className="w-8 h-8 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold shrink-0">!</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">{language === 'ar' ? 'تعذر جلب المهام' : 'Could not fetch tasks'}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">{language === 'ar' ? 'تأكد من الاتصال بالإنترنت' : 'Check your internet connection'}</p>
              </div>
              <button onClick={() => window.location.reload()} className="text-xs font-semibold text-amber-700 dark:text-amber-400 border-none bg-transparent cursor-pointer">{language === 'ar' ? 'تحديث' : 'Refresh'}</button>
            </div>
          )}

          {/* Location Permission Denied Warning */}
          {isGpsDenied && (
            <div className="m-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 p-4 rounded-2xl flex items-start gap-3 shadow-xs">
              <span className="w-8 h-8 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold shrink-0 mt-0.5">📍</span>
              <div className="flex-1 leading-relaxed">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                  {language === 'ar' 
                    ? 'صلاحية تحديد الموقع (GPS) غير مفعلة' 
                    : 'Location Permission (GPS) is disabled'}
                </p>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                  {language === 'ar'
                    ? 'يرجى السماح للتطبيق بالوصول لموقعك الجغرافي لتسجيل حضورك وبدء العمل ميدانياً. انقر هنا لعرض دليل تفعيل الصلاحية.'
                    : 'Please allow the app to access your location to document task work and field attendance. Click here to view the setup guide.'}
                </p>
              </div>
              <button 
                onClick={() => {
                  setPermissionGuideType('gps');
                  setIsPermissionGuideOpen(true);
                }} 
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 border-none bg-transparent cursor-pointer underline shrink-0 mt-0.5"
              >
                {language === 'ar' ? 'عرض الدليل' : 'Show Guide'}
              </button>
            </div>
          )}

          {/* Insecure Context Warning */}
          {!Capacitor.isNativePlatform() && !window.isSecureContext && (
            <div className="m-4 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-4 rounded-2xl flex items-start gap-3 shadow-xs animate-pulse">
              <span className="w-8 h-8 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 font-bold shrink-0 mt-0.5">⚠️</span>
              <div className="flex-1 leading-relaxed">
                <p className="text-xs font-semibold text-red-800 dark:text-red-300">
                  {language === 'ar' 
                    ? 'اتصال غير آمن (HTTP) - ميزات الـ GPS والإشعارات معطلة من قبل المتصفح' 
                    : 'Insecure Connection (HTTP) - GPS & Notifications disabled by Browser'}
                </p>
                <p className="text-[11px] text-red-600 dark:text-red-400 mt-1">
                  {language === 'ar'
                    ? 'تمنع المتصفحات الوصول للموقع الجغرافي والإشعارات عبر روابط الـ HTTP العادية (مثل عناوين الـ IP المحلية). لتشغيلها، يرجى استخدام بروتوكول HTTPS أو localhost أو تجربة تطبيق الهاتف مباشرة عبر ملف الـ APK.'
                    : 'Browsers block GPS and Notification access on insecure HTTP origins (like local network IP addresses). To test these features, please use a secure HTTPS link, run on localhost, or install the native Android APK.'}
                </p>
              </div>
            </div>
          )}

          <PullToRefresh onRefresh={handleRefresh}>
            <div className="p-4 md:p-8 max-w-5xl mx-auto pb-24 md:pb-8 space-y-6">

              {/* Attendance Card & Quick Operations */}
              <AttendanceCard
                company={company}
                userCoords={userCoords}
                isLocating={isLocating}
                getCoordinates={getCoordinates}
                isOnline={isOnline}
                addToQueue={addToQueue}
              />

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setVisitModalOpen(true)}
                  className="flex items-center justify-center gap-2 px-4 py-3.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-xs text-slate-700 dark:text-slate-200 shadow-xs transition-colors cursor-pointer"
                >
                  <Briefcase className="w-4 h-4 text-blue-600" />
                  <span>تسجيل زيارة ميدانية</span>
                </button>
                <button
                  onClick={() => setLeaveModalOpen(true)}
                  className="flex items-center justify-center gap-2 px-4 py-3.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-xs text-slate-700 dark:text-slate-200 shadow-xs transition-colors cursor-pointer"
                >
                  <CalendarDays className="w-4 h-4 text-purple-600" />
                  <span>طلب إجازة / إذن مغادرة</span>
                </button>
              </div>

            {/* Segmented Control Bar for active / completed filters inside content */}
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-xs">
              <div className="flex border border-slate-200 dark:border-slate-700/60 rounded-xl p-1 bg-slate-50 dark:bg-slate-900/40 overflow-x-auto shrink-0 select-none w-full sm:w-auto">
                {([
                  { id: 'active', label: language === 'ar' ? 'مهام نشطة' : 'Active Tasks', count: activeTasks.length },
                  { id: 'completed', label: language === 'ar' ? 'مهام منجزة' : 'Completed Tasks', count: completedTasks.length },
                ] as const).map(item => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
                      activeTab === item.id
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 bg-transparent'
                    }`}
                  >
                    <span>{item.label}</span>
                    <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
                      activeTab === item.id
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200/60 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}>
                      {item.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Notification Banner */}
            {!isCheckingPush && !isSubscribed && permission !== 'granted' && isOnline && (
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">📢</span>
                  <div>
                    <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200">{language === 'ar' ? 'تفعيل إشعارات المهام المباشرة' : 'Enable Live Push Notifications'}</h4>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                      {language === 'ar' 
                        ? 'تلقى تنبيهات فورية على هاتفك بمجرد تكليفك بمهام أو زيارات جديدة من المدير.'
                        : 'Get instant notification on your device when a manager assigns you new tasks or visits.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await subscribeUser();
                      toast.success(language === 'ar' ? 'تم تفعيل الإشعارات بنجاح!' : 'Notifications enabled successfully!');
                    } catch (err: any) {
                      setPermissionGuideType('push');
                      setIsPermissionGuideOpen(true);
                      toast.error(err.message || (language === 'ar' ? 'فشل تفعيل الإشعارات' : 'Could not enable notifications'));
                    }
                  }}
                  disabled={isSubscribing}
                  className="bg-blue-600 text-white border-none px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shrink-0 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSubscribing ? (language === 'ar' ? 'جاري التفعيل...' : 'Activating...') : (language === 'ar' ? 'تفعيل الآن' : 'Enable Now')}
                </button>
              </div>
            )}

            {/* Mobile add button */}
            <div className="flex md:hidden justify-end">
              <button onClick={() => setTaskFormOpen(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors shadow-xs cursor-pointer border-none">
                <PlusCircle className="w-4 h-4" />{language === 'ar' ? 'مهمة جديدة' : 'New Task'}
              </button>
            </div>

            {/* Interactive Workday Path */}
            {activeTab === 'active' && workdayTasks.length > 0 && (
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-xs space-y-3">
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {language === 'ar' ? 'خط مسار اليوم التفاعلي' : 'Interactive Workday Path'}
                </h3>
                <div className="relative flex items-center justify-between py-2 overflow-x-auto gap-4 scrollbar-none workday-path-line">
                  {workdayTasks.map((task, idx) => {
                    const isCompleted = task.status === 'completed';
                    const isCurrent = task.status === 'in_progress';
                    
                    return (
                      <button
                        key={task.id}
                        onClick={() => handleNodeClick(task.id)}
                        className="relative flex flex-col items-center gap-1.5 min-w-[70px] border-none bg-transparent cursor-pointer group focus:outline-none z-10"
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                          isCompleted 
                            ? 'bg-green-500 text-white shadow-xs' 
                            : isCurrent 
                              ? 'bg-amber-500 text-white shadow-xs scale-110 ring-4 ring-amber-100 dark:ring-amber-900/50' 
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 group-hover:bg-slate-200'
                        }`}>
                          {isCompleted ? '✓' : idx + 1}
                        </div>
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate max-w-[80px] text-center">
                          {task.title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Active Task sorting toggle */}
            {activeTab === 'active' && activeTasks.length > 0 && userCoords && (
              <div className="flex justify-between items-center bg-white dark:bg-slate-800 px-4 py-3 rounded-xl border border-slate-100 dark:border-slate-700/60 shadow-xs">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {language === 'ar' ? 'فرز المهام النشطة:' : 'Sort Active Tasks:'}
                </span>
                <button
                  onClick={() => setSortByProximity(!sortByProximity)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                    sortByProximity 
                      ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {language === 'ar' ? '🔍 حسب الأقرب إليّ' : '🔍 Sort by Nearest'}
                </button>
              </div>
            )}

            {processedTasks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {processedTasks.map(task => {
                  const dist = getTaskDistance(task);
                  const isInsideGeofence = dist !== null && dist < 0.1; // < 100 meters
                  const isSwipePending = swipeTranslate && swipeTranslate.id === task.id;
                  
                  return (
                    <div 
                      key={task.id} 
                      id={`task-card-${task.id}`}
                      onTouchStart={(e) => handleTouchStart(e, task.id)}
                      onTouchMove={(e) => handleTouchMove(e, task.id)}
                      onTouchEnd={(e) => handleTouchEnd(e, task)}
                      style={getCardStyle(task.id)}
                      className={`bg-white dark:bg-slate-800 rounded-2xl border ${
                        isInsideGeofence && task.status !== 'completed'
                          ? 'border-green-500 dark:border-green-400 geofence-glow'
                          : 'border-slate-100 dark:border-slate-700/60'
                      } shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow relative select-none status-edge-${task.status}`}
                    >
                      {/* Swipe Actions Background visual indicators for mobile */}
                      {isSwipePending && (
                        <div className="absolute inset-0 -z-10 flex items-center justify-between px-4 text-xs font-bold text-white bg-slate-100 dark:bg-slate-700/30">
                          <span className="text-amber-600 dark:text-amber-400">➔ {language === 'ar' ? 'بدء المهمة' : 'Start Task'}</span>
                          <span className="text-blue-600 dark:text-blue-400">{language === 'ar' ? 'صورة وملاحظة' : 'Photo & Note'} ➔</span>
                        </div>
                      )}

                      <div className="p-5 flex-1">
                        <div className="flex justify-between items-start mb-2 gap-2">
                          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-snug">{task.title}</h3>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {(task as any).isOfflinePending && (
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-full flex items-center gap-0.5" title={language === 'ar' ? 'قيد المزامنة عند الاتصال' : 'Syncing when online'}>
                                <RefreshCcw className="w-2.5 h-2.5 animate-spin" />
                                {language === 'ar' ? 'قيد المزامنة' : 'Syncing'}
                              </span>
                            )}
                            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${statusColors[task.status]}`}>
                              {getStatusLabel(task.status)}
                            </span>
                          </div>
                        </div>
                        {task.description && <p className="text-slate-500 dark:text-slate-400 text-sm mb-3 leading-relaxed">{task.description}</p>}
                        <div className="space-y-2">
                          {task.location && (
                            <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                              <div className="flex items-center">
                                <MapPin className={`w-3.5 h-3.5 shrink-0 text-blue-400 ${language === 'ar' ? 'ml-1.5' : 'mr-1.5'}`} />
                                <span className="truncate max-w-[200px]">{task.location}</span>
                              </div>
                              {dist !== null && (
                                <span className="font-semibold text-blue-600 dark:text-blue-400 shrink-0">
                                  {formatDistance(dist)}
                                </span>
                              )}
                            </div>
                          )}
                          {task.notes && (
                            <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl text-xs text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700/60">
                              <span className="font-semibold block mb-1">{language === 'ar' ? 'ملاحظاتي:' : 'My Notes:'}</span>{task.notes}
                            </div>
                          )}
                          {task.imageUrl && (
                            <a href={task.imageUrl}
                              onClick={(e) => {
                                e.preventDefault();
                                openExternalUrl(task.imageUrl!);
                              }}
                              className="block overflow-hidden rounded-xl border border-slate-100 dark:border-slate-700/50 mt-2">
                              <img src={task.imageUrl} alt="attachment" className="w-full h-32 object-cover hover:scale-105 transition-transform duration-300" />
                            </a>
                          )}
                        </div>
                      </div>

                      {activeTab === 'active' && (
                        <div className="p-4 bg-slate-50/50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-700/60 space-y-3">
                          
                          {/* Geofence Check-in Button */}
                          {isInsideGeofence && (
                            <div className="pb-1 border-b border-dashed border-slate-200 dark:border-slate-700/40">
                              {task.status === 'in_progress' ? (
                                <button 
                                  onClick={() => handleUpdateStatus(task.id, 'completed')}
                                  disabled={updatingTaskId !== null}
                                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-green-600 hover:bg-green-700 text-white transition-all cursor-pointer shadow-sm animate-pulse flex items-center justify-center gap-1.5 border-none disabled:opacity-50"
                                >
                                  {updatingTaskId === task.id ? (
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <CheckCircle className="w-4 h-4 animate-bounce" />
                                  )}
                                  <span>{language === 'ar' ? 'لقد وصلت للموقع! تسجيل خروج وإتمام المهمة' : 'Arrived at site! Complete task'}</span>
                                </button>
                              ) : (
                                <button 
                                  onClick={() => handleUpdateStatus(task.id, 'in_progress')}
                                  disabled={updatingTaskId !== null}
                                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all cursor-pointer shadow-sm animate-pulse flex items-center justify-center gap-1.5 border-none disabled:opacity-50"
                                >
                                  {updatingTaskId === task.id ? (
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <MapPin className="w-4 h-4 animate-bounce" />
                                  )}
                                  <span>{language === 'ar' ? 'لقد وصلت للموقع! بدء العمل' : 'Arrived at location! Start task'}</span>
                                </button>
                              )}
                            </div>
                          )}

                          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide m-0">{language === 'ar' ? 'تغيير الحالة' : 'Change Status'}</p>
                          <div className={`flex gap-2 flex-wrap ${language === 'en' ? 'flex-row' : ''}`}>
                            {(task.status === 'new' || task.status === 'pending') && (
                              <button onClick={() => handleUpdateStatus(task.id, 'in_progress')}
                                disabled={updatingTaskId !== null}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all cursor-pointer disabled:opacity-50">
                                {updatingTaskId === task.id ? (
                                  <span className="w-3.5 h-3.5 border-2 border-amber-700 dark:border-amber-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <RefreshCcw className="w-3.5 h-3.5" />
                                )}
                                <span>{language === 'ar' ? 'بدء العمل' : 'Start Task'}</span>
                              </button>
                            )}
                            {task.status === 'in_progress' && (
                              <>
                                <button onClick={() => handleUpdateStatus(task.id, 'completed')}
                                  disabled={updatingTaskId !== null}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 transition-all cursor-pointer disabled:opacity-50">
                                  {updatingTaskId === task.id ? (
                                    <span className="w-3.5 h-3.5 border-2 border-green-700 dark:border-green-400 border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <CheckCircle className="w-3.5 h-3.5" />
                                  )}
                                  <span>{language === 'ar' ? 'اكتمل' : 'Complete'}</span>
                                </button>
                                <button onClick={() => handleUpdateStatus(task.id, 'pending')}
                                  disabled={updatingTaskId !== null}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all cursor-pointer disabled:opacity-50">
                                  {updatingTaskId === task.id ? (
                                    <span className="w-3.5 h-3.5 border-2 border-red-600 dark:border-red-400 border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <Hand className="w-3.5 h-3.5" />
                                  )}
                                  <span>{language === 'ar' ? 'تعليق' : 'Suspend'}</span>
                                </button>
                              </>
                            )}
                            <button onClick={() => openNotesModal(task)}
                              disabled={updatingTaskId !== null}
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-all cursor-pointer border-none disabled:opacity-50 ${language === 'ar' ? 'ml-auto' : 'mr-auto'}`}>
                              <Camera className="w-3.5 h-3.5" />{language === 'ar' ? 'صورة / ملاحظة' : 'Photo / Note'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-xs">
                {activeTab === 'active'
                  ? <><ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-400 text-sm">{language === 'ar' ? 'لا توجد مهام نشطة — أضف مهمتك الأولى' : 'No active tasks found'}</p></>
                  : <><CheckSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-400 text-sm">{language === 'ar' ? 'لا توجد مهام منجزة بعد' : 'No completed tasks yet'}</p></>
                }
              </div>
            )}
            </div>
          </PullToRefresh>
        </div>
      </main>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex md:hidden z-30 shadow-[0_-2px_16px_rgba(0,0,0,0.06)] safe-pb" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <button onClick={() => setActiveTab('active')}
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-all cursor-pointer border-none bg-transparent ${activeTab === 'active' ? 'text-blue-600' : 'text-slate-400'}`}>
          <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'active' ? 'bg-blue-50' : ''}`}>
            <ClipboardList className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-semibold">{language === 'ar' ? 'نشطة' : 'Active'}</span>
        </button>

        <button onClick={() => setActiveTab('completed')}
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-all cursor-pointer border-none bg-transparent ${activeTab === 'completed' ? 'text-blue-600' : 'text-slate-400'}`}>
          <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'completed' ? 'bg-blue-50' : ''}`}>
            <CheckSquare className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-semibold">{language === 'ar' ? 'المنجزة' : 'Completed'}</span>
        </button>

        <Link to="/profile"
          className="flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-all cursor-pointer border-none bg-transparent text-slate-400 decoration-none no-underline">
          <div className="w-7 h-7 rounded-full border border-slate-200 hover:border-blue-500 transition-colors flex items-center justify-center overflow-hidden bg-slate-50">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover rounded-full" />
            ) : (
              <span className="text-[11px] font-bold text-slate-600">{avatar}</span>
            )}
          </div>
          <span className="text-[10px] font-semibold text-slate-400">{language === 'ar' ? 'ملفي' : 'Profile'}</span>
        </Link>
      </nav>

      {/* ── CREATE TASK MODAL ── */}
      {isTaskFormOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-base">{language === 'ar' ? 'مهمة ميدانية جديدة' : 'New Field Task'}</h3>
              <button onClick={() => { setTaskFormOpen(false); setNewTask({ title: '', description: '', location: '', dueDate: '' }); }}
                className="p-1.5 rounded-full hover:bg-slate-100 border-none bg-transparent cursor-pointer"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleCreateTask}>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">{language === 'ar' ? 'عنوان المهمة *' : 'Task Title *'}</label>
                  <input required type="text" value={newTask.title}
                    onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 focus:bg-white transition"
                    placeholder={language === 'ar' ? 'ما هي المهمة التي ستقوم بها؟' : 'What is the task about?'} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    <MapPin className={`w-4 h-4 inline text-blue-500 ${language === 'ar' ? 'ml-1' : 'mr-1'}`} />
                    {language === 'ar' ? 'مكان الزيارة *' : 'Location *'}
                  </label>
                  <input required type="text" value={newTask.location}
                    onChange={e => setNewTask({ ...newTask, location: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 focus:bg-white transition"
                    placeholder={language === 'ar' ? 'اسم العميل أو الموقع...' : 'Client name or site location...'} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">{language === 'ar' ? 'ملاحظات (اختياري)' : 'Description (Optional)'}</label>
                  <textarea value={newTask.description}
                    onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 focus:bg-white transition resize-none"
                    rows={3} placeholder={language === 'ar' ? 'تفاصيل إضافية...' : 'Additional details...'} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">{language === 'ar' ? 'تاريخ التنفيذ' : 'Due Date'}</label>
                  <input type="date" value={newTask.dueDate}
                    onChange={e => setNewTask({ ...newTask, dueDate: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 focus:bg-white transition" />
                </div>
              </div>
              <div className="p-4 border-t border-slate-50 bg-slate-50/50 flex gap-3">
                <button type="submit" disabled={isCreating}
                  className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition disabled:opacity-50 text-sm cursor-pointer border-none">
                  {isCreating ? (language === 'ar' ? 'جاري الإنشاء...' : 'Creating...') : (language === 'ar' ? 'إنشاء المهمة' : 'Create Task')}
                </button>
                <button type="button" onClick={() => { setTaskFormOpen(false); setNewTask({ title: '', description: '', location: '', dueDate: '' }); }}
                  className="px-5 bg-white border border-slate-200 text-slate-600 font-semibold py-3 rounded-xl hover:bg-slate-50 transition text-sm cursor-pointer">
                  {t.common.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── NOTES & IMAGE MODAL ── */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <div className="bg-white w-full max-w-sm rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-sm">{language === 'ar' ? 'ملاحظات وصورة المهمة' : 'Task Notes & Image'}</h3>
              <button onClick={() => { setSelectedTask(null); setTaskNotes(''); setImageFile(null); setImagePreview(null); }}
                className="p-1.5 rounded-full hover:bg-slate-100 border-none bg-transparent cursor-pointer"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-4 overflow-y-auto space-y-4">
              <textarea className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 min-h-[120px] outline-none transition text-sm text-slate-800"
                placeholder={language === 'ar' ? 'اكتب ملاحظاتك هنا...' : 'Write notes here...'} value={taskNotes}
                onChange={e => setTaskNotes(e.target.value)} />
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">{language === 'ar' ? 'صورة من الموقع (اختياري)' : 'Site Image (Optional)'}</label>
                {imagePreview ? (
                  <div className="relative">
                    <img src={imagePreview} alt="Preview" className="w-full max-h-48 object-cover rounded-xl border border-slate-200" />
                    <button onClick={() => { setImageFile(null); setImagePreview(null); }}
                      className="absolute top-2 left-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 border-none cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={async (e) => {
                      if (Capacitor.isNativePlatform()) {
                        // Prevent the click from triggering the file input click on label if any
                        e.preventDefault();
                        try {
                          const file = await takeNativePhoto();
                          if (file) {
                            setImageFile(file);
                            const reader = new FileReader();
                            reader.onloadend = () => setImagePreview(reader.result as string);
                            reader.readAsDataURL(file);
                          }
                        } catch (err: any) {
                          toast.error(err.message || (language === 'ar' ? 'فشل تشغيل الكاميرا' : 'Failed to launch camera'));
                        }
                      }
                    }}
                    className="w-full"
                  >
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                      <ImageIcon className="w-8 h-8 text-slate-300 mb-2" />
                      <span className="text-xs font-semibold text-slate-500">{language === 'ar' ? 'اضغط لاختيار صورة' : 'Click to select photo'}</span>
                      <span className="text-[10px] text-slate-400 mt-1">{language === 'ar' ? 'أو التقط صورة من الكاميرا' : 'Or take environment photo'}</span>
                      {!Capacitor.isNativePlatform() && (
                        <input type="file" accept="image/*" capture="environment" className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setImageFile(file);
                            const reader = new FileReader();
                            reader.onloadend = () => setImagePreview(reader.result as string);
                            reader.readAsDataURL(file);
                          }} />
                      )}
                    </label>
                  </div>
                )}
                {isUploading && (
                  <div className="mt-2">
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>{statusText || (language === 'ar' ? 'جاري معالجة الصورة...' : 'Processing image...')}</span><span>{progress}%</span>
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
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition disabled:opacity-50 text-sm cursor-pointer border-none">
                {isUploading ? (statusText || (language === 'ar' ? `جاري الحفظ... ${progress}%` : `Saving... ${progress}%`)) : (language === 'ar' ? 'حفظ التغييرات' : 'Save Changes')}
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

      {/* ── PERMISSION GUIDE MODAL ── */}
      <PermissionGuideModal
        isOpen={isPermissionGuideOpen}
        onClose={() => setIsPermissionGuideOpen(false)}
        type={permissionGuideType}
        language={language}
      />

      {/* ── LEAVE & VISIT MODALS ── */}
      <LeaveRequestModal
        isOpen={isLeaveModalOpen}
        onClose={() => setLeaveModalOpen(false)}
        isOnline={isOnline}
        addToQueue={addToQueue}
      />

      <VisitModal
        isOpen={isVisitModalOpen}
        onClose={() => setVisitModalOpen(false)}
        userCoords={userCoords}
        isLocating={isLocating}
        getCoordinates={getCoordinates}
        isOnline={isOnline}
        addToQueue={addToQueue}
      />

      {/* ── IN-APP UPDATE CHECKER ALERT MODAL ── */}
      {updateInfo?.hasUpdate && (
        <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm bg-white dark:bg-slate-800 border border-blue-100 dark:border-slate-700 p-4 rounded-2xl shadow-xl z-40 flex flex-col gap-3 animate-slide-up">
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shrink-0">✨</span>
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                {language === 'ar' ? 'يتوفر إصدار جديد!' : 'New Version Available!'}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {language === 'ar' 
                  ? `يتوفر إصدار جديد من التطبيق (${updateInfo.latestTag}). قم بالتحديث الآن للاستفادة من أحدث التحسينات.` 
                  : `A new version of the app is available (${updateInfo.latestTag}). Update now to get the latest improvements.`}
              </p>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button 
              onClick={() => openExternalUrl(updateInfo.downloadUrl)}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold border-none cursor-pointer"
            >
              {language === 'ar' ? 'تحديث الآن' : 'Update Now'}
            </button>
            <button 
              onClick={() => setUpdateInfo(null)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold border-none cursor-pointer"
            >
              {language === 'ar' ? 'لاحقاً' : 'Later'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
