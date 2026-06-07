import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.Ariston',
  appName: 'Ariston Service',
  webDir: 'www',
  // Silence the native bridge logs (already off in release; explicit for safety).
  loggingBehavior: 'none',
  plugins: {
    SplashScreen: {
      launchAutoHide: true,        // auto-hide kao fallback ako app pukne ili zaboravi hide()
      launchShowDuration: 30000,   // 30s — maksimum (app ga obično sakrije ranije ručno)
      showSpinner: true,
      androidScaleType: 'CENTER_INSIDE',
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
