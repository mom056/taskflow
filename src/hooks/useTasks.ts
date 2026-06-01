import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Task } from '../types';

export function useTasks(employeeId?: string) {
  const fetchTasks = async () => {
    let query = supabase.from('tasks').select('*');

    if (employeeId) {
      query = query.eq('employee_id', employeeId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('[useTasks] Fetch error:', error.code, error.message, '| employeeId:', employeeId);
      throw error;
    }

    console.debug('[useTasks] Fetched', data?.length ?? 0, 'tasks for employeeId:', employeeId ?? 'ALL');

    return (data ?? []).map(d => ({
      id: d.id,
      title: d.title,
      description: d.description,
      status: d.status,
      location: d.location,
      notes: d.notes,
      dueDate: d.due_date,
      imageUrl: d.image_url,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
      employeeId: d.employee_id,
      createdBy: d.created_by,
      latitude: d.latitude,
      longitude: d.longitude,
      locationVerifiedAt: d.location_verified_at
    })) as Task[];
  };

  const tasksQuery = useQuery({
    queryKey: ['tasks', employeeId ?? 'all'],
    queryFn: fetchTasks,
    // Don't fetch for employee view until we have their ID
    enabled: employeeId !== undefined ? employeeId.length > 0 : true,
    retry: 1,
    staleTime: 30_000,
  });

  return {
    tasks: tasksQuery.data ?? [],
    isLoading: tasksQuery.isLoading,
    isError: tasksQuery.isError,
    error: tasksQuery.error,
    refetch: tasksQuery.refetch,
  };
}
