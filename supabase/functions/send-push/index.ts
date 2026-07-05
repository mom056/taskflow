// Deno Edge Function for sending Push Notifications (Web Push + FCM v1 for Native)
// Triggered by Supabase Database Webhook on task INSERT
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import * as webpush from "jsr:@negrel/webpush"
import { Redis } from 'https://esm.sh/@upstash/redis@1.25.0'
import { Ratelimit } from 'https://esm.sh/@upstash/ratelimit@1.0.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Optional Upstash Redis Rate Limiting
const redisUrl = Deno.env.get('UPSTASH_REDIS_REST_URL');
const redisToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');

let ratelimit: Ratelimit | null = null;
if (redisUrl && redisToken) {
  try {
    const redis = new Redis({
      url: redisUrl,
      token: redisToken,
    });
    ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, '60 s'), // 60 requests per minute for webhooks
      analytics: false,
    });
  } catch (err) {
    console.error('Failed to initialize Upstash Redis for rate limiting:', err);
  }
}

// Web Push (VAPID) credentials
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:info@taskflow.com';

// Firebase Service Account JSON (stored as a Supabase secret)
// Get it from Firebase Console > Project Settings > Service Accounts > Generate new private key
const FIREBASE_SERVICE_ACCOUNT_JSON = Deno.env.get('FIREBASE_SERVICE_ACCOUNT') || '';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ─── Setup VAPID for Web Push ───
let appServer: any = null;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    await webpush.importVapidKeys({
      publicKey: VAPID_PUBLIC_KEY,
      privateKey: VAPID_PRIVATE_KEY,
    });
    appServer = new webpush.ApplicationServer({ subject: VAPID_SUBJECT });
    console.log('[PushService] VAPID keys imported.');
  } catch (err) {
    console.error('[PushService] VAPID import error:', err);
  }
}

// ─── FCM v1 API Authentication ───
// Uses Google Service Account to get OAuth2 access token for FCM

