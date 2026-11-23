import webpush from 'web-push';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getNotificationPreferences } from '../settings/NotificationPreferences';

// Configure lazily, on first send — not at import. Pages that merely import a
// module which can send pushes (e.g. /admin/requests) are evaluated during
// `next build`, where the VAPID env vars may be absent; configuring at import
// time made the whole build fail.
let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    console.warn('[push] VAPID env vars missing — skipping push notification.');
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

let supabaseAdminClient: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  supabaseAdminClient ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  return supabaseAdminClient;
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

export async function sendPushToUser(appUserId: string, payload: PushPayload) {
  if (!ensureVapid()) return;
  const supabaseAdmin = getSupabaseAdmin();

  const { data: subs, error } = await supabaseAdmin
    .from('push_subscription')
    .select('*')
    .eq('app_user_id', appUserId)
    .eq('is_active', true);

  if (error) throw error;
  if (!subs?.length) return;

  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        );

        await supabaseAdmin
          .from('push_subscription')
          .update({ last_used_at: new Date().toISOString() })
          .eq('push_subscription_id', sub.push_subscription_id);
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabaseAdmin
            .from('push_subscription')
            .update({ is_active: false })
            .eq('push_subscription_id', sub.push_subscription_id);
        }
        // throw err;
      }
    })
  );

  return results;
}