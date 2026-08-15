import type { CapacitorConfig } from '@capacitor/cli';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Aktivni brend (appId, appName) upisuje scripts/set-brand.js u
// capacitor.brand.json. NEMA fallback-a namerno: ako brend nije postavljen,
// build PUCA umesto da tiho izabere pogrešan brend (npr. Ariston umesto Tiki).
function loadBrand(): { appId: string; appName: string } {
  const brandFile = join(__dirname, 'capacitor.brand.json');
  if (!existsSync(brandFile)) {
    throw new Error(
      '[capacitor.config] capacitor.brand.json ne postoji. ' +
      'Pokreni `node scripts/set-brand.js <brand>` pre `cap sync`.',
    );
  }
  const b = JSON.parse(readFileSync(brandFile, 'utf8'));
  if (!b.appId || !b.appName) {
    throw new Error('[capacitor.config] capacitor.brand.json nema appId/appName.');
  }
  return { appId: b.appId, appName: b.appName };
}

const brand = loadBrand();

const config: CapacitorConfig = {
  appId: brand.appId,
  appName: brand.appName,
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
