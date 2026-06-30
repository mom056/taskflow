import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Visit } from '../types';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export function useVisits() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const fetchVisits = async () => {
    const { data, error } = await supabase
      .from('visits')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    return data.map(d => ({
       id: d.id,
       location: d.location,
       notes: d.notes,
       employeeId: d.employee_id,
       companyId: d.company_id,
       createdAt: d.created_at,
       latitude: d.latitude ? Number(d.latitude) : undefined,
       longitude: d.longitude ? Number(d.longitude) : undefined,
       clientName: d.client_name,
       visitType: d.visit_type,
       imageUrl: d.image_url,
       durationMinutes: d.duration_minutes,
       checkInTime: d.check_in_time ? Number(d.check_in_time) : undefined,
       checkOutTime: d.check_out_time ? Number(d.check_out_time) : undefined
     })) as Visit[];
  };

  const visitsQuery = useQuery({
    queryKey: ['visits'],
    queryFn: fetchVisits,
  });

  const createVisitMutation = useMutation({
    mutationFn: async (payload: {
      location: string;
      notes?: string;
      clientName?: string;
      latitude?: number;
      longitude?: number;
      imageUrl?: string;
      durationMinutes?: number;
      checkInTime?: number;
      checkOutTime?: number;
    }) => {
      const timestamp = Date.now();
      const { error } = await supabase.from('visits').insert([{
        location: payload.location,
        notes: payload.notes || null,
        client_name: payload.clientName || null,
        employee_id: profile?.id,
        company_id: profile?.company_id,
        latitude: payload.latitude || null,
        longitude: payload.longitude || null,
        image_url: payload.imageUrl || null,
        duration_minutes: payload.durationMinutes || null,
        check_in_time: payload.checkInTime || null,
        check_out_time: payload.checkOutTime || null,
        created_at: timestamp
      }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      toast.success('تم تسجيل الزيارة الميدانية بنجاح ✓');
    },
    onError: (err: any) => {
      toast.error(err.message || 'فشل تسجيل الزيارة');
    }
  });

  return {
    visits: visitsQuery.data || [],
    isLoading: visitsQuery.isLoading,
    isError: visitsQuery.isError,
    error: visitsQuery.error,
    createVisit: createVisitMutation.mutateAsync,
    isCreating: createVisitMutation.isPending
  };
}
