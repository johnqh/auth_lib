import { afterEach, describe, expect, it, vi } from 'vitest';

/** Fresh module per test — the proxy module keeps singleton state. */
async function freshModules() {
  vi.resetModules();
  const proxy = await import('./firebase-proxy');
  const providers = await import('./firebase-proxy-providers');
  return { proxy, providers };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('filterAuthProvidersForProxy', () => {
  it('returns the list unchanged while the proxy is off', async () => {
    const { providers } = await freshModules();
    expect(
      providers.filterAuthProvidersForProxy(['google', 'apple', 'email'])
    ).toEqual(['google', 'apple', 'email']);
  });

  it('drops non-Apple OAuth providers while the proxy is on', async () => {
    const { proxy, providers } = await freshModules();
    proxy.forceFirebaseProxy();
    expect(
      providers.filterAuthProvidersForProxy(['google', 'apple', 'email'])
    ).toEqual(['apple', 'email']);
  });

  it('keeps non-OAuth entries (email, anonymous) while the proxy is on', async () => {
    const { proxy, providers } = await freshModules();
    proxy.forceFirebaseProxy();
    expect(providers.filterAuthProvidersForProxy(['google', 'email'])).toEqual([
      'email',
    ]);
  });

  it('drops other blocked OAuth vendors too, not just google', async () => {
    const { proxy, providers } = await freshModules();
    proxy.forceFirebaseProxy();
    expect(
      providers.filterAuthProvidersForProxy([
        'facebook',
        'github',
        'twitter',
        'microsoft',
        'yahoo',
        'apple',
      ])
    ).toEqual(['apple']);
  });

  it('honors an explicit proxyActive override regardless of state', async () => {
    const { providers } = await freshModules();
    expect(
      providers.filterAuthProvidersForProxy(['google', 'apple'], true)
    ).toEqual(['apple']);
    expect(
      providers.filterAuthProvidersForProxy(['google', 'apple'], false)
    ).toEqual(['google', 'apple']);
  });

  it('reflects the proxy turning back off', async () => {
    const { proxy, providers } = await freshModules();
    proxy.forceFirebaseProxy();
    proxy.disableFirebaseProxy();
    expect(
      providers.filterAuthProvidersForProxy(['google', 'apple', 'email'])
    ).toEqual(['google', 'apple', 'email']);
  });
});
