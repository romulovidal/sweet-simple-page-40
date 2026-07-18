// Runs Capacitor-only setup. No-op on plain web (dynamic imports are tree-shaken safe).
export async function initNative() {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor?.isNativePlatform?.()) return;

    const [{ StatusBar, Style }, { SplashScreen }, { PushNotifications }] = await Promise.all([
      import("@capacitor/status-bar"),
      import("@capacitor/splash-screen"),
      import("@capacitor/push-notifications"),
    ]);

    await StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    await StatusBar.setBackgroundColor({ color: "#0F172A" }).catch(() => {});
    await SplashScreen.hide().catch(() => {});

    // Request push permission (Android 13+ / iOS) — token forwarded to backend later if needed.
    const perm = await PushNotifications.checkPermissions();
    if (perm.receive !== "granted") {
      const req = await PushNotifications.requestPermissions();
      if (req.receive === "granted") await PushNotifications.register();
    } else {
      await PushNotifications.register();
    }
  } catch (e) {
    // Silently ignore on web where plugins aren't loaded.
    console.debug("[native] skipped:", e);
  }
}