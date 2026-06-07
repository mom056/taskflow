import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';

// Helper to open external links safely (resolves external links opening inside WebView issue)
export async function openExternalUrl(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

// Helper to get GPS coordinates reliably on mobile vs web
export async function getNativeLocation(): Promise<{ latitude: number; longitude: number }> {
  if (Capacitor.isNativePlatform()) {
    const { Geolocation } = await import('@capacitor/geolocation');
    
    // Check permission status
    const permission = await Geolocation.checkPermissions();
    if (permission.location !== 'granted') {
      const request = await Geolocation.requestPermissions();
      if (request.location !== 'granted') {
        throw new Error('يرجى تفعيل صلاحية تحديد الموقع (GPS) للمتابعة');
      }
    }

    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });
    
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude
    };
  } else {
    // Fallback to web browser Geolocation API
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('متصفحك أو جهازك لا يدعم تحديد الموقع الجغرافي (GPS)'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err) => {
          let errMsg = 'فشل في التقاط موقعك الجغرافي';
          if (err.code === err.PERMISSION_DENIED) {
            errMsg = 'يرجى تفعيل صلاحية تحديد الموقع (GPS) في متصفحك وهاتفك للمتابعة';
          }
          reject(new Error(errMsg));
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }
}

// Helper to take a native photo and return a File object compatible with supabase uploads
export async function takeNativePhoto(): Promise<File | null> {
  if (Capacitor.isNativePlatform()) {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
    
    // Request permission if not granted
    const permission = await Camera.checkPermissions();
    if (permission.camera !== 'granted') {
      const request = await Camera.requestPermissions();
      if (request.camera !== 'granted') {
        throw new Error('يرجى تفعيل صلاحية الكاميرا لالتقاط صورة للمهمة');
      }
    }

    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.Uri, // Use Uri to avoid base64 memory overhead
      source: CameraSource.Camera
    });

    if (!photo.webPath) {
      throw new Error('فشل التقاط مسار الصورة');
    }

    // Convert webPath back to a blob then to a File object
    const response = await fetch(photo.webPath);
    const blob = await response.blob();
    return new File([blob], `native_photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
  }
  return null; // Web fallback uses traditional input type="file"
}

// Helper to register native push tokens (FCM/APNS) and save to database
export async function registerNativePushToken(userId: string, companyId: string): Promise<void> {
  if (!Capacitor.isNativePlatform() || !userId) return;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive !== 'granted') {
      perm = await PushNotifications.requestPermissions();
    }

    if (perm.receive === 'granted') {
      await PushNotifications.register();

      // Clear existing listeners to prevent duplicates
      await PushNotifications.removeAllListeners();

      await PushNotifications.addListener('registration', async (token) => {
        console.log('[NativePush] Device registered successfully. Token:', token.value);
        
        // Save the device token to public.push_subscriptions
        const { error } = await supabase.from('push_subscriptions').upsert([
          {
            user_id: userId,
            device_token: token.value,
            company_id: companyId,
            created_at: Date.now()
          }
        ], { onConflict: 'device_token' }); // Create unique constraint or upsert based on user_id/device_token later

        if (error) {
          console.error('[NativePush] Failed to save token to database:', error.message);
        }
      });

      await PushNotifications.addListener('registrationError', (err) => {
        console.error('[NativePush] Registration error:', err.error);
      });
    }
  } catch (err) {
    console.error('[NativePush] Failed setup:', err);
  }
}
