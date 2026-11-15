import type { CapacitorConfig } from '@capacitor/cli';

/* The iPhone and Android apps. They open the same Mylo the web uses, from
   MYLO_APP_URL (default https://app.staymylo.com), so a release on the web is
   a release in the stores too; `native-shell/` is only what shows with no
   connection. Native extras (haptics on tick, status bar, splash) come from
   the Capacitor plugins. See STORES.md for building and submitting. */
const config: CapacitorConfig = {
  appId: 'com.staymylo.app',
  appName: 'Mylo',
  webDir: 'native-shell',
  server: {
    url: process.env.MYLO_APP_URL || 'https://app.staymylo.com',
    cleartext: false,
    errorPath: 'index.html'
  },
  plugins: {
    SplashScreen: { launchShowDuration: 900, backgroundColor: '#FFFFFF', showSpinner: false },
    StatusBar: { overlaysWebView: true }
  },
  ios: { contentInset: 'never' }
};

export default config;
