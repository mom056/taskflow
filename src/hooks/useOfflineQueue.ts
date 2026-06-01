import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export interface QueueItem {
  id: string;
  type: 'create_task' | 'update_status' | 'update_notes';
  taskId?: string;
  payload: any;
}

const STORAGE_KEY = 'taskflow_offline_queue';

export function useOfflineQueue(onSyncSuccess?: () => void) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queue, setQueue] = useState<QueueItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('تم استعادة الاتصال بالإنترنت! جاري المزامنة...');
      syncQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.error('أنت تعمل الآن دون اتصال بالإنترنت. سيتم حفظ التعديلات محلياً.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [queue]);

  // Sync queue with server
  const syncQueue = useCallback(async () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const items: QueueItem[] = saved ? JSON.parse(saved) : [];
    if (items.length === 0) return;

    console.log(`[OfflineQueue] Starting synchronization of ${items.length} actions...`);
    let successCount = 0;
    const remainingItems: QueueItem[] = [];

    for (const item of items) {
      try {
        if (item.type === 'create_task') {
          const { error } = await supabase.from('tasks').insert([item.payload]);
          if (error) throw error;
        } else if (item.type === 'update_status') {
          const { error } = await supabase
            .from('tasks')
            .update({ status: item.payload.status, updated_at: Date.now() })
            .eq('id', item.taskId);
          if (error) throw error;
        } else if (item.type === 'update_notes') {
          let imageUrl = item.payload.imageUrl;
          
          // If the image is stored as base64 data URL, upload it to storage first
          if (imageUrl && imageUrl.startsWith('data:image/')) {
            try {
              const response = await fetch(imageUrl);
              const blob = await response.blob();
              const file = new File([blob], `offline_upload_${Date.now()}.jpg`, { type: 'image/jpeg' });
              
              const ext = 'jpg';
              const filePath = `task-images/${item.taskId}/${Date.now()}.${ext}`;
              
              const { error: uploadError } = await supabase.storage
                .from('task-images')
                .upload(filePath, file, { upsert: true, contentType: 'image/jpeg' });
                
              if (uploadError) throw uploadError;
              
              const { data } = supabase.storage
                .from('task-images')
                .getPublicUrl(filePath);
                
              imageUrl = data.publicUrl;
            } catch (imgErr) {
              console.error('[OfflineQueue] Image upload failed during sync:', imgErr);
              throw imgErr;
            }
          }

          const { error } = await supabase
            .from('tasks')
            .update({ 
              notes: item.payload.notes, 
              image_url: imageUrl, 
              updated_at: Date.now() 
            })
            .eq('id', item.taskId);
          if (error) throw error;
        }
        successCount++;
      } catch (err: any) {
        console.error(`[OfflineQueue] Sync failed for item ${item.id}:`, err);
        // Keep it in the queue to try again later
        remainingItems.push(item);
      }
    }

    // Update state and storage
    setQueue(remainingItems);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remainingItems));

    if (successCount > 0) {
      toast.success(`تمت مزامنة ${successCount} من التعديلات بنجاح ✓`);
      if (onSyncSuccess) {
        onSyncSuccess();
      }
    }
  }, [onSyncSuccess]);

  // Try to sync on mount if online
  useEffect(() => {
    if (isOnline && queue.length > 0) {
      syncQueue();
    }
  }, [isOnline]);

  const addToQueue = useCallback((type: QueueItem['type'], payload: any, taskId?: string) => {
    const newItem: QueueItem = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      taskId,
      payload
    };

    const updatedQueue = [...queue, newItem];
    setQueue(updatedQueue);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedQueue));
    
    // Notify user of local save
    toast.success('تم الحفظ محلياً مؤقتاً في انتظار الشبكة');
  }, [queue]);

  return {
    isOnline,
    queueLength: queue.length,
    addToQueue,
    syncQueue
  };
}
