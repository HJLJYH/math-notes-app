import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mathnotes.app',
  appName: 'MathNotes',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    allowMixedContent: true,
    cleartextTraffic: true
  },
  plugins: {
    Filesystem: {
      readOnly: false
    }
  }
};

export default config;
