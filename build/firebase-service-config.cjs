/**
 * Firebase's web config, read at BUILD time from the app's native services
 * files and written into the bundle — so a React Native app on Firebase's JS
 * SDK is configured from `GoogleService-Info.plist` / `google-services.json`,
 * the same files native Firebase (analytics, crashlytics, messaging, remote
 * config, performance) already reads, rather than from a second copy of the
 * same values in `.env`.
 *
 * Used from an app's `babel.config.js`:
 *
 *   const { firebaseServiceConfigPlugin } =
 *     require('@sudobility/auth_lib/build/firebase-service-config');
 *   ...
 *   plugins: [
 *     firebaseServiceConfigPlugin(api, {
 *       ios: 'ios/MyApp/GoogleService-Info.plist',
 *       android: 'android/app/google-services.json',
 *       androidPackage: 'com.example.myapp',
 *     }),
 *     ...
 *   ]
 *
 * The plugin replaces these `process.env` references with literals for the
 * platform Metro is bundling (Babel's `caller.platform`):
 *
 *   FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID,
 *   FIREBASE_STORAGE_BUCKET, FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID,
 *   GOOGLE_OAUTH_CLIENT_ID (the iOS-type client), GOOGLE_WEB_CLIENT_ID
 *
 * Each platform gets its OWN app's values — the iOS app's API key and app id
 * on iOS, the Android app's on Android — which the Auth API accepts from the
 * JS SDK (checked for every app in the family). macOS and Windows read the
 * iOS file — always, even where a macOS plist exists: a desktop signs in with
 * the iOS-type Google client, and one file for the Apple-and-desktop family
 * means one set of values to keep right. With no platform
 * (jest) every name becomes `undefined`, so the code's defaults apply.
 *
 * The library reads only the files the app names; it reads no environment.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const NAMES = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_WEB_CLIENT_ID',
];

/** `<key>K</key><string>V</string>` pairs — all a GoogleService-Info.plist holds. */
function parsePlist(text) {
  const out = {};
  const re = /<key>([^<]+)<\/key>\s*<string>([^<]*)<\/string>/g;
  let m;
  while ((m = re.exec(text)) !== null) out[m[1]] = m[2];
  return out;
}

/** The values a GoogleService-Info.plist gives. */
function fromPlist(file) {
  const p = parsePlist(fs.readFileSync(file, 'utf8'));
  const projectId = p.PROJECT_ID || '';
  return {
    FIREBASE_API_KEY: p.API_KEY || '',
    FIREBASE_AUTH_DOMAIN: projectId ? `${projectId}.firebaseapp.com` : '',
    FIREBASE_PROJECT_ID: projectId,
    FIREBASE_STORAGE_BUCKET: p.STORAGE_BUCKET || '',
    FIREBASE_MESSAGING_SENDER_ID: p.GCM_SENDER_ID || '',
    FIREBASE_APP_ID: p.GOOGLE_APP_ID || '',
    GOOGLE_OAUTH_CLIENT_ID: p.CLIENT_ID || '',
    GOOGLE_WEB_CLIENT_ID: '',
  };
}

/**
 * The values a google-services.json gives, for the client registered to
 * `androidPackage` (a file may list several apps of one project).
 */
function fromServicesJson(file, androidPackage) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const clients = j.client || [];
  const client =
    clients.find(
      c =>
        c.client_info &&
        c.client_info.android_client_info &&
        c.client_info.android_client_info.package_name === androidPackage
    ) || (androidPackage ? null : clients[0]);
  if (!client) {
    throw new Error(
      `google-services.json (${file}) has no client for package "${androidPackage}"`
    );
  }
  const projectId = (j.project_info && j.project_info.project_id) || '';
  const oauth = client.oauth_client || [];
  const other =
    (client.services &&
      client.services.appinvite_service &&
      client.services.appinvite_service.other_platform_oauth_client) ||
    [];
  const web = [...oauth, ...other].find(c => c.client_type === 3);
  const ios = [...oauth, ...other].find(c => c.client_type === 2);
  return {
    FIREBASE_API_KEY: (client.api_key && client.api_key[0] && client.api_key[0].current_key) || '',
    FIREBASE_AUTH_DOMAIN: projectId ? `${projectId}.firebaseapp.com` : '',
    FIREBASE_PROJECT_ID: projectId,
    FIREBASE_STORAGE_BUCKET: (j.project_info && j.project_info.storage_bucket) || '',
    FIREBASE_MESSAGING_SENDER_ID: (j.project_info && j.project_info.project_number) || '',
    FIREBASE_APP_ID: (client.client_info && client.client_info.mobilesdk_app_id) || '',
    GOOGLE_OAUTH_CLIENT_ID: (ios && ios.client_id) || '',
    GOOGLE_WEB_CLIENT_ID: (web && web.client_id) || '',
  };
}

/**
 * The values for one platform, or null when the platform is unknown.
 * `files` paths are relative to `root` (the app; default: cwd).
 */
function firebaseServiceConfig(platform, files, root) {
  const base = root || process.cwd();
  const at = p => path.resolve(base, p);
  switch (platform) {
    case 'ios':
      return fromPlist(at(files.ios));
    case 'android':
      return fromServicesJson(at(files.android), files.androidPackage);
    case 'macos':
    case 'windows':
      return fromPlist(at(files.ios));
    default:
      return null;
  }
}

const cache = new Map();

/**
 * A Babel plugin entry that inlines the platform's values. Reads the files
 * once per platform per process.
 */
function firebaseServiceConfigPlugin(api, files) {
  const platform = api.caller(caller => (caller && caller.platform) || null);
  const root = files.root || process.cwd();
  const key = `${root}|${platform}`;
  if (!cache.has(key)) cache.set(key, firebaseServiceConfig(platform, files, root));
  const values = cache.get(key);

  return function inlineFirebaseServiceConfig({ types: t }) {
    return {
      name: 'inline-firebase-service-config',
      visitor: {
        MemberExpression(p) {
          const node = p.node;
          if (
            !t.isMemberExpression(node.object) ||
            !t.isIdentifier(node.object.object, { name: 'process' }) ||
            !t.isIdentifier(node.object.property, { name: 'env' })
          ) {
            return;
          }
          const name = node.computed
            ? t.isStringLiteral(node.property) && node.property.value
            : t.isIdentifier(node.property) && node.property.name;
          if (!name || !NAMES.includes(name)) return;
          const value = values && values[name];
          p.replaceWith(value ? t.stringLiteral(value) : t.identifier('undefined'));
        },
      },
    };
  };
}

module.exports = {
  FIREBASE_SERVICE_CONFIG_NAMES: NAMES,
  firebaseServiceConfig,
  firebaseServiceConfigPlugin,
  parsePlist,
};
