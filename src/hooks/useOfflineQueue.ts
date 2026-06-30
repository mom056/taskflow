import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Preferences } from '@capacitor/preferences';
import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';

export interface QueueItem {
  id: string;
  type: 'create_task' | 'update_status' | 'update_notes';
  taskId?: string;
  payload: any;
}

const STORAGE_KEY = 'taskflow_offline_queue';

export function useOfflineQueue(onSyncSuccess?: () => void) {
  const [isOnline, setIsOnline] = useState(true);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const wasConnectedRef = useRef<boolean | null>(null);

  // Load queue from storage on init
  useEffect(() => {
    async function loadQueue() {
      if (Capacitor.isNativePlatform()) {
        const { value } = await Preferences.get({ key: STORAGE_KEY });
        setQueue(value ? JSON.parse(value) : []);
      } else {
        const saved = localStorage.getItem(STORAGE_KEY);
        setQueue(saved ? JSON.parse(saved) : []);
      }
    }
    loadQueue();
  }, []);

  // Sync helper
  const saveQueue = async (updatedQueue: QueueItem[]) => {
    setQueue(updatedQueue);
    if (Capacitor.isNativePlatform()) {
      await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(updatedQueue) });
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedQueue));
    }
  };

  // Sync queue with server
  const syncQueue = useCallback(async () => {
    let saved: string | null = null;
    if (Capacitor.isNativePlatform()) {
      const res = await Preferences.get({ key: STORAGE_KEY });
      saved = res.value;
    } else {
      saved = localStorage.getItem(STORAGE_KEY);
    }
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
          const updatePayload: any = {
            status: item.payload.status,
            updated_at: Date.now()
          };
          
          if (item.payload.latitude !== undefined) updatePayload.latitude = item.payload.latitude;
          if (item.payload.longitude !== undefined) updatePayload.longitude = item.payload.longitude;
          if (item.payload.location_verified_at !== undefined) updatePayload.location_verified_at = item.payload.location_verified_at;
          
          if (item.payload.start_latitude !== undefined) updatePayload.start_latitude = item.payload.start_latitude;
          if (item.payload.start_longitude !== undefined) updatePayload.start_longitude = item.payload.start_longitude;
          if (item.payload.start_location_verified_at !== undefined) updatePayload.start_location_verified_at = item.payload.start_location_verified_at;

          const { error } = await supabase
            .from('tasks')
            .update(updatePayload)
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
        remainingItems.push(item);
      }
    }

    // Update state and storage
    await saveQueue(remainingItems);

    if (successCount > 0) {
      toast.success(`تمت مزامنة ${successCount} من التعديلات بنجاح ✓`);
      if (onSyncSuccess) {
        onSyncSuccess();
      }
    }
  }, [onSyncSuccess]);

  // Track online/offline status using @capacitor/network
  useEffect(() => {
    let networkListener: any = null;
    let isMounted = true;

    async function initNetwork() {
      if (Capacitor.isNativePlatform()) {
        try {
          const status = await Network.getStatus();
          if (isMounted) {
            setIsOnline(status.connected);
            wasConnectedRef.current = status.connected;
          }

          networkListener = await Network.addListener('networkStatusChange', (status) => {
            if (!isMounted) return;
            if (wasConnectedRef.current !== status.connected) {
              wasConnectedRef.current = status.connected;
              setIsOnline(status.connected);
              if (status.connected) {
                toast.success('تم استعادة الاتصال بالإنترنت! جاري المزامنة...');
                syncQueue();
              } else {
                toast.error('أنت تعمل الآن دون اتصال بالإنترنت. سيتم حفظ التعديلات محلياً.');
              }
            }
          });
        } catch (e) {
          console.warn('[OfflineQueue] Native network plugin failed, using fallback', e);
        }
      } else {
        // Fallback for Web browser init
        if (isMounted) {
          const online = navigator.onLine;
          setIsOnline(online);
          wasConnectedRef.current = online;
        }
      }

      // Fallback for Web browser
      const handleOnline = () => {
        if (isMounted && wasConnectedRef.current !== true) {
          wasConnectedRef.current = true;
          setIsOnline(true);
          toast.success('تم استعادة الاتصال بالإنترنت! جاري المزامنة...');
          syncQueue();
        }
      };
      const handleOffline = () => {
        if (isMounted && wasConnectedRef.current !== false) {
          wasConnectedRef.current = false;
          setIsOnline(false);
          toast.error('أنت تعمل الآن دون اتصال بالإنترنت. سيتم حفظ التعديلات محلياً.');
        }
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    const cleanupsPromise = initNetwork();

    return () => {
      isMounted = false;
      cleanupsPromise.then((webCleanup) => {
        if (webCleanup) webCleanup();
      });
      if (networkListener) {
        networkListener.remove();
      }
    };
  }, [syncQueue]);

  // Try to sync on mount/network change if online
  useEffect(() => {
    if (isOnline && queue.length > 0) {
      syncQueue();
    }
  }, [isOnline, queue.length, syncQueue]);

  const addToQueue = useCallback(async (type: QueueItem['type'], payload: any, taskId?: string) => {
    const newItem: QueueItem = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      taskId,
      payload
    };

    setQueue((prevQueue) => {
      const updatedQueue = [...prevQueue, newItem];
      saveQueue(updatedQueue);
      return updatedQueue;
    });
    
    // Notify user of local save
    toast.success('تم الحفظ محلياً مؤقتاً في انتظار الشبكة');
  }, []);

  return {
    isOnline,
    queue,
    queueLength: queue.length,
    addToQueue,
    syncQueue
  };
}
