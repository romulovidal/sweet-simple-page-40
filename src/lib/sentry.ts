import * as Sentry from "@sentry/react";

const DSN = "https://a646d436b9168495531450786bc647a7@o4511677569957888.ingest.us.sentry.io/4511677576118272";

export function initSentry() {
  if (typeof window === "undefined") return;
  if (import.meta.env.DEV) return; // evita ruído em desenvolvimento

  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 1.0,
  });
}

export { Sentry };

// Botão temporário de teste — remova após validar no dashboard do Sentry
export function throwTestError() {
  throw new Error("Sentry test error — " + new Date().toISOString());
}