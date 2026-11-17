import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.bunyu.minigames',
  appName: 'Party Minigames',
  webDir: 'dist',
  backgroundColor: '#6ec6ff',
  android: {
    allowMixedContent: false,
  },
};

export default config;
