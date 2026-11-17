import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.bunyu.minigames',
  appName: 'Party Minigames',
  webDir: 'dist',
  backgroundColor: '#1d2b53',
  android: {
    allowMixedContent: false,
  },
};

export default config;
