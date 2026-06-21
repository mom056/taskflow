import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface ActivityLog {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: any;
  companyId: string;
  createdAt: number;
  actorName?: string;
}

export function useActivityLog(fetchLogs: boolean = true) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: activities = [], isLoading, error } = useQuery<ActivityLog[]>({
    queryKey: ['activity_log'],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      const { data, error } = await supabase
        .from('activity_log')
        .select('*, actor:users(name)')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      return (data || []).map(row => ({
        id: row.id,
        actorId: row.actor_id,
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        metadata: row.metadata,
        companyId: row.company_id,
        createdAt: row.created_at,
        actorName: row.actor?.name || 'مستخدم غير معروف'
      }));
    },
    enabled: fetchLogs && !!profile?.company_id,
  });

  const logMutation = useMutation({
    mutationFn: async (payload: { action: string; targetType?: string; targetId?: string; metadata?: any }) => {
      if (!user || !profile?.company_id) return;

      const { error } = await supabase
        .from('activity_log')
        .insert([{
          actor_id: user.id,
          action: payload.action,
          target_type: payload.targetType || null,
          target_id: payload.targetId || null,
          metadata: payload.metadata || {},
          company_id: profile.company_id,
          created_at: Date.now()
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity_log'] });
    }
  });

  const logActivity = (action: string, targetType?: string, targetId?: string, metadata?: any) => {
    logMutation.mutate({ action, targetType, targetId, metadata });
  };

  return { activities, isLoading, error, logActivity };
}
