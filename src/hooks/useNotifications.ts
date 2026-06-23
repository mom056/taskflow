import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string | null;
  isRead: boolean;
  link: string | null;
  companyId: string;
  createdAt: number;
}

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const fetchNotifications = async () => {
    if (!user) return [];

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[useNotifications] Fetch error:', error);
      throw error;
    }

    return (data ?? []).map(d => ({
      id: d.id,
      userId: d.user_id,
      title: d.title,
      body: d.body,
      isRead: d.is_read,
      link: d.link,
      companyId: d.company_id,
      createdAt: d.created_at,
    })) as Notification[];
  };

  const query = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: fetchNotifications,
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  // Realtime subscription setup
  useEffect(() => {
    if (!user?.id) return;

    // Use a unique channel name per mount cycle to avoid conflicts with stale channels
    const channelName = `notifications_${user.id}_${Math.random().toString(36).substring(2, 15)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.warn('[useNotifications] Realtime subscription error (non-fatal):', err.message);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // Mutations
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    },
  });

  return {
    notifications: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    unreadCount: (query.data ?? []).filter(n => !n.isRead).length,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
    deleteNotification: deleteMutation.mutate,
    refetch: query.refetch,
  };
}
