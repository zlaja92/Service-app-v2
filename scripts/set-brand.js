#!/usr/bin/env node
/* eslint-disable */
/**
 * set-brand.js — aktivira jedan brend (klijenta) za build.
 *
 * Kopira SVE fajlove izabranog brenda (brands/<id>/) na prava mesta u projektu:
 *   - environment.ts        → src/environments/environment.prod.ts
 *   - google-services.json  → android/app/google-services.json
 *   - GoogleService-Info.plist → ios/App/App/GoogleService-Info.plist
 *   - brand.json vrednosti  → android/app/brand.properties (čita ga build.gradle)
 *   - brand.json vrednosti  → capacitor.brand.json (čita ga capacitor.config.ts)
 *   - android strings.xml (app_name, package_name, custom_url_scheme)
 *   - iOS Info.plist (CFBundleDisplayName) + pbxproj (PRODUCT_BUNDLE_IDENTIFIER)
 *   - assets/               → resources/ (izvor za `capacitor-assets generate`)
 *
 * Pošto se ceo brend bira odjednom iz jednog foldera, nemoguće je pomešati
 * fajlove dva klijenta. Skripta ODBIJA rad ako brendu nedostaje neki fajl
 * (npr. .MISSING marker za Firebase), da se ne builduje sa tuđim/lažnim configom.
 *
 * Upotreba:  node scripts/set-brand.js <brand-id>
 *            node scripts/set-brand.js --list
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BRANDS_DIR = path.join(ROOT, 'brands');
const ACTIVE_BRAND_FILE = path.join(ROOT, '.active-brand');

function log(msg) { console.log(`[set-brand] ${msg}`); }
function warn(msg) { console.warn(`[set-brand] WARN: ${msg}`); }
function fail(msg) {
  console.error(`[set-brand] ERROR: ${msg}`);
  process.exit(1);
}

function listBrands() {
  return fs.readdirSync(BRANDS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .map((d) => d.name)
    .sort();
}

function readBrandConfig(brandId) {
  const brandDir = path.join(BRANDS_DIR, brandId);
  if (!fs.existsSync(brandDir)) {
    fail(`Brend "${brandId}" ne postoji. Dostupni: ${listBrands().join(', ')}`);
  }
  const brandJsonPath = path.join(brandDir, 'brand.json');
  if (!fs.existsSync(brandJsonPath)) {
    fail(`brands/${brandId}/brand.json ne postoji.`);
  }
  const brand = JSON.parse(fs.readFileSync(brandJsonPath, 'utf8'));

  // Sanity: id u fajlu mora odgovarati imenu foldera (spreči kopiranje pod pogrešnim id).
  if (brand.id !== brandId) {
    fail(`brand.json "id" ("${brand.id}") ne odgovara imenu foldera ("${brandId}").`);
  }
  for (const key of ['id', 'displayName', 'appId', 'androidPackage', 'iosBundleId', 'customUrlScheme']) {
    if (!brand[key] || String(brand[key]).startsWith('REPLACE')) {
      fail(`brand.json za "${brandId}" nema validan "${key}".`);
    }
  }
  return { brand, brandDir };
}

/** Kopira fajl; ako nedostaje a postoji .MISSING marker, jasno objasni. */
function requireBrandFile(brandDir, brandId, fileName, destAbs) {
  const src = path.join(brandDir, fileName);
  if (!fs.existsSync(src)) {
    const missing = path.join(brandDir, `${fileName}.MISSING`);
    if (fs.existsSync(missing)) {
      fail(
        `Brend "${brandId}" nema ${fileName} (postoji ${fileName}.MISSING).\n` +
        fs.readFileSync(missing, 'utf8').trim(),
      );
    }
    fail(`Brend "${brandId}" nema obavezan fajl: ${fileName}`);
  }
  fs.mkdirSync(path.dirname(destAbs), { recursive: true });
  fs.copyFileSync(src, destAbs);
  log(`  ${fileName} → ${path.relative(ROOT, destAbs)}`);
}

function replaceInFile(fileAbs, replacements, label) {
  if (!fs.existsSync(fileAbs)) {
    warn(`${label}: ${path.relative(ROOT, fileAbs)} ne postoji — preskačem.`);
    return;
  }
  let content = fs.readFileSync(fileAbs, 'utf8');
  const before = content;
  for (const [pattern, value] of replacements) {
    pattern.lastIndex = 0; // /g regex ima stateful lastIndex — resetuj pre .test()
    if (!pattern.test(content)) {
      // Pattern se ne nalazi u fajlu — to je prava greška (loš regex / promenjen fajl).
      fail(`${label}: pattern nije pronađen u fajlu (${pattern}). Proveri set-brand.js.`);
    }
    pattern.lastIndex = 0;
    content = content.replace(pattern, value);
  }
  if (content !== before) {
    fs.writeFileSync(fileAbs, content);
    log(`  ${label} ažuriran`);
  } else {
    log(`  ${label} već ima ispravne vrednosti`);
  }
}

