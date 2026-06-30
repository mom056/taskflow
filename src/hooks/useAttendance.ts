import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Attendance } from '../types';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export function useAttendance(employeeId?: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const fetchAttendance = async () => {
    let query = supabase.from('attendance').select('*, users(name, email)');
    if (employeeId) {
      query = query.eq('employee_id', employeeId);
    }
    query = query.order('check_in_time', { ascending: false });
    
    const { data, error } = await query;
    if (error) throw error;
    
    return (data || []).map(d => {
      const u = Array.isArray(d.users) ? d.users[0] : d.users;
      return {
        id: d.id,
        employeeId: d.employee_id,
        companyId: d.company_id,
        checkInTime: d.check_in_time,
        checkInLat: d.check_in_lat ? Number(d.check_in_lat) : undefined,
        checkInLng: d.check_in_lng ? Number(d.check_in_lng) : undefined,
        checkInType: d.check_in_type,
        checkOutTime: d.check_out_time ? Number(d.check_out_time) : undefined,
        checkOutLat: d.check_out_lat ? Number(d.check_out_lat) : undefined,
        checkOutLng: d.check_out_lng ? Number(d.check_out_lng) : undefined,
        totalHours: d.total_hours ? Number(d.total_hours) : undefined,
        notes: d.notes,
        isLate: d.is_late,
        createdAt: d.created_at,
        employeeName: u?.name,
        employeeEmail: u?.email
      };
    }) as Attendance[];
  };

  const attendanceQuery = useQuery({
    queryKey: ['attendance', employeeId || 'all'],
    queryFn: fetchAttendance,
    enabled: !!profile?.company_id,
  });

  const checkInMutation = useMutation({
    mutationFn: async (payload: { latitude?: number; longitude?: number; type: 'office' | 'field'; notes?: string }) => {
      const timestamp = Date.now();
      const { error } = await supabase.from('attendance').insert([{
        employee_id: profile?.id,
        company_id: profile?.company_id,
        check_in_time: timestamp,
        check_in_lat: payload.latitude,
        check_in_lng: payload.longitude,
        check_in_type: payload.type,
        notes: payload.notes,
        created_at: timestamp
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('تم تسجيل الحضور بنجاح ⏰');
    },
    onError: (err: any) => {
      toast.error(err.message || 'فشل تسجيل الحضور');
    }
  });

  const checkOutMutation = useMutation({
    mutationFn: async (payload: { id: string; latitude?: number; longitude?: number }) => {
      const timestamp = Date.now();
      const { error } = await supabase
        .from('attendance')
        .update({
          check_out_time: timestamp,
          check_out_lat: payload.latitude,
          check_out_lng: payload.longitude
        })
        .eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('تم تسجيل الانصراف بنجاح 👋');
    },
    onError: (err: any) => {
      toast.error(err.message || 'فشل تسجيل الانصراف');
    }
  });

  // Helper to find today's active attendance (where checkOutTime is null)
  const todayActiveRecord = attendanceQuery.data?.find(r => {
    const checkInDate = new Date(r.checkInTime).toDateString();
    const todayDate = new Date().toDateString();
    return checkInDate === todayDate && !r.checkOutTime;
  });

  return {
    records: attendanceQuery.data || [],
    isLoading: attendanceQuery.isLoading,
    isError: attendanceQuery.isError,
    error: attendanceQuery.error,
    checkIn: checkInMutation.mutateAsync,
    isCheckingIn: checkInMutation.isPending,
    checkOut: checkOutMutation.mutateAsync,
    isCheckingOut: checkOutMutation.isPending,
    activeRecord: todayActiveRecord
  };
}
