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

    const tasks = (data ?? []).map(d => ({
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
      companyId: d.company_id,
      latitude: d.latitude,
      longitude: d.longitude,
      locationVerifiedAt: d.location_verified_at,
      startLatitude: d.start_latitude,
      startLongitude: d.start_longitude,
      startLocationVerifiedAt: d.start_location_verified_at,
      targetLatitude: d.target_latitude,
      targetLongitude: d.target_longitude
    })) as Task[];

    // Batch resolve signed URLs for task images in private storage
    const tasksWithImages = tasks.filter(t => t.imageUrl && t.imageUrl.includes('/public/task-images/'));
    if (tasksWithImages.length > 0) {
      const pathsMap = tasksWithImages.map(t => {
        const url = t.imageUrl!;
        const marker = '/public/task-images/';
        const index = url.indexOf(marker);
        const path = index !== -1 ? url.substring(index + marker.length) : '';
        return { task: t, path };
      }).filter(item => item.path !== '');

      if (pathsMap.length > 0) {
        try {
          const paths = pathsMap.map(item => item.path);
          const { data: signedUrls, error: signedError } = await supabase.storage
            .from('task-images')
            .createSignedUrls(paths, 3600);

          if (signedError) {
            console.error('[useTasks] Error generating signed URLs:', signedError.message);
          } else if (signedUrls) {
            const urlByPath = new Map(signedUrls.map(s => [s.path, s.signedUrl]));
            pathsMap.forEach(item => {
              const signed = urlByPath.get(item.path);
              if (signed) {
                item.task.imageUrl = signed;
              }
            });
          }
        } catch (storageErr) {
          console.error('[useTasks] Storage signed URLs fetch failed:', storageErr);
        }
      }
    }

    return tasks;
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