// Kada je prisutan, ne pokreći capacitor-assets generate (build-brand.js ga
// poziva sam posle set-brand-a, da se ne pokreće dvaput).
const SKIP_GENERATE = process.argv.includes('--skip-generate');

function main() {
  // Prvi argument koji NIJE flag je brend id.
  const arg = process.argv.slice(2).find((a) => !a.startsWith('--'))
    ?? (process.argv.includes('--list') ? '--list' : undefined);
  if (!arg || arg === '--list') {
    log(`Dostupni brendovi: ${listBrands().join(', ') || '(nema)'}`);
    if (fs.existsSync(ACTIVE_BRAND_FILE)) {
      log(`Trenutno aktivan: ${fs.readFileSync(ACTIVE_BRAND_FILE, 'utf8').trim()}`);
    }
    if (!arg) process.exit(1);
    return;
  }

  const brandId = arg;
  const { brand, brandDir } = readBrandConfig(brandId);

  log(`Aktiviram brend: ${brandId} (${brand.displayName}, ${brand.appId})`);

  // 1) Angular environment (prod).
  requireBrandFile(brandDir, brandId, 'environment.ts',
    path.join(ROOT, 'src/environments/environment.prod.ts'));

  // 2) Native Firebase config.
  requireBrandFile(brandDir, brandId, 'google-services.json',
    path.join(ROOT, 'android/app/google-services.json'));
  requireBrandFile(brandDir, brandId, 'GoogleService-Info.plist',
    path.join(ROOT, 'ios/App/App/GoogleService-Info.plist'));

  // 3) brand.properties — čita ga android/app/build.gradle.
  const brandProps =
    `# GENERISANO od scripts/set-brand.js — NE menjati ručno.\n` +
    `brand.id=${brand.id}\n` +
    `brand.applicationId=${brand.androidPackage}\n` +
    `brand.appName=${brand.displayName}\n` +
    `brand.customUrlScheme=${brand.customUrlScheme}\n` +
    (brand.keystoreFile ? `brand.keystoreFile=${brand.keystoreFile}\n` : '');
  fs.writeFileSync(path.join(ROOT, 'android/app/brand.properties'), brandProps);
  log('  android/app/brand.properties zapisan');

  // Osveži mtime build.gradle-a da Android Studio prikaže "Sync Now" baner.
  // Studio kešira applicationId iz poslednjeg Gradle sync-a: bez sync-a bi Run
  // instalirao novi brend, a POKRENUO app starog brenda (ili pukao ako nije
  // instalirana). brand.properties nije fajl koji Studio prati, build.gradle jeste.
  const appGradle = path.join(ROOT, 'android/app/build.gradle');
  if (fs.existsSync(appGradle)) {
    const now = new Date();
    fs.utimesSync(appGradle, now, now);
    log('  Android Studio: uradi "Sync Project with Gradle Files" pre Run-a!');
  }

  // 4) capacitor.brand.json — čita ga capacitor.config.ts.
  fs.writeFileSync(path.join(ROOT, 'capacitor.brand.json'),
    JSON.stringify({ appId: brand.appId, appName: brand.displayName }, null, 2) + '\n');
  log('  capacitor.brand.json zapisan');

  // 5) Android stringovi (app_name, custom_url_scheme, ...) se NE diraju ovde —
  //    generiše ih android/app/build.gradle (resValue) iz brand.properties (korak 3).

  // 6) iOS: display name + bundle id.
  replaceInFile(
    path.join(ROOT, 'ios/App/App/Info.plist'),
    [[/(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]*(<\/string>)/, `$1${brand.displayName}$2`]],
    'Info.plist',
  );
  replaceInFile(
    path.join(ROOT, 'ios/App/App.xcodeproj/project.pbxproj'),
    [[/PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/g, `PRODUCT_BUNDLE_IDENTIFIER = ${brand.iosBundleId};`]],
    'project.pbxproj',
  );

  // 7) Assets → resources/ (izvor za capacitor-assets generate).
  //    KRITIČNO: prvo očisti resources/ da fajlovi PRETHODNOG brenda ne procure
  //    (npr. tuđi splash-dark.png ako novi brend nema svoj).
  const assetsDir = path.join(brandDir, 'assets');
  if (!fs.existsSync(assetsDir)) {
    fail(`Brend "${brandId}" nema assets/ folder.`);
  }
  const resourcesDir = path.join(ROOT, 'resources');
  fs.mkdirSync(resourcesDir, { recursive: true });
  for (const f of fs.readdirSync(resourcesDir)) {
    if (f.endsWith('.png')) fs.rmSync(path.join(resourcesDir, f));
  }
  for (const f of fs.readdirSync(assetsDir)) {
    fs.copyFileSync(path.join(assetsDir, f), path.join(resourcesDir, f));
  }
  // Ako brend nema poseban dark splash, koristi njegov light splash kao dark —
  // nikad ne nasleđuj tuđi. (capacitor-assets traži splash-dark.png za dark mod.)
  const brandDark = path.join(assetsDir, 'splash-dark.png');
  const brandLight = path.join(assetsDir, 'splash.png');
  if (!fs.existsSync(brandDark) && fs.existsSync(brandLight)) {
    fs.copyFileSync(brandLight, path.join(resourcesDir, 'splash-dark.png'));
    log('  (brend nema splash-dark.png — koristim splash.png i za dark mod)');
  }
  log('  assets → resources/ (očišćeno pre kopiranja)');

  // 7.5) Regeneriši native ikonice/splash iz resources/ preko capacitor-assets.
  //      KRITIČNO za samostalni set-brand: bez ovoga mipmap ikonice i splash.png
  //      ostaju od PRETHODNOG brenda (capacitor-assets se pokreće ovde, ne samo
  //      kroz build-brand.js). Preskače se sa --skip-generate kada build-brand.js
  //      ionako sam poziva generate posle (da se ne pokreće dvaput).
  if (!SKIP_GENERATE) {
    try {
      log('  capacitor-assets generate ...');
      execSync('npx capacitor-assets generate', { stdio: 'ignore', cwd: ROOT });
      log('  native ikonice/splash regenerisane');
    } catch (e) {
      warn('capacitor-assets generate nije uspeo — ikonice/splash možda nisu osvežene.');
    }
  }

  // 8) Android 12+ splash (splash_icon.png + boja pozadine).
  //    MORA posle capacitor-assets (koji ne pravi splash_icon, ali prepisuje
  //    mipmap/splash.png) — da naš splash_icon ostane zadnja reč.
  //    capacitor-assets NE regeneriše splash_icon.png — Android 12+ tema
  //    (styles.xml windowSplashScreenAnimatedIcon) koristi baš njega, pa bi
  //    ostao od prethodnog brenda (klasično mešanje). Zato ga ovde sami
  //    generišemo iz brendovog splash.png i upisujemo brand boje pozadine.
  const splashIconSrc = path.join(assetsDir, 'splash.png');
  const splashIconTargets = [
    path.join(ROOT, 'android/app/src/main/res/drawable-nodpi/splash_icon.png'),
    path.join(ROOT, 'android/app/src/main/res/drawable-night/splash_icon.png'),
  ];
  if (fs.existsSync(splashIconSrc)) {
    for (const target of splashIconTargets) {
      if (!fs.existsSync(path.dirname(target))) continue;
      fs.copyFileSync(splashIconSrc, target);
      // Skaliraj na 432x432 (dimenzija koju tema očekuje) preko macOS `sips`.
      try {
        execSync(`sips -z 432 432 "${target}"`, { stdio: 'ignore' });
      } catch {
        warn(`Ne mogu da skaliram ${path.basename(target)} (sips nije dostupan?) — koristim originalnu veličinu.`);
      }
    }
    log('  splash_icon.png (Android 12+) regenerisan iz brand splash.png');
  } else {
    warn(`Brend "${brandId}" nema splash.png — Android 12 splash_icon nije osvežen.`);
  }

  // Splash background boje (light + dark) iz brand.json.
  const bgLight = brand.splashBackgroundLight || '#FFFFFF';
  const bgDark = brand.splashBackgroundDark || '#000000';
  replaceInFile(
    path.join(ROOT, 'android/app/src/main/res/values/colors.xml'),
    [[/(<color name="splashScreenBackground">)[^<]*(<\/color>)/, `$1${bgLight}$2`]],
    'colors.xml (light splash bg)',
  );
  replaceInFile(
    path.join(ROOT, 'android/app/src/main/res/values-night/colors.xml'),
    [[/(<color name="splashScreenBackground">)[^<]*(<\/color>)/, `$1${bgDark}$2`]],
    'colors-night.xml (dark splash bg)',
  );

  // 9) Zapamti aktivni brend.
  fs.writeFileSync(ACTIVE_BRAND_FILE, brandId + '\n');
  log(`Gotovo. Aktivan brend: ${brandId}`);
  log(`Sledeće: ng build -c production  &&  npx cap sync`);
}

main();
