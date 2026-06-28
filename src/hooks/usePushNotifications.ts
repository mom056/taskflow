import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Capacitor } from '@capacitor/core';
import { registerNativePushToken } from '../lib/nativeServices';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

// Helper to convert base64 VAPID key to Uint8Array for browser subscription
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Safe check for web Notification API availability
function getWebNotificationPermission(): NotificationPermission {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    return Notification.permission;
  }
  return 'default';
}

export function usePushNotifications(userId?: string) {
  const { profile } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>(
    getWebNotificationPermission()
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Check if browser is already subscribed (web only)
  const checkSubscription = useCallback(async () => {
    // Skip on native platforms — native push uses FCM/APNS, not Web Push
    if (Capacitor.isNativePlatform()) {
      setIsChecking(false);
      return;
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !userId) {
      setIsChecking(false);
      return;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    } catch (err) {
      console.error('[PushNotifications] Failed to check subscription status:', err);
    } finally {
      setIsChecking(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setIsChecking(false);
      return;
    }

    const initCheck = async () => {
      setIsChecking(true);
      try {
        if (Capacitor.isNativePlatform()) {
          const { PushNotifications } = await import('@capacitor/push-notifications');
          const perm = await PushNotifications.checkPermissions();
          if (perm.receive === 'granted') {
            setIsSubscribed(true);
          } else {
            setIsSubscribed(false);
          }
        } else {
          await checkSubscription();
        }
      } catch (err) {
        console.error('[PushNotifications] Failed to check subscription status:', err);
      } finally {
        setIsChecking(false);
      }
    };

    initCheck();
  }, [userId, checkSubscription]);

  // Background registration once profile and permissions are ready
  useEffect(() => {
    if (!userId || !profile?.company_id || !Capacitor.isNativePlatform()) return;

    const runBackgroundRegistration = async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const perm = await PushNotifications.checkPermissions();
        if (perm.receive === 'granted') {
          await registerNativePushToken(userId, profile.company_id);
          setIsSubscribed(true);
        }
      } catch (err) {
        console.warn('[PushNotifications] Background native push registration failed:', err);
      }
    };

    runBackgroundRegistration();
  }, [userId, profile?.company_id]);

  const subscribeUser = useCallback(async () => {
    if (!userId) return;

    // Native: use FCM/APNS via nativeServices
    if (Capacitor.isNativePlatform()) {
      setLoading(true);
      try {
        if (profile?.company_id) {
          await registerNativePushToken(userId, profile.company_id);
          setIsSubscribed(true);
        }
        return true;
      } catch (err) {
        console.error('[PushNotifications] Native subscribe failed:', err);
        throw err;
      } finally {
        setLoading(false);
      }
    }

    // Web: use Web Push API
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error('متصفحك لا يدعم الإشعارات الفورية (Push Notifications)');
    }

    setLoading(true);
    try {
      // 1. Request permission
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== 'granted') {
        throw new Error('تم رفض صلاحية الإشعارات الفورية');
      }

      // 2. Get active service worker registration
      const reg = await navigator.serviceWorker.ready;

      // 3. Subscribe to push manager
      const subscribeOptions = {
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      };

      const subscription = await reg.pushManager.subscribe(subscribeOptions);
      
      const subJSON = subscription.toJSON();
      const endpoint = subJSON.endpoint;
      const p256dh = subJSON.keys?.p256dh;
      const auth = subJSON.keys?.auth;

      if (!endpoint || !p256dh || !auth) {
        throw new Error('تعذر إنشاء اشتراك إشعارات كامل');
      }

      // 4. Save to Supabase database (upsert based on endpoint)
      const { error } = await supabase.from('push_subscriptions').upsert([
        {
          user_id: userId,
          endpoint,
          p256dh,
          auth,
          company_id: profile?.company_id,
          created_at: Date.now(),
        }
      ], { onConflict: 'endpoint' });

      if (error) throw error;

      setIsSubscribed(true);
      return true;
    } catch (err: any) {
      console.error('[PushNotifications] Subscription failed:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId, profile?.company_id]);

  return {
    permission,
    isSubscribed,
    subscribeUser,
    loading,
    isChecking,
  };
}
