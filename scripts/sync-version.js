#!/usr/bin/env node
/* eslint-disable */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PKG_PATH = path.join(ROOT, 'package.json');
const ANDROID_GRADLE_PATH = path.join(ROOT, 'android/app/build.gradle');
const IOS_PBXPROJ_PATH = path.join(ROOT, 'ios/App/App.xcodeproj/project.pbxproj');

const CHECK_TAG = process.argv.includes('--check-tag');

function readPackageVersion() {
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
  if (!pkg.version) {
    fail('package.json has no "version" field');
  }
  if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) {
    fail(`package.json version "${pkg.version}" must be in format X.Y.Z (no v prefix)`);
  }
  return pkg.version;
}

function computeBuildCode(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  if (major > 99 || minor > 99 || patch > 99) {
    fail(`Version "${version}" segment exceeds 99 — bump scheme cannot encode it`);
  }
  return major * 10000 + minor * 100 + patch;
}

function syncAndroid(version, buildCode) {
  if (!fs.existsSync(ANDROID_GRADLE_PATH)) {
    warn('android/app/build.gradle not found — skipping Android');
    return false;
  }
  let content = fs.readFileSync(ANDROID_GRADLE_PATH, 'utf8');
  const newContent = content
    .replace(/versionCode\s+\d+/, `versionCode ${buildCode}`)
    .replace(/versionName\s+"[^"]+"/, `versionName "${version}"`);
  if (newContent !== content) {
    fs.writeFileSync(ANDROID_GRADLE_PATH, newContent);
    log(`Android: versionName="${version}" versionCode=${buildCode}`);
    return true;
  }
  log(`Android: already at ${version} (${buildCode})`);
  return false;
}

function syncIos(version, buildCode) {
  if (!fs.existsSync(IOS_PBXPROJ_PATH)) {
    warn('ios/App/App.xcodeproj/project.pbxproj not found — skipping iOS');
    return false;
  }
  let content = fs.readFileSync(IOS_PBXPROJ_PATH, 'utf8');
  const newContent = content
    .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`)
    .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${buildCode};`);
  if (newContent !== content) {
    fs.writeFileSync(IOS_PBXPROJ_PATH, newContent);
    log(`iOS: MARKETING_VERSION=${version} CURRENT_PROJECT_VERSION=${buildCode}`);
    return true;
  }
  log(`iOS: already at ${version} (${buildCode})`);
  return false;
}

function checkGitTag(version) {
  const tagName = `v${version}`;
  try {
    const tags = execSync('git tag --list', { encoding: 'utf8', cwd: ROOT })
      .split('\n').map((s) => s.trim()).filter(Boolean);

    if (!tags.includes(tagName)) {
      log(`Git tag check passed: ${tagName} does not exist yet`);
      return;
    }

    const tagCommit = execSync(`git rev-list -n 1 ${tagName}`, { encoding: 'utf8', cwd: ROOT }).trim();
    const headCommit = execSync('git rev-parse HEAD', { encoding: 'utf8', cwd: ROOT }).trim();

    if (tagCommit === headCommit) {
      log(`Git tag check passed: ${tagName} points to current HEAD (just bumped)`);
      return;
    }

    fail(
      `Version ${tagName} was already released (tag points to an older commit).\n` +
      `Bump version in package.json (or run \`npm version patch/minor/major\`) before production build.`
    );
  } catch (err) {
    if (err.message?.startsWith('Version v')) throw err;
    warn('Could not check git tags — is this a git repo?');
  }
}

function log(msg) { console.log(`[sync-version] ${msg}`); }
function warn(msg) { console.warn(`[sync-version] WARN: ${msg}`); }
function fail(msg) {
  console.error(`[sync-version] ERROR: ${msg}`);
  process.exit(1);
}

const version = readPackageVersion();
const buildCode = computeBuildCode(version);

if (CHECK_TAG) {
  checkGitTag(version);
}

syncAndroid(version, buildCode);
syncIos(version, buildCode);

log(`Done. v${version} (build ${buildCode})`);
