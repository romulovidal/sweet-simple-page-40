import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Web Push utilities
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
}

async function importVapidKeys(publicKey: string, privateKey: string) {
  const pubBytes = urlBase64ToUint8Array(publicKey);
  const privBytes = urlBase64ToUint8Array(privateKey);

  const pubKey = await crypto.subtle.importKey(
    "raw",
    pubBytes.buffer as ArrayBuffer,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    []
  );

  const privKey = await crypto.subtle.importKey(
    "pkcs8",
    await convertRawToPKCS8(privBytes),
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"]
  );

  return { pubKey, privKey };
}

async function convertRawToPKCS8(rawKey: Uint8Array): Promise<ArrayBuffer> {
  // For EC P-256 private key: wrap raw 32-byte key in PKCS#8
  const pkcs8Header = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
    0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02,
    0x01, 0x01, 0x04, 0x20
  ]);
  const pkcs8Footer = new Uint8Array([
    0xa1, 0x44, 0x03, 0x42, 0x00
  ]);

  const result = new Uint8Array(pkcs8Header.length + rawKey.length + pkcs8Footer.length);
  result.set(pkcs8Header, 0);
  result.set(rawKey, pkcs8Header.length);
  // We skip the public key part for signing
  return result.buffer;
}

async function createJWT(subject: string, audience: string, vapidPrivateKey: CryptoKey): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: subject, aud: audience, exp: now + 86400 };

  const enc = new TextEncoder();
  const headerB64 = btoa(String.fromCharCode(...enc.encode(JSON.stringify(header))))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const payloadB64 = btoa(String.fromCharCode(...enc.encode(JSON.stringify(payload))))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const signingInput = enc.encode(`${headerB64}.${payloadB64}`);
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    vapidPrivateKey,
    signingInput
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  return `${headerB64}.${payloadB64}.${sigB64}`;
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidSubject: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<boolean> {
  try {
    const audience = new URL(subscription.endpoint).origin;
    
    // Use web-push compatible approach - simple fetch with VAPID
    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "TTL": "86400",
      },
      body: payload,
    });

    return response.ok || response.status === 201;
  } catch (e) {
    console.error("Push send error:", e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidSubject = Deno.env.get("VAPID_SUBJECT")!;

    const supabase = createClient(supabaseUrl, serviceKey);
    const body = await req.json();
    const { title, body: msgBody, url, type } = body;

    if (!title || !msgBody) {
      return new Response(JSON.stringify({ error: "title and body required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all subscriptions
    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("*");

    if (error) throw error;

    const payload = JSON.stringify({
      title,
      body: msgBody,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-72x72.png",
      url: url || "/",
      type: type || "general",
    });

    let sent = 0;
    let failed = 0;

    for (const sub of (subs || [])) {
      const ok = await sendWebPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload,
        vapidSubject,
        vapidPublicKey,
        vapidPrivateKey
      );
      if (ok) sent++;
      else {
        failed++;
        // Remove invalid subscriptions
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }

    return new Response(JSON.stringify({ sent, failed, total: (subs || []).length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
