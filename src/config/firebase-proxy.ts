/**
 * @fileoverview Firebase reverse-proxy shim for regions where
 * *.googleapis.com is blocked (e.g. mainland China).
 *
 * The Firebase JS SDK hardcodes Google hostnames, so this module intercepts
 * fetch() (and navigator.sendBeacon for Analytics) and rewrites known Firebase
 * hosts to path prefixes on a reverse proxy you control. The proxy must route
 * each prefix back to the corresponding Google host:
 *
 *   /identitytoolkit -> identitytoolkit.googleapis.com        (Auth)
 *   /securetoken     -> securetoken.googleapis.com            (token refresh)
 *   /remoteconfig    -> firebaseremoteconfig.googleapis.com   (Remote Config)
 *   /installations   -> firebaseinstallations.googleapis.com  (FIS)
 *   /gtm             -> www.googletagmanager.com              (gtag.js)
 *   /ga              -> region1.google-analytics.com          (Analytics collect)
 *
 * IMPORTANT: installFirebaseProxy() must be called BEFORE Firebase is
 * initialized (i.e. before initializeWebApp() from @sudobility/di_web).
 *
 * Web only. React Native apps using @react-native-firebase talk to Google
 * from native code and are not affected by this shim.
 */

const HOST_TO_PREFIX: Record<string, string> = {
  'identitytoolkit.googleapis.com': 'identitytoolkit',
  'securetoken.googleapis.com': 'securetoken',
  'firebaseremoteconfig.googleapis.com': 'remoteconfig',
  'firebaseinstallations.googleapis.com': 'installations',
  'www.googletagmanager.com': 'gtm',
  'www.google-analytics.com': 'ga',
  'region1.google-analytics.com': 'ga',
  'analytics.google.com': 'ga',
};

let installedProxyOrigin: string | null = null;

/**
 * Rewrite a URL pointing at a known Firebase/Google host to the equivalent
 * proxy URL. URLs for other hosts (and unparseable strings) are returned
 * unchanged.
 *
 * @param rawUrl - Absolute URL the SDK is about to request
 * @param proxyOrigin - Proxy origin, e.g. 'https://fb-api.example.com'
 * @returns The proxied URL, or the input unchanged if no mapping applies
 */
export function rewriteFirebaseProxyUrl(
  rawUrl: string,
  proxyOrigin: string
): string {
  try {
    const url = new URL(rawUrl);
    const prefix = HOST_TO_PREFIX[url.hostname];
    if (!prefix) {
      return rawUrl;
    }
    const base = proxyOrigin.replace(/\/$/, '');
    return `${base}/${prefix}${url.pathname}${url.search}`;
  } catch {
    return rawUrl;
  }
}

/**
 * Check whether the proxy shim has been installed.
 *
 * @returns The proxy origin passed to installFirebaseProxy(), or null
 */
export function getFirebaseProxyOrigin(): string | null {
  return installedProxyOrigin;
}

/**
 * Patch globalThis.fetch and navigator.sendBeacon so Firebase SDK traffic is
 * routed through the given reverse proxy. Idempotent: subsequent calls are
 * no-ops (the first proxy origin wins).
 *
 * Call this BEFORE Firebase is initialized.
 *
 * @param proxyOrigin - Proxy origin, e.g. 'https://fb-api.example.com'
 */
export function installFirebaseProxy(proxyOrigin: string): void {
  if (installedProxyOrigin) {
    return;
  }
  installedProxyOrigin = proxyOrigin;

  const rewrite = (rawUrl: string): string =>
    rewriteFirebaseProxyUrl(rawUrl, proxyOrigin);

  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string') {
      return originalFetch(rewrite(input), init);
    }
    if (input instanceof URL) {
      return originalFetch(rewrite(input.href), init);
    }
    if (input instanceof Request) {
      const rewritten = rewrite(input.url);
      return rewritten === input.url
        ? originalFetch(input, init)
        : originalFetch(new Request(rewritten, input), init);
    }
    return originalFetch(input as RequestInfo, init);
  }) as typeof fetch;

  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const originalSendBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) =>
      originalSendBeacon(rewrite(String(url)), data);
  }
}

/**
 * Probe whether Google's Firebase endpoints are directly reachable. Resolves
 * true if the network path works (an opaque no-cors response still counts),
 * false on timeout or network error — i.e. false means "behind the block,
 * install the proxy".
 *
 * Typical usage:
 *   if (!(await isFirebaseReachable())) {
 *     installFirebaseProxy('https://fb-api.example.com');
 *   }
 *
 * @param timeoutMs - How long to wait before assuming blocked (default 3000)
 */
export async function isFirebaseReachable(timeoutMs = 3000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch('https://firebaseinstallations.googleapis.com/generate_204', {
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
