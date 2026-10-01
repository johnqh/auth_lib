/**
 * The build helper that configures Firebase's JS SDK from the native services
 * files. Driven through a real Babel transform, the way an app's
 * babel.config.js runs it under Metro.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { transformSync } from '@babel/core';

const require = createRequire(import.meta.url);
const { firebaseServiceConfig, firebaseServiceConfigPlugin } = require(
  '../../build/firebase-service-config.cjs'
) as typeof import('../../build/firebase-service-config.cjs');

const root = path.join(__dirname, '__fixtures__');
const FILES = {
  root,
  ios: 'GoogleService-Info.plist',
  android: 'google-services.json',
  androidPackage: 'com.example.app',
};

const SOURCE = `export const config = {
  apiKey: process.env.FIREBASE_API_KEY ?? '',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN ?? '',
  appId: process.env['FIREBASE_APP_ID'],
  ios: process.env.GOOGLE_OAUTH_CLIENT_ID,
  web: process.env.GOOGLE_WEB_CLIENT_ID,
  other: process.env.FIREBASE_PROXY,
};`;

function transform(platform: string | undefined): string {
  return transformSync(SOURCE, {
    babelrc: false,
    configFile: false,
    caller: { name: 'metro', platform } as never,
    plugins: [
      // The same factory call an app makes inside its config function.
      ((api: { caller: (cb: (c: unknown) => unknown) => unknown }) => {
        api.caller(() => null);
        return firebaseServiceConfigPlugin(
          api as never,
          FILES
        )({ types: require('@babel/core').types });
      }) as never,
    ],
  })!.code!;
}

describe('firebaseServiceConfig', () => {
  it('reads the iOS app from GoogleService-Info.plist, deriving the auth domain', () => {
    expect(firebaseServiceConfig('ios', FILES, root)).toEqual({
      FIREBASE_API_KEY: 'ios-api-key',
      FIREBASE_AUTH_DOMAIN: 'demo-project.firebaseapp.com',
      FIREBASE_PROJECT_ID: 'demo-project',
      FIREBASE_STORAGE_BUCKET: 'demo-project.appspot.com',
      FIREBASE_MESSAGING_SENDER_ID: '111',
      FIREBASE_APP_ID: '1:111:ios:abc',
      GOOGLE_OAUTH_CLIENT_ID: '111-ios.apps.googleusercontent.com',
      GOOGLE_WEB_CLIENT_ID: '',
    });
  });

  it("reads the Android app registered to the app's package, with the web client", () => {
    expect(firebaseServiceConfig('android', FILES, root)).toMatchObject({
      FIREBASE_API_KEY: 'android-api-key',
      FIREBASE_APP_ID: '1:111:android:app',
      FIREBASE_MESSAGING_SENDER_ID: '111',
      GOOGLE_WEB_CLIENT_ID: '111-web.apps.googleusercontent.com',
    });
  });

  it('refuses a google-services.json with no client for the package', () => {
    expect(() =>
      firebaseServiceConfig('android', { ...FILES, androidPackage: 'com.nope' }, root)
    ).toThrow('com.nope');
  });

  it('gives macOS and Windows the iOS file', () => {
    expect(firebaseServiceConfig('macos', FILES, root)).toEqual(
      firebaseServiceConfig('ios', FILES, root)
    );
    expect(firebaseServiceConfig('windows', FILES, root)).toEqual(
      firebaseServiceConfig('ios', FILES, root)
    );
  });

  it('has nothing for an unknown platform', () => {
    expect(firebaseServiceConfig(null as never, FILES, root)).toBeNull();
  });
});

describe('firebaseServiceConfigPlugin', () => {
  it("inlines each platform's own values", () => {
    const ios = transform('ios');
    expect(ios).toContain('"ios-api-key"');
    expect(ios).toContain('"demo-project.firebaseapp.com"');
    expect(ios).toContain('"1:111:ios:abc"');
    const android = transform('android');
    expect(android).toContain('"android-api-key"');
    expect(android).toContain('"111-web.apps.googleusercontent.com"');
  });

  it('leaves every other process.env name alone', () => {
    expect(transform('ios')).toContain('process.env.FIREBASE_PROXY');
  });

  it('inlines undefined with no platform (jest), so defaults apply', () => {
    const none = transform(undefined);
    expect(none).not.toContain('process.env.FIREBASE_API_KEY');
    expect(none).toContain('apiKey: undefined ??');
  });
});
