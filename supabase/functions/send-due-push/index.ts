import { createClient } from "npm:@supabase/supabase-js@2.49.8";
import webpush from "npm:web-push@3.6.7";

interface DueDateRow {
  user_id: string;
  due_date: string;
}

interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

const responseHeaders = { "Content-Type": "application/json; charset=utf-8" };
const fixedPayload = JSON.stringify({
  title: "GastoPro",
  body: "Você tem vencimentos próximos. Abra o GastoPro.",
  data: { url: "/" },
});

function jsonResponse(
  status: number,
  counts: { scanned: number; sent: number; skipped: number; expired: number; failed: number },
): Response {
  return new Response(JSON.stringify(counts), { status, headers: responseHeaders });
}

function constantTimeEqual(candidate: string, expected: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(candidate);
  const right = encoder.encode(expected);
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;

  for (let index = 0; index < length; index++) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

function getSaoPauloDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addOneDay(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

function getStatusCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("statusCode" in error)) {
    return undefined;
  }
  return typeof error.statusCode === "number" ? error.statusCode : undefined;
}

function isSuccessfulStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return false;
    const hostname = url.hostname.toLowerCase();
    return hostname === "web.push.apple.com" ||
      hostname === "fcm.googleapis.com" ||
      hostname === "updates.push.services.mozilla.com" ||
      hostname.endsWith(".notify.windows.com");
  } catch {
    return false;
  }
}

function readRequiredEnvironment(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error("Missing required environment configuration");
  return value;
}

Deno.serve(async (request) => {
  const counts = { scanned: 0, sent: 0, skipped: 0, expired: 0, failed: 0 };
  if (request.method !== "POST") {
    return jsonResponse(405, { ...counts, failed: 1 });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  const suppliedSecret = request.headers.get("x-cron-secret") ?? "";
  if (!cronSecret) return jsonResponse(500, { ...counts, failed: 1 });
  if (!constantTimeEqual(suppliedSecret, cronSecret)) {
    return jsonResponse(401, { ...counts, failed: 1 });
  }

  const initialData = await (async () => {
    try {
      const supabaseUrl = readRequiredEnvironment("SUPABASE_URL");
      const serviceRoleKey = readRequiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
      const vapidPublicKey = readRequiredEnvironment("VAPID_PUBLIC_KEY");
      const vapidPrivateKey = readRequiredEnvironment("VAPID_PRIVATE_KEY");
      const vapidSubject = readRequiredEnvironment("VAPID_SUBJECT");

      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
      const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const today = getSaoPauloDate();
      const dates = [today, addOneDay(today)];
      const { data: dueRows, error: dueError } = await supabase
        .from("push_due_dates")
        .select("user_id,due_date")
        .in("due_date", dates)
        .order("due_date");
      if (dueError) throw new Error("Could not read due date snapshot");

      const dueDates = (dueRows ?? []) as DueDateRow[];
      const { data: loggedRows, error: logReadError } = await supabase
        .from("push_notification_log")
        .select("user_id,due_date")
        .in("due_date", dates);
      if (logReadError) throw new Error("Could not read push log");

      return {
        supabase,
        dueDates,
        logged: new Set(
          (loggedRows ?? []).map((row) => `${row.user_id}:${row.due_date}`),
        ),
      };
    } catch {
      return null;
    }
  })();

  if (!initialData) {
    return jsonResponse(500, { ...counts, failed: counts.failed + 1 });
  }

  const { supabase, dueDates, logged } = initialData;
  counts.scanned = dueDates.length;
  const pendingByUser = new Map<string, string[]>();
  for (const due of dueDates) {
    const eventKey = `${due.user_id}:${due.due_date}`;
    if (logged.has(eventKey)) {
      counts.skipped++;
      continue;
    }
    const pendingDates = pendingByUser.get(due.user_id) ?? [];
    pendingDates.push(due.due_date);
    pendingByUser.set(due.user_id, pendingDates);
  }

  for (const [userId, pendingDates] of pendingByUser) {
    try {
      const { data, error } = await supabase
        .from("push_subscriptions")
        .select("endpoint,p256dh,auth")
        .eq("user_id", userId);
      if (error) throw new Error("Could not read push subscriptions");

      let validSubscriptionCount = 0;
      let delivered = false;
      for (const subscription of (data ?? []) as PushSubscriptionRow[]) {
        if (!isAllowedPushEndpoint(subscription.endpoint)) {
          const { error: deleteError } = await supabase
            .from("push_subscriptions")
            .delete()
            .eq("user_id", userId)
            .eq("endpoint", subscription.endpoint);
          if (deleteError) throw new Error("Could not remove invalid push subscription");
          counts.expired++;
          continue;
        }
        if (validSubscriptionCount >= 5) continue;
        validSubscriptionCount++;

        try {
          const pushSubscription: PushSubscription = {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          };
          const result = await webpush.sendNotification(pushSubscription, fixedPayload, {
            TTL: 86400,
            urgency: "normal",
            timeout: 10000,
          });
          if (!isSuccessfulStatus(result.statusCode)) {
            throw Object.assign(new Error("Push provider rejected notification"), {
              statusCode: result.statusCode,
            });
          }
          delivered = true;
          counts.sent++;
        } catch (error) {
          const status = getStatusCode(error);
          if (status === 404 || status === 410) {
            try {
              const { error: deleteError } = await supabase
                .from("push_subscriptions")
                .delete()
                .eq("user_id", userId)
                .eq("endpoint", subscription.endpoint);
              if (deleteError) throw new Error("Could not remove expired push subscription");
              counts.expired++;
            } catch {
              counts.failed++;
            }
          } else {
            counts.failed++;
          }
        }
      }

      if (!validSubscriptionCount) {
        counts.skipped += pendingDates.length;
        continue;
      }

      if (!delivered) continue;

      const { error: logError } = await supabase
        .from("push_notification_log")
        .upsert(
          pendingDates.map((dueDate) => ({ user_id: userId, due_date: dueDate })),
          { onConflict: "user_id,due_date", ignoreDuplicates: true },
        );
      if (logError) throw new Error("Could not record push delivery");
    } catch {
      counts.failed++;
    }
  }

  return jsonResponse(200, counts);
});
