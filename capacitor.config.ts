import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.Ariston',
  appName: 'Ariston Service',
  webDir: 'www',
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      showSpinner: true,
    },
    Keyboard: {
      resize: 'body',
    },
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: [],
    },
  },
};

export default config;
