import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = "BJxpu8kKuKKxO2wqtaR7TRcw2HpRXJc3F5I5ys6AYvNq064w04vNJyBAs3_Q6FoTGSv2CxOxRTnmBstTWS1KdQM";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
}

export async function registerPushNotifications(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.log("Push not supported");
    return false;
  }

  try {
    // Don't register in iframe/preview
    try {
      if (window.self !== window.top) return false;
    } catch {
      return false;
    }
    if (window.location.hostname.includes("id-preview--") || window.location.hostname.includes("lovableproject.com")) {
      return false;
    }

    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const appServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appServerKey.buffer as ArrayBuffer,
    });

    const sub = subscription.toJSON();
    const { data: { user } } = await supabase.auth.getUser();

    // Save subscription to database
    await supabase.from("push_subscriptions").upsert(
      {
        endpoint: sub.endpoint!,
        p256dh: sub.keys!.p256dh,
        auth: sub.keys!.auth,
        user_id: user?.id || null,
      },
      { onConflict: "endpoint" }
    );

    return true;
  } catch (e) {
    console.error("Push registration error:", e);
    return false;
  }
}

export async function isPushEnabled(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

export async function unregisterPush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      // Remove from database
      await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
  } catch (e) {
    console.error("Push unregister error:", e);
  }
}
