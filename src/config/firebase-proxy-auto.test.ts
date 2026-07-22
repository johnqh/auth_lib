import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The proxy module keeps singleton state (active origin, memoized detection
 * run, fetch wrapper), so every test imports a fresh module instance.
 */
async function freshModule() {
  vi.resetModules();
  return await import('./firebase-proxy');
}

function stubTimezone(timeZone: string): void {
  vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
    resolvedOptions: () => ({ timeZone }),
  } as unknown as Intl.DateTimeFormat);
}

function makeMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size;
    },
  } as Storage;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('isLikelyChinaRegion', () => {
  it('returns true for mainland-China timezones', async () => {
    const mod = await freshModule();
    stubTimezone('Asia/Shanghai');
    expect(mod.isLikelyChinaRegion()).toBe(true);
  });

  it('returns false for Hong Kong, Taipei, and elsewhere', async () => {
    const mod = await freshModule();
    for (const tz of ['Asia/Hong_Kong', 'Asia/Taipei', 'America/Los_Angeles']) {
      stubTimezone(tz);
      expect(mod.isLikelyChinaRegion()).toBe(false);
      vi.restoreAllMocks();
    }
  });

  it('returns false when Intl is unavailable', async () => {
    const mod = await freshModule();
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('no Intl');
    });
    expect(mod.isLikelyChinaRegion()).toBe(false);
  });
});

describe('autoConfigureFirebaseProxy', () => {
  it('installs the default proxy when the probe fails', async () => {
    const mod = await freshModule();
    stubTimezone('America/Los_Angeles');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('network error');
      })
    );

    await expect(mod.autoConfigureFirebaseProxy()).resolves.toBe(true);
    expect(mod.getFirebaseProxyOrigin()).toBe(
      mod.DEFAULT_FIREBASE_PROXY_ORIGIN
    );
  });

  it('honors a custom proxy origin', async () => {
    const mod = await freshModule();
    stubTimezone('America/Los_Angeles');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('network error');
      })
    );

    await mod.autoConfigureFirebaseProxy({
      proxyOrigin: 'https://own.example.com',
    });
    expect(mod.getFirebaseProxyOrigin()).toBe('https://own.example.com');
  });

  it('leaves traffic direct when Google is reachable', async () => {
    const mod = await freshModule();
    stubTimezone('America/Los_Angeles');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 }))
    );

    await expect(mod.autoConfigureFirebaseProxy()).resolves.toBe(false);
    expect(mod.getFirebaseProxyOrigin()).toBeNull();
  });

  it('memoizes: repeat calls share one detection run', async () => {
    const mod = await freshModule();
    stubTimezone('America/Los_Angeles');
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await Promise.all([
      mod.autoConfigureFirebaseProxy(),
      mod.autoConfigureFirebaseProxy(),
    ]);
    await mod.autoConfigureFirebaseProxy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('pre-enables the proxy for China timezones, then corrects when the probe succeeds', async () => {
    const mod = await freshModule();
    stubTimezone('Asia/Shanghai');

    let resolveProbe!: (value: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(resolve => (resolveProbe = resolve)))
    );

    const pending = mod.autoConfigureFirebaseProxy();
    // Probe still in flight — proxy already active from the tz heuristic.
    expect(mod.getFirebaseProxyOrigin()).toBe(
      mod.DEFAULT_FIREBASE_PROXY_ORIGIN
    );

    resolveProbe(new Response(null, { status: 204 }));
    await expect(pending).resolves.toBe(false);
    // Probe proved direct access works — proxy switched back off.
    expect(mod.getFirebaseProxyOrigin()).toBeNull();
  });

  it('applies a cached blocked verdict immediately on the next launch', async () => {
    const storage = makeMemoryStorage();

    // First launch: probe fails, verdict cached.
    vi.stubGlobal('localStorage', storage);
    stubTimezone('America/Los_Angeles');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('network error');
      })
    );
    const first = await freshModule();
    await first.autoConfigureFirebaseProxy();

    // Second launch (fresh module, same storage): proxy active before the
    // probe resolves, even without the China-timezone hint.
    const second = await freshModule();
    vi.stubGlobal('localStorage', storage);
    stubTimezone('America/Los_Angeles');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {}))
    );

    void second.autoConfigureFirebaseProxy();
    expect(second.getFirebaseProxyOrigin()).toBe(
      second.DEFAULT_FIREBASE_PROXY_ORIGIN
    );
  });

  it('keeps a forced proxy on even when the probe succeeds', async () => {
    const mod = await freshModule();
    stubTimezone('America/Los_Angeles');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 }))
    );

    mod.forceFirebaseProxy();
    await expect(mod.autoConfigureFirebaseProxy()).resolves.toBe(true);
    expect(mod.getFirebaseProxyOrigin()).toBe(
      mod.DEFAULT_FIREBASE_PROXY_ORIGIN
    );
  });

  it('keeps a proxy forced mid-probe on when the in-flight probe succeeds', async () => {
    const mod = await freshModule();
    stubTimezone('America/Los_Angeles');
    let resolveProbe!: (value: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(resolve => (resolveProbe = resolve)))
    );

    const pending = mod.autoConfigureFirebaseProxy();
    mod.forceFirebaseProxy('https://own.example.com');
    resolveProbe(new Response(null, { status: 204 }));

    await pending;
    expect(mod.getFirebaseProxyOrigin()).toBe('https://own.example.com');
  });

  it('honors globalThis.__SUDOBILITY_FIREBASE_PROXY_FORCED = true without probing', async () => {
    const mod = await freshModule();
    stubTimezone('America/Los_Angeles');
    vi.stubGlobal('__SUDOBILITY_FIREBASE_PROXY_FORCED', true);
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(mod.autoConfigureFirebaseProxy()).resolves.toBe(true);
    expect(mod.getFirebaseProxyOrigin()).toBe(
      mod.DEFAULT_FIREBASE_PROXY_ORIGIN
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses a string __SUDOBILITY_FIREBASE_PROXY_FORCED as the proxy origin', async () => {
    const mod = await freshModule();
    stubTimezone('America/Los_Angeles');
    vi.stubGlobal(
      '__SUDOBILITY_FIREBASE_PROXY_FORCED',
      'https://own.example.com'
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 }))
    );

    await expect(mod.autoConfigureFirebaseProxy()).resolves.toBe(true);
    expect(mod.getFirebaseProxyOrigin()).toBe('https://own.example.com');
  });

  it('an explicit disableFirebaseProxy() overrides a runtime force', async () => {
    const mod = await freshModule();
    mod.forceFirebaseProxy();
    mod.disableFirebaseProxy();
    expect(mod.getFirebaseProxyOrigin()).toBeNull();
  });

  it('ignores an expired cached verdict', async () => {
    const storage = makeMemoryStorage();
    storage.setItem(
      'sudobility.firebase-proxy.blocked',
      JSON.stringify({ blocked: true, ts: Date.now() - 25 * 60 * 60 * 1000 })
    );
    vi.stubGlobal('localStorage', storage);
    stubTimezone('America/Los_Angeles');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {}))
    );

    const mod = await freshModule();
    void mod.autoConfigureFirebaseProxy();
    // Stale cache + non-China tz: no pre-enable while the probe runs.
    expect(mod.getFirebaseProxyOrigin()).toBeNull();
  });
});
