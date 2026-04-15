import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = "BJxpu8kKuKKxO2wqtaR7TRcw2HpRXJc3F5I5ys6AYvNq064w04vNJyBAs3_Q6FoTGSv2CxOxRTnmBstTWS1KdQM";
const PUSH_SYNC_STORAGE_KEY = "pending-push-registration";

function isPreviewEnvironment() {
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }

  return (
    window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com")
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
}

function persistPendingRegistration() {
  localStorage.setItem(PUSH_SYNC_STORAGE_KEY, String(Date.now()));
}

function clearPendingRegistration() {
  localStorage.removeItem(PUSH_SYNC_STORAGE_KEY);
}

async function getActiveRegistration() {
  // Try without scope first (matches any SW), then fall back to registering
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js");
}

async function getSubscriptionJson(registration: ServiceWorkerRegistration) {
  const appServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appServerKey as BufferSource,
    });
  }

  return subscription.toJSON();
}

async function saveSubscription() {
  const registration = await getActiveRegistration();
  await navigator.serviceWorker.ready;

  const sub = await getSubscriptionJson(registration);
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Use the edge function (service role) to bypass RLS issues
  const { data, error } = await supabase.functions.invoke("push-subscription", {
    body: {
      endpoint: sub.endpoint!,
      p256dh: sub.keys!.p256dh,
      auth: sub.keys!.auth,
      user_id: session?.user?.id ?? null,
      action: "upsert",
    },
  });

  if (error || !data?.ok) {
    console.error("Push subscription save failed:", error ?? data);
    throw error ?? new Error("Failed to save push subscription");
  }

  clearPendingRegistration();
  return true;
}

export async function registerPushNotifications(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    console.log("Push not supported");
    return false;
  }

  if (isPreviewEnvironment()) {
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return false;
    }

    persistPendingRegistration();
    return await saveSubscription();
  } catch (e) {
    console.error("Push registration error:", e);
    return false;
  }
}

export async function syncPendingPushRegistration(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return false;
  }

  if (isPreviewEnvironment() || Notification.permission !== "granted") {
    return false;
  }

  try {
    return await saveSubscription();
  } catch (e) {
    console.error("Push sync error:", e);
    return false;
  }
}

export async function isPushEnabled(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

export async function unregisterPush(): Promise<void> {
  try {
    clearPendingRegistration();
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await supabase.functions.invoke("push-subscription", {
        body: {
          endpoint: sub.endpoint,
          p256dh: "x",
          auth: "x",
          action: "delete",
        },
      });
      await sub.unsubscribe();
    }
  } catch (e) {
    console.error("Push unregister error:", e);
  }
}