function base64url(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlStr(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Convert PEM private key to CryptoKey for signing
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');

  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  return await crypto.subtle.importKey(
    'pkcs8',
    binaryDer.buffer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign'],
  );
}

// Helper to sign JWT for Google OAuth2
async function getGoogleAccessToken(serviceAccountJson: string): Promise<string> {
  const account = JSON.parse(serviceAccountJson);
  const jwtHeader = { alg: 'RS256', typ: 'JWT' };
  const nowSecs = Math.floor(Date.now() / 1000);
  const jwtClaim = {
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: nowSecs + 3600,
    iat: nowSecs,
  };

  const headerB64 = base64urlStr(JSON.stringify(jwtHeader));
  const claimB64 = base64urlStr(JSON.stringify(jwtClaim));
  const signInput = `${headerB64}.${claimB64}`;

  const privateKey = await importPrivateKey(account.private_key);
  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(signInput),
  );

  const signatureB64 = base64url(new Uint8Array(signatureBuffer));
  const jwt = `${signInput}.${signatureB64}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const tokenData = await tokenResponse.json();
  if (tokenData.error) {
    throw new Error(`Google OAuth error: ${tokenData.error_description || tokenData.error}`);
  }
  return tokenData.access_token;
}

async function getAccessToken(serviceAccount: any): Promise<string> {
  return await getGoogleAccessToken(JSON.stringify(serviceAccount));
}

// ─── Send FCM v1 push notification ───
async function sendFcmNotification(
  serviceAccount: any,
  accessToken: string,
  deviceToken: string,
  title: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: {
            token: deviceToken,
            notification: { title, body },
            android: {
              priority: 'HIGH',
              notification: {
                sound: 'default',
                click_action: 'FCM_PLUGIN_ACTIVITY',
                channel_id: 'taskflow_tasks',
              },
            },
            data: { type: 'new_task', title, body },
          },
        }),
      }
    );

    if (response.ok) {
      return { success: true };
    }

    const errorData = await response.json();
    const errorCode = errorData?.error?.details?.[0]?.errorCode || errorData?.error?.status || '';

    // Token is invalid or expired
    if (errorCode === 'UNREGISTERED' || errorCode === 'INVALID_ARGUMENT' || response.status === 404) {
      return { success: false, error: 'TOKEN_EXPIRED' };
    }

    return { success: false, error: JSON.stringify(errorData.error || errorData) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Send Web Push notification ───
async function sendWebPushNotification(sub: any, payload: string): Promise<{ success: boolean; error?: string; statusCode?: number }> {
  if (!appServer) return { success: false, error: 'VAPID not configured' };

  try {
    await appServer.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload
    );
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message, statusCode: err.statusCode };
  }
}

// ─── Main Handler ───
serve(async (req) => {
  try {
    // Verify Webhook Secret to secure the endpoint
    const webhookSecret = Deno.env.get('WEBHOOK_SECRET') || '';
    const incomingSecret = req.headers.get('X-Webhook-Secret') || '';

    // Fail closed: reject if webhookSecret is empty/missing OR incomingSecret does not match
    if (!webhookSecret || incomingSecret !== webhookSecret) {
      console.warn('[PushService] Rejected: missing or invalid webhook secret.');
      return new Response(JSON.stringify({ error: 'Unauthorized webhook secret' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const payload = await req.json();
    console.log('[PushService] Webhook:', payload.type, payload.table);

    if ((payload.type !== 'INSERT' && payload.type !== 'UPDATE') || payload.table !== 'tasks') {
      return new Response(JSON.stringify({ message: 'Ignored' }), {
        headers: { "Content-Type": "application/json" }, status: 200,
      });
    }

    const task = payload.record;
    let targetUserId = null;
    let title = '';
    let body = '';

    if (payload.type === 'INSERT') {
      targetUserId = task.employee_id;
      title = '📋 مهمة جديدة!';
      body = `تم تعيين مهمة لك: ${task.title}`;
    } else if (payload.type === 'UPDATE') {
      const oldStatus = payload.old_record?.status;
      const newStatus = task.status;

      if (oldStatus !== newStatus) {
        if (newStatus === 'in_progress') {
          targetUserId = task.created_by;
          title = '🚀 بدأ العمل!';
          body = `بدأ الموظف العمل على المهمة: ${task.title}`;
        } else if (newStatus === 'completed') {
          targetUserId = task.created_by;
          title = '✅ تم إنجاز المهمة!';
          body = `أكمل الموظف المهمة: ${task.title}`;
        }
      }
    }

    if (!targetUserId) {
      return new Response(JSON.stringify({ message: 'No target user to notify' }), {
        headers: { "Content-Type": "application/json" }, status: 200,
      });
    }

    // Fetch all subscriptions for target user
    const { data: subscriptions, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', targetUserId);

    if (error) throw error;
    if (!subscriptions?.length) {
      return new Response(JSON.stringify({ message: 'No subscriptions' }), {
        headers: { "Content-Type": "application/json" }, status: 200,
      });
    }

    const webPayload = JSON.stringify({ title, body, url: '/' });

    // Prepare FCM access token (if we have native subscriptions)
    let accessToken = '';
    let serviceAccount: any = null;
    let fcmError = '';
    const hasNativeSubs = subscriptions.some(s => s.device_token);

    if (hasNativeSubs) {
      if (!FIREBASE_SERVICE_ACCOUNT_JSON) {
        fcmError = 'FIREBASE_SERVICE_ACCOUNT secret is missing in Supabase';
      } else {
        try {
          serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON);
          accessToken = await getAccessToken(serviceAccount);
          console.log('[PushService] FCM access token obtained.');
        } catch (err: any) {
          fcmError = `FCM auth failed: ${err.message}`;
          console.error('[PushService] FCM auth failed:', err);
        }
      }
    }

    // Send to all devices
    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        // Native device (FCM)
        if (sub.device_token) {
          if (!accessToken || !serviceAccount) {
            return { type: 'fcm', success: false, error: fcmError || 'FCM not configured' };
          }
          const result = await sendFcmNotification(serviceAccount, accessToken, sub.device_token, title, body);
          console.log(`[PushService] FCM → ${result.success ? '✅' : '❌ ' + result.error}`);

          if (result.error === 'TOKEN_EXPIRED') {
            await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
          }
          return { type: 'fcm', ...result };
        }

        // Web browser (VAPID)
        if (sub.endpoint) {
          const result = await sendWebPushNotification(sub, webPayload);
          console.log(`[PushService] WebPush → ${result.success ? '✅' : '❌ ' + result.error}`);

          if (result.statusCode === 410 || result.statusCode === 404) {
            await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
          }
          return { type: 'webpush', ...result };
        }

        return { type: 'unknown', success: false, error: 'No token or endpoint' };
      })
    );

    const sent = results.filter(r => r.success).length;
    return new Response(
      JSON.stringify({ message: `Sent: ${sent}/${results.length}`, results }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: any) {
    console.error('[PushService] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { "Content-Type": "application/json" }, status: 500,
    });
  }
});
