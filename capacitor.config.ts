import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nousai.companion',
  appName: 'NousAI',
  webDir: 'dist',
  server: {
    // Allow loading local files and mixed content for e-ink Boox
    androidScheme: 'https',
    iosScheme: 'https',
  },
  android: {
    // E-ink optimization: disable hardware acceleration for cleaner rendering
    allowMixedContent: true,
    backgroundColor: '#ffffff',
  },
  ios: {
    backgroundColor: '#0f0f23',
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1000,
      backgroundColor: '#0f0f23',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f0f23',
    },
  },
};

export default config;
