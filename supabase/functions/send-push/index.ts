// Deno Edge Function for sending Push Notifications (Web Push + FCM for Native)
// Triggered by Supabase Database Webhook on task INSERT
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import * as webpush from "jsr:@negrel/webpush"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Web Push (VAPID) credentials
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:info@taskflow.com';

// Firebase Cloud Messaging (FCM) credentials for native push
// This is the FCM Server Key from Firebase Console > Project Settings > Cloud Messaging
const FCM_SERVER_KEY = Deno.env.get('FCM_SERVER_KEY') || '';

// Initialize Supabase admin client
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Setup VAPID keys for Web Push (if provided)
let appServer: any = null;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    await webpush.importVapidKeys({
      publicKey: VAPID_PUBLIC_KEY,
      privateKey: VAPID_PRIVATE_KEY,
    });
    appServer = new webpush.ApplicationServer({
      subject: VAPID_SUBJECT,
    });
    console.log('[PushService] VAPID keys imported successfully.');
  } catch (err) {
    console.error('[PushService] Error importing VAPID keys:', err);
  }
}

// ─── Send FCM push notification to a native device ───
async function sendFcmNotification(deviceToken: string, title: string, body: string): Promise<{ success: boolean; error?: string }> {
  if (!FCM_SERVER_KEY) {
    return { success: false, error: 'FCM_SERVER_KEY not configured' };
  }

  try {
    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `key=${FCM_SERVER_KEY}`,
      },
      body: JSON.stringify({
        to: deviceToken,
        notification: {
          title,
          body,
          sound: 'default',
          click_action: 'FCM_PLUGIN_ACTIVITY',
        },
        data: {
          title,
          body,
          type: 'new_task',
        },
        // High priority ensures delivery even when app is in background/closed
        priority: 'high',
      }),
    });

    const result = await response.json();

    if (result.success === 1) {
      return { success: true };
    }

    // If token is invalid/expired, report it
    if (result.results?.[0]?.error === 'NotRegistered' || result.results?.[0]?.error === 'InvalidRegistration') {
      return { success: false, error: 'TOKEN_EXPIRED' };
    }

    return { success: false, error: result.results?.[0]?.error || 'Unknown FCM error' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Send Web Push notification to a browser ───
async function sendWebPushNotification(sub: any, payload: string): Promise<{ success: boolean; error?: string }> {
  if (!appServer) {
    return { success: false, error: 'VAPID not configured' };
  }

  try {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
    };
    await appServer.sendNotification(pushSubscription, payload);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message, statusCode: err.statusCode };
  }
}

serve(async (req) => {
  // Database webhook payload:
  // { type: 'INSERT', table: 'tasks', record: { id, title, employee_id, ... }, schema: 'public' }
  try {
    const payload = await req.json();
    console.log('[PushService] Received webhook:', JSON.stringify(payload).substring(0, 200));

    if (payload.type !== 'INSERT' || payload.table !== 'tasks') {
      return new Response(JSON.stringify({ message: 'Ignored: not a task INSERT' }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    const task = payload.record;
    const employeeId = task.employee_id;

    if (!employeeId) {
      return new Response(JSON.stringify({ message: 'No employee assigned' }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Fetch ALL push subscriptions for this employee (web + native devices)
    const { data: subscriptions, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', employeeId);

    if (error) throw error;

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`[PushService] No subscriptions for employee ${employeeId}`);
      return new Response(JSON.stringify({ message: 'No subscriptions found' }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    const title = '📋 مهمة جديدة!';
    const body = `تم تعيين مهمة لك: ${task.title}`;
    const webPayload = JSON.stringify({ title, body, url: '/' });

    console.log(`[PushService] Sending to ${subscriptions.length} device(s)...`);

    // Send to all devices (native + web)
    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        // Native device (has device_token, no endpoint)
        if (sub.device_token) {
          const result = await sendFcmNotification(sub.device_token, title, body);
          console.log(`[PushService] FCM [${sub.device_token.substring(0, 20)}...]: ${result.success ? 'OK' : result.error}`);

          // Remove expired/invalid tokens
          if (result.error === 'TOKEN_EXPIRED') {
            console.log(`[PushService] Removing expired FCM token: ${sub.id}`);
            await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
          }

          return { type: 'fcm', ...result };
        }

        // Web browser (has endpoint + p256dh + auth)
        if (sub.endpoint) {
          const result = await sendWebPushNotification(sub, webPayload);
          console.log(`[PushService] WebPush [${sub.endpoint.substring(0, 40)}...]: ${result.success ? 'OK' : result.error}`);

          // Remove expired web subscriptions
          if ((result as any).statusCode === 410 || (result as any).statusCode === 404) {
            console.log(`[PushService] Removing expired web sub: ${sub.id}`);
            await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
          }

          return { type: 'webpush', ...result };
        }

        return { type: 'unknown', success: false, error: 'No token or endpoint' };
      })
    );

    const sent = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return new Response(JSON.stringify({ message: `Sent: ${sent}, Failed: ${failed}`, results }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    console.error('[PushService] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
