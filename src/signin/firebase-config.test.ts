/**
 * Firebase's configuration for the JS SDK on iOS and Android, from what
 * native Firebase read out of the services files.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  firebaseConfigFromNativeOptions,
  googleWebClientIdFromServicesJson,
  loadServiceFileFirebaseConfig,
} from './firebase-config';

const IOS_OPTIONS = {
  apiKey: 'ios-key',
  appId: '1:111:ios:abc',
  projectId: 'demo',
  storageBucket: 'demo.appspot.com',
  messagingSenderId: '111',
  clientId: '111-ios.apps.googleusercontent.com',
};

const SERVICES_JSON = {
  project_info: { project_number: '111', project_id: 'demo' },
  client: [
    {
      oauth_client: [
        { client_id: '111-android.apps.googleusercontent.com', client_type: 1 },
      ],
      services: {
        appinvite_service: {
          other_platform_oauth_client: [
            { client_id: '111-web.apps.googleusercontent.com', client_type: 3 },
            { client_id: '111-ios.apps.googleusercontent.com', client_type: 2 },
          ],
        },
      },
    },
  ],
};

describe('firebaseConfigFromNativeOptions', () => {
  it("maps native options to the JS SDK's config, deriving the auth domain", () => {
    expect(firebaseConfigFromNativeOptions(IOS_OPTIONS)).toEqual({
      firebase: {
        apiKey: 'ios-key',
        authDomain: 'demo.firebaseapp.com',
        projectId: 'demo',
        storageBucket: 'demo.appspot.com',
        messagingSenderId: '111',
        appId: '1:111:ios:abc',
        measurementId: '',
      },
      googleIosClientId: '111-ios.apps.googleusercontent.com',
      googleWebClientId: '',
    });
  });

  it("takes Android's web client from google-services.json", () => {
    const { googleWebClientId, googleIosClientId } =
      firebaseConfigFromNativeOptions(
        { appId: '1:111:android:x', projectId: 'demo' },
        SERVICES_JSON
      );
    expect(googleWebClientId).toBe('111-web.apps.googleusercontent.com');
    expect(googleIosClientId).toBe('');
  });
});

describe('googleWebClientIdFromServicesJson', () => {
  it('is empty for a file with no web client, or no file', () => {
    expect(googleWebClientIdFromServicesJson({ client: [{}] })).toBe('');
    expect(googleWebClientIdFromServicesJson(null)).toBe('');
  });
});

describe('loadServiceFileFirebaseConfig', () => {
  it('asks native Firebase for its options, once per call', async () => {
    const nativeFirebaseOptions = vi.fn(() => IOS_OPTIONS);
    const config = await loadServiceFileFirebaseConfig({
      nativeFirebaseOptions,
    });
    expect(nativeFirebaseOptions).toHaveBeenCalledTimes(1);
    expect(config.firebase.apiKey).toBe('ios-key');
  });
});
