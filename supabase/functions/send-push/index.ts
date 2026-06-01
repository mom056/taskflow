// Deno Edge Function for sending Web Push Notifications via Supabase Database Webhooks
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import * as webpush from "jsr:@negrel/webpush"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:info@taskflow.com';

// Initialize Supabase admin client
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Setup VAPID keys if provided
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

serve(async (req) => {
  // Database webhook payload structure:
  // {
  //   type: 'INSERT',
  //   table: 'tasks',
  //   record: { id: '...', title: '...', employee_id: '...' },
  //   schema: 'public'
  // }
  try {
    const payload = await req.json();
    console.log('[PushService] Received webhook payload:', payload);

    if (payload.type !== 'INSERT' || payload.table !== 'tasks') {
      return new Response(JSON.stringify({ message: 'Ignored non-insert task event' }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    const task = payload.record;
    const employeeId = task.employee_id;

    if (!employeeId) {
      return new Response(JSON.stringify({ message: 'No employee assigned to this task' }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 1. Fetch employee's subscriptions
    const { data: subscriptions, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', employeeId);

    if (error) throw error;

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`[PushService] No subscriptions found for employee ${employeeId}`);
      return new Response(JSON.stringify({ message: 'No subscriptions found' }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (!appServer) {
      console.error('[PushService] ApplicationServer is not configured (missing VAPID keys)');
      return new Response(JSON.stringify({ error: 'Push service not configured' }), {
        headers: { "Content-Type": "application/json" },
        status: 500,
      });
    }

    // 2. Prepare notification payload
    const notificationPayload = JSON.stringify({
      title: '📋 مهمة ميدانية جديدة!',
      body: `لقد تم تعيين مهمة جديدة لك: ${task.title}. يرجى مراجعة التفاصيل.`,
      url: `/` // Redirects to app root (Employee dashboard)
    });

    console.log(`[PushService] Sending notification to ${subscriptions.length} subscription(s)...`);

    // 3. Send Web Push to all devices
    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await appServer.sendNotification(pushSubscription, notificationPayload);
          return { endpoint: sub.endpoint, success: true };
        } catch (err: any) {
          console.error(`[PushService] Push failed for endpoint: ${sub.endpoint}`, err);
          
          // If subscription has expired or is invalid, remove it from the database
          if (err.statusCode === 410 || err.statusCode === 404) {
            console.log(`[PushService] Subscription expired. Removing: ${sub.id}`);
            await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
          }
          return { endpoint: sub.endpoint, success: false, error: err.message };
        }
      })
    );

    return new Response(JSON.stringify({ message: 'Notifications sent', results }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    console.error('[PushService] Webhook error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
