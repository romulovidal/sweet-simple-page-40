import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'online.atalaias.biblia',
  appName: 'Bíblia Atalaia',
  webDir: 'dist',
  server: {
    url: 'https://biblia.atalaias.online',
    cleartext: false,
  },
};

export default config;