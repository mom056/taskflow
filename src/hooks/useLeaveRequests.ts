import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { LeaveRequest } from '../types';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export function useLeaveRequests(employeeId?: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const fetchLeaveRequests = async () => {
    let query = supabase.from('leave_requests').select('*, users(name, email)');
    if (employeeId) {
      query = query.eq('employee_id', employeeId);
    }
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(d => {
      const u = Array.isArray(d.users) ? d.users[0] : d.users;
      return {
        id: d.id,
        employeeId: d.employee_id,
        companyId: d.company_id,
        type: d.type,
        reason: d.reason,
        startDate: d.start_date,
        endDate: d.end_date ? Number(d.end_date) : undefined,
        status: d.status,
        reviewedBy: d.reviewed_by,
        reviewedAt: d.reviewed_at ? Number(d.reviewed_at) : undefined,
        reviewNote: d.review_note,
        createdAt: d.created_at,
        employeeName: u?.name,
        employeeEmail: u?.email
      };
    }) as LeaveRequest[];
  };

  const leaveRequestsQuery = useQuery({
    queryKey: ['leave_requests', employeeId || 'all'],
    queryFn: fetchLeaveRequests,
    enabled: !!profile?.company_id,
  });

  const createRequestMutation = useMutation({
    mutationFn: async (payload: { type: LeaveRequest['type']; reason: string; startDate: number; endDate?: number }) => {
      const timestamp = Date.now();
      const { error } = await supabase.from('leave_requests').insert([{
        employee_id: profile?.id,
        company_id: profile?.company_id,
        type: payload.type,
        reason: payload.reason,
        start_date: payload.startDate,
        end_date: payload.endDate || null,
        status: 'pending',
        created_at: timestamp
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave_requests'] });
      toast.success('تم تقديم طلب الإذن بنجاح وننتظر موافقة الإدارة ✓');
    },
    onError: (err: any) => {
      toast.error(err.message || 'فشل تقديم طلب الإذن');
    }
  });

  const reviewRequestMutation = useMutation({
    mutationFn: async (payload: { id: string; status: 'approved' | 'rejected'; reviewNote?: string }) => {
      const timestamp = Date.now();
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: payload.status,
          reviewed_by: profile?.id,
          reviewed_at: timestamp,
          review_note: payload.reviewNote || null
        })
        .eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leave_requests'] });
      toast.success(variables.status === 'approved' ? 'تم قبول طلب الإذن بنجاح ✓' : 'تم رفض طلب الإذن');
    },
    onError: (err: any) => {
      toast.error(err.message || 'فشل معالجة طلب الإذن');
    }
  });

  return {
    requests: leaveRequestsQuery.data || [],
    isLoading: leaveRequestsQuery.isLoading,
    isError: leaveRequestsQuery.isError,
    error: leaveRequestsQuery.error,
    createRequest: createRequestMutation.mutateAsync,
    isCreating: createRequestMutation.isPending,
    reviewRequest: reviewRequestMutation.mutateAsync,
    isReviewing: reviewRequestMutation.isPending
  };
}
