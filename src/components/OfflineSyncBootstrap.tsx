import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LOCAL_DATA_CHANGED_EVENT } from "@/lib/localData";
import { syncPendingPushRegistration } from "@/lib/pushNotifications";
import { hydrateAndSyncUserState, saveRemoteUserState } from "@/lib/userStateSync";

const SYNC_DEBOUNCE_MS = 1200;

const OfflineSyncBootstrap = () => {
  const currentUserIdRef = useRef<string | null>(null);
  const syncTimerRef = useRef<number | null>(null);
  const hydratePromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    const clearPendingSync = () => {
      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    };

    const runHydration = async (userId: string) => {
      const currentRun = hydrateAndSyncUserState(userId)
        .catch((error) => {
          console.error("Offline sync hydration error:", error);
        })
        .then(() => undefined);

      hydratePromiseRef.current = currentRun;
      await currentRun;

      if (hydratePromiseRef.current === currentRun) {
        hydratePromiseRef.current = null;
      }
    };

    const flushSync = async () => {
      const userId = currentUserIdRef.current;
      if (!userId || !navigator.onLine) return;

      if (hydratePromiseRef.current) {
        await hydratePromiseRef.current;
      }

      try {
        await saveRemoteUserState(userId);
      } catch (error) {
        console.error("Offline sync flush error:", error);
      }
    };

    const scheduleSync = () => {
      if (!currentUserIdRef.current || !navigator.onLine) return;

      clearPendingSync();
      syncTimerRef.current = window.setTimeout(() => {
        void flushSync();
      }, SYNC_DEBOUNCE_MS);
    };

    const handleOnline = () => {
      // Re-sync push subscription when coming back online
      void syncPendingPushRegistration();

      const userId = currentUserIdRef.current;
      if (!userId) return;
      void runHydration(userId);
    };

    const handleLocalDataChange = (event: Event) => {
      const detail = (event as CustomEvent<{ source?: string }>).detail;
      if (detail?.source === "hydrate") return;
      scheduleSync();
    };

    // Always try to sync push on app start (registers device automatically)
    void syncPendingPushRegistration();

    supabase.auth.getSession().then(({ data: { session } }) => {
      const userId = session?.user?.id ?? null;
      currentUserIdRef.current = userId;

      // Re-sync push with user context
      void syncPendingPushRegistration();

      if (userId) {
        void runHydration(userId);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      clearPendingSync();
      currentUserIdRef.current = session?.user?.id ?? null;

      // Re-sync push with new auth state
      void syncPendingPushRegistration();

      if (currentUserIdRef.current) {
        void runHydration(currentUserIdRef.current);
      }
    });

    window.addEventListener("online", handleOnline);
    window.addEventListener(LOCAL_DATA_CHANGED_EVENT, handleLocalDataChange as EventListener);

    return () => {
      clearPendingSync();
      subscription.unsubscribe();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener(LOCAL_DATA_CHANGED_EVENT, handleLocalDataChange as EventListener);
    };
  }, []);

  return null;
};

export default OfflineSyncBootstrap;
