#!/usr/bin/env node
/* eslint-disable */
/**
 * build-brand.js — orkestrira ceo build za jedan brend, jednom komandom.
 *
 * Koraci:
 *   1. set-brand.js <brand>          (aktivira brend: env, Firebase, ikone, ime, bundle id)
 *   2. capacitor-assets generate     (generiše app ikonice/splash iz brand assets)  [opciono]
 *   3. ng build --configuration production
 *   4. cap sync <platform>
 *   5. native build (android bundle / ili poruka za iOS)  [ako je platforma data]
 *
 * Upotreba:
 *   node scripts/build-brand.js <brand> [platform] [--no-assets] [--no-native]
 *   npm run build:brand -- tiki android
 *   npm run build:brand -- ariston-srb ios
 *   npm run build:brand -- tiki            (samo web build + sync obe platforme)
 */
const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const brand = args.find((a) => !a.startsWith('--') && !['android', 'ios'].includes(a));
const platform = args.find((a) => a === 'android' || a === 'ios');
const noAssets = args.includes('--no-assets');
const noNative = args.includes('--no-native');

function log(msg) { console.log(`\n[build-brand] ${msg}`); }
function fail(msg) { console.error(`[build-brand] ERROR: ${msg}`); process.exit(1); }
function run(cmd) {
  log(`$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: ROOT });
}

if (!brand) {
  fail('Nedostaje brend. Primer: node scripts/build-brand.js tiki android');
}

// 1) Aktiviraj brend (ovo puca ako brendu nedostaje Firebase/config).
//    set-brand.js sam pokreće capacitor-assets generate (osim uz --no-assets)
//    i posle njega generiše Android 12 splash_icon — jedan izvor istine za slike.
run(`node scripts/set-brand.js ${brand}${noAssets ? ' --skip-generate' : ''}`);

// 3) Web (Angular) prod build.
run(`node scripts/sync-version.js`);
run(`npx ng build --configuration production`);

// 4) Capacitor sync.
run(`npx cap sync ${platform || ''}`.trim());

// 5) Native build.
if (platform && !noNative) {
  if (platform === 'android') {
    const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
    log('Gradim Android release bundle (.aab)...');
    execSync(`${gradlew} bundleRelease`, { stdio: 'inherit', cwd: path.join(ROOT, 'android') });
    log('Android .aab je u android/app/build/outputs/bundle/release/');
  } else if (platform === 'ios') {
    log('iOS: web + sync gotovi. Otvori Xcode i arhiviraj:  npx cap open ios');
    log('(iOS arhiviranje/potpisivanje ide kroz Xcode, ne skriptom.)');
  }
}

log(`GOTOVO za brend "${brand}"${platform ? ` (${platform})` : ''}.`);
