import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ironwallsky.game',
  appName: 'Iron Wall Sky',
  webDir: 'dist',
  // Dev only — remove before shipping:
  // server: { url: 'http://YOUR_LOCAL_IP:5173', cleartext: true },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#1a1a2e',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
  },
};

export default config;
