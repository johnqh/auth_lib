import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  getFirebaseProxyOrigin,
  installFirebaseProxy,
  isFirebaseReachable,
  rewriteFirebaseProxyUrl,
} from './firebase-proxy';

const PROXY = 'https://fb-api.example.com';

describe('rewriteFirebaseProxyUrl', () => {
  it('rewrites identitytoolkit URLs preserving path and query', () => {
    expect(
      rewriteFirebaseProxyUrl(
        'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=abc',
        PROXY
      )
    ).toBe(`${PROXY}/identitytoolkit/v1/accounts:signInWithPassword?key=abc`);
  });

  it('rewrites securetoken, remoteconfig, and installations hosts', () => {
    expect(
      rewriteFirebaseProxyUrl(
        'https://securetoken.googleapis.com/v1/token?key=k',
        PROXY
      )
    ).toBe(`${PROXY}/securetoken/v1/token?key=k`);
    expect(
      rewriteFirebaseProxyUrl(
        'https://firebaseremoteconfig.googleapis.com/v1/projects/p/namespaces/firebase:fetch',
        PROXY
      )
    ).toBe(`${PROXY}/remoteconfig/v1/projects/p/namespaces/firebase:fetch`);
    expect(
      rewriteFirebaseProxyUrl(
        'https://firebaseinstallations.googleapis.com/v1/projects/p/installations',
        PROXY
      )
    ).toBe(`${PROXY}/installations/v1/projects/p/installations`);
  });

  it('maps all analytics hosts to the /ga prefix', () => {
    for (const host of [
      'www.google-analytics.com',
      'region1.google-analytics.com',
      'analytics.google.com',
    ]) {
      expect(
        rewriteFirebaseProxyUrl(`https://${host}/g/collect?v=2`, PROXY)
      ).toBe(`${PROXY}/ga/g/collect?v=2`);
    }
  });

  it('tolerates a trailing slash on the proxy origin', () => {
    expect(
      rewriteFirebaseProxyUrl(
        'https://securetoken.googleapis.com/v1/token',
        `${PROXY}/`
      )
    ).toBe(`${PROXY}/securetoken/v1/token`);
  });

  it('leaves unrelated hosts and unparseable strings unchanged', () => {
    expect(
      rewriteFirebaseProxyUrl('https://api.example.com/v1/users', PROXY)
    ).toBe('https://api.example.com/v1/users');
    expect(rewriteFirebaseProxyUrl('/relative/path', PROXY)).toBe(
      '/relative/path'
    );
  });
});

describe('installFirebaseProxy', () => {
  const fetchMock = vi.fn(async () => new Response('ok'));
  const sendBeaconMock = vi.fn(() => true);

  // Module-level singleton: stub globals and install exactly once, and keep
  // the stubs in place for the whole suite — unstubbing between tests would
  // remove the installed wrapper, and a second install is a no-op.
  beforeAll(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', { sendBeacon: sendBeaconMock });
    installFirebaseProxy(PROXY);
  });

  beforeEach(() => {
    fetchMock.mockClear();
    sendBeaconMock.mockClear();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('records the installed proxy origin and ignores repeat installs', () => {
    expect(getFirebaseProxyOrigin()).toBe(PROXY);
    installFirebaseProxy('https://other.example.com');
    expect(getFirebaseProxyOrigin()).toBe(PROXY);
  });

  it('rewrites string URLs passed to fetch', async () => {
    await fetch(
      'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=k'
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `${PROXY}/identitytoolkit/v1/accounts:lookup?key=k`,
      undefined
    );
  });

  it('rewrites URL objects passed to fetch', async () => {
    await fetch(new URL('https://securetoken.googleapis.com/v1/token?key=k'));
    expect(fetchMock).toHaveBeenCalledWith(
      `${PROXY}/securetoken/v1/token?key=k`,
      undefined
    );
  });

  it('rewrites Request objects while preserving method and headers', async () => {
    await fetch(
      new Request(
        'https://firebaseinstallations.googleapis.com/v1/projects/p/installations',
        {
          method: 'POST',
          headers: { 'x-goog-api-key': 'k' },
        }
      )
    );
    const forwarded = fetchMock.mock.calls[0]?.[0] as Request;
    expect(forwarded).toBeInstanceOf(Request);
    expect(forwarded.url).toBe(
      `${PROXY}/installations/v1/projects/p/installations`
    );
    expect(forwarded.method).toBe('POST');
    expect(forwarded.headers.get('x-goog-api-key')).toBe('k');
  });

  it('passes unrelated requests through untouched', async () => {
    await fetch('https://api.example.com/v1/users');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/v1/users',
      undefined
    );

    const unrelated = new Request('https://api.example.com/v1/users');
    await fetch(unrelated);
    expect(fetchMock).toHaveBeenLastCalledWith(unrelated, undefined);
  });

  it('rewrites navigator.sendBeacon URLs', () => {
    navigator.sendBeacon(
      'https://www.google-analytics.com/g/collect?v=2',
      'payload'
    );
    expect(sendBeaconMock).toHaveBeenCalledWith(
      `${PROXY}/ga/g/collect?v=2`,
      'payload'
    );
  });
});

describe('isFirebaseReachable', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true when the probe request succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 }))
    );
    await expect(isFirebaseReachable()).resolves.toBe(true);
  });

  it('returns false when the probe request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('network error');
      })
    );
    await expect(isFirebaseReachable()).resolves.toBe(false);
  });
});
