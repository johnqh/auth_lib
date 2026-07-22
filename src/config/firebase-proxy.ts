/**
 * @fileoverview Firebase reverse-proxy shim for regions where
 * *.googleapis.com is blocked (e.g. mainland China).
 *
 * The Firebase JS SDK hardcodes Google hostnames, so this module intercepts
 * fetch() (and navigator.sendBeacon for Analytics) and rewrites known Firebase
 * hosts to path prefixes on a reverse proxy. The proxy routes each prefix
 * back to the corresponding Google host:
 *
 *   /identitytoolkit -> identitytoolkit.googleapis.com        (Auth)
 *   /securetoken     -> securetoken.googleapis.com            (token refresh)
 *   /remoteconfig    -> firebaseremoteconfig.googleapis.com   (Remote Config)
 *   /installations   -> firebaseinstallations.googleapis.com  (FIS)
 *   /gtm             -> www.googletagmanager.com              (gtag.js)
 *   /ga              -> region1.google-analytics.com          (Analytics collect)
 *
 * AUTOMATIC MODE: importing @sudobility/auth_lib runs
 * autoConfigureFirebaseProxy() as a side effect (see firebase-proxy-auto.ts).
 * Detection order:
 *   1. Cached probe result (localStorage, 24h TTL) applies instantly.
 *   2. China timezone heuristic pre-enables the proxy instantly (no cache yet).
 *   3. A reachability probe against Google confirms or corrects the decision
 *      and refreshes the cache.
 * Consumers therefore need no code changes. Set
 * globalThis.__SUDOBILITY_FIREBASE_PROXY_DISABLED = true before importing
 * the library to opt out entirely.
 *
 * JS-level only: on React Native this covers fetch-based Firebase usage, but
 * traffic from @react-native-firebase native SDKs cannot be redirected here.
 */

/** Default reverse proxy operated by Sudobility. */
export const DEFAULT_FIREBASE_PROXY_ORIGIN =
  'https://firebaseproxy.sudobility.com';

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

/**
 * Probe URL: a Google host that is blocked alongside the Firebase endpoints
 * but deliberately NOT in HOST_TO_PREFIX, so the probe always measures the
 * direct route even while the proxy is active.
 */
const PROBE_URL = 'https://www.googleapis.com/generate_204';

/** Mainland-China timezones (GFW scope) — HK/Macau/Taipei excluded. */
const CHINA_TIMEZONES = new Set([
  'Asia/Shanghai',
  'Asia/Urumqi',
  'Asia/Chongqing',
  'Asia/Harbin',
  'Asia/Kashgar',
]);

const CACHE_KEY = 'sudobility.firebase-proxy.blocked';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

declare global {
  /**
   * Testing escape hatch, symmetric to __SUDOBILITY_FIREBASE_PROXY_DISABLED:
   * set to `true` (default proxy) or a proxy origin string BEFORE importing
   * the library to force the proxy on even where Google is reachable.
   */
  var __SUDOBILITY_FIREBASE_PROXY_FORCED: boolean | string | undefined;
}

let activeProxyOrigin: string | null = null;
let wrapperInstalled = false;
let autoConfigurePromise: Promise<boolean> | null = null;
let forcedByCaller = false;

/** Proxy origin demanded via the global escape hatch, or null. */
function forcedOriginFromGlobal(): string | null {
  const v = globalThis.__SUDOBILITY_FIREBASE_PROXY_FORCED;
  if (v === true) {
    return DEFAULT_FIREBASE_PROXY_ORIGIN;
  }
  if (typeof v === 'string' && v) {
    return v;
  }
  return null;
}

/** True while any force (runtime call or global) is in effect. */
function isProxyForced(): boolean {
  return forcedByCaller || forcedOriginFromGlobal() !== null;
}

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

/** Rewrite against the currently active proxy origin (identity when off). */
function rewriteActive(rawUrl: string): string {
  return activeProxyOrigin
    ? rewriteFirebaseProxyUrl(rawUrl, activeProxyOrigin)
    : rawUrl;
}

/**
 * Patch globalThis.fetch and navigator.sendBeacon once. The wrapper is a
 * pass-through while no proxy origin is active, so it is safe to install
 * eagerly and toggle routing on/off afterwards.
 */
function ensureWrapperInstalled(): void {
  if (wrapperInstalled) {
    return;
  }
  wrapperInstalled = true;

  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string') {
      return originalFetch(rewriteActive(input), init);
    }
    if (input instanceof URL) {
      return originalFetch(rewriteActive(input.href), init);
    }
    if (input instanceof Request) {
      const rewritten = rewriteActive(input.url);
      return rewritten === input.url
        ? originalFetch(input, init)
        : originalFetch(new Request(rewritten, input), init);
    }
    return originalFetch(input as RequestInfo, init);
  }) as typeof fetch;

  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const originalSendBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) =>
      originalSendBeacon(rewriteActive(String(url)), data);
  }
}

/**
 * Route Firebase SDK traffic through the given reverse proxy. Idempotent
 * while a proxy is active: subsequent calls are no-ops (first origin wins).
 *
 * With automatic mode this is called for you; call it directly only to
 * force the proxy on (e.g. for testing).
 *
 * @param proxyOrigin - Proxy origin; defaults to the Sudobility proxy
 */
export function installFirebaseProxy(
  proxyOrigin: string = DEFAULT_FIREBASE_PROXY_ORIGIN
): void {
  if (activeProxyOrigin) {
    return;
  }
  activeProxyOrigin = proxyOrigin;
  ensureWrapperInstalled();
}

/**
 * Force the proxy ON for testing, even where Google is directly reachable.
 * Unlike installFirebaseProxy() this overrides an already-active origin and
 * survives autoConfigureFirebaseProxy()'s reachability probe (which would
 * otherwise switch the proxy back off). Undo with disableFirebaseProxy().
 *
 * Import-time alternative: set
 * globalThis.__SUDOBILITY_FIREBASE_PROXY_FORCED = true (or a proxy origin
 * string) before importing the library.
 *
 * @param proxyOrigin - Proxy origin; defaults to the Sudobility proxy
 */
export function forceFirebaseProxy(
  proxyOrigin: string = DEFAULT_FIREBASE_PROXY_ORIGIN
): void {
  forcedByCaller = true;
  activeProxyOrigin = proxyOrigin;
  ensureWrapperInstalled();
}

/**
 * Stop routing through the proxy. The fetch wrapper stays installed as a
 * transparent pass-through; a later installFirebaseProxy() re-enables it.
 * Also clears a forceFirebaseProxy() force (an explicit call wins); a force
 * set via the __SUDOBILITY_FIREBASE_PROXY_FORCED global must be unset there.
 */
export function disableFirebaseProxy(): void {
  forcedByCaller = false;
  activeProxyOrigin = null;
}

/**
 * Check whether the proxy is active.
 *
 * @returns The active proxy origin, or null when traffic goes direct
 */
export function getFirebaseProxyOrigin(): string | null {
  return activeProxyOrigin;
}

/**
 * Heuristic: is this device likely inside mainland China? Based on the
 * device timezone; instant and offline, used to pre-enable the proxy before
 * the network probe completes on first launch.
 */
export function isLikelyChinaRegion(): boolean {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return timeZone ? CHINA_TIMEZONES.has(timeZone) : false;
  } catch {
    return false;
  }
}

/**
 * Probe whether Google's endpoints are directly reachable. Resolves true if
 * the network path works (an opaque no-cors response still counts), false on
 * timeout or network error — i.e. false means "behind the block".
 *
 * Always measures the direct route: the probe host is intentionally not one
 * the proxy shim rewrites.
 *
 * @param timeoutMs - How long to wait before assuming blocked (default 3000)
 */
export async function isFirebaseReachable(timeoutMs = 3000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(PROBE_URL, {
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

/** Read the cached probe verdict; null when absent, stale, or unavailable. */
function readCachedBlocked(): boolean | null {
  try {
    const raw = globalThis.localStorage?.getItem(CACHE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { blocked: boolean; ts: number };
    if (typeof parsed.blocked !== 'boolean' || typeof parsed.ts !== 'number') {
      return null;
    }
    if (Date.now() - parsed.ts > CACHE_TTL_MS) {
      return null;
    }
    return parsed.blocked;
  } catch {
    return null; // no localStorage (React Native, SSR) or corrupt entry
  }
}

/** Persist the probe verdict; silently no-op where storage is unavailable. */
function writeCachedBlocked(blocked: boolean): void {
  try {
    globalThis.localStorage?.setItem(
      CACHE_KEY,
      JSON.stringify({ blocked, ts: Date.now() })
    );
  } catch {
    // ignore
  }
}

/**
 * Detect test runners (vitest, jest, NODE_ENV=test) so the import-time
 * auto-configuration never fires real network probes inside a test suite.
 * Tests exercising the proxy call autoConfigureFirebaseProxy() explicitly
 * with stubbed fetch.
 */
export function isTestEnvironment(): boolean {
  const env = (
    globalThis as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env;
  return !!(
    env &&
    (env.VITEST || env.JEST_WORKER_ID || env.NODE_ENV === 'test')
  );
}

export interface AutoConfigureFirebaseProxyOptions {
  /** Proxy origin to use when blocked; defaults to the Sudobility proxy. */
  proxyOrigin?: string;
  /** Probe timeout in ms (default 3000). */
  probeTimeoutMs?: number;
}

/**
 * Decide automatically whether Firebase traffic needs the reverse proxy and
 * configure the shim accordingly. Memoized: concurrent and repeat calls share
 * one detection run per session.
 *
 * Strategy:
 *   1. A fresh cached verdict (24h) applies immediately.
 *   2. Otherwise, a mainland-China timezone pre-enables the proxy so first
 *      requests aren't lost while probing.
 *   3. The reachability probe then confirms or corrects the decision and
 *      refreshes the cache — including turning the proxy back off when
 *      Google became directly reachable again.
 *
 * Runs automatically on library import (web and RN entries); await it
 * directly if you want to block until the routing decision is final.
 *
 * @returns true when traffic is routed through the proxy
 */
export function autoConfigureFirebaseProxy(
  options: AutoConfigureFirebaseProxyOptions = {}
): Promise<boolean> {
  autoConfigurePromise ??= runAutoConfigure(options);
  return autoConfigurePromise;
}

async function runAutoConfigure(
  options: AutoConfigureFirebaseProxyOptions
): Promise<boolean> {
  if (typeof fetch === 'undefined') {
    return false; // no network layer to patch (SSR without fetch)
  }
  const proxyOrigin = options.proxyOrigin ?? DEFAULT_FIREBASE_PROXY_ORIGIN;

  // A force (testing escape hatch) short-circuits detection entirely: the
  // proxy goes on, no probe runs, and nothing here will turn it back off.
  const forcedOrigin = forcedOriginFromGlobal();
  if (forcedOrigin || forcedByCaller) {
    forceFirebaseProxy(forcedOrigin ?? proxyOrigin);
    return true;
  }

  // Fast path: apply the cached verdict (or the timezone heuristic on a
  // cache miss) immediately, so a blocked device doesn't leak its first
  // requests to the direct route while the probe is in flight.
  const cachedBlocked = readCachedBlocked();
  if (
    cachedBlocked === true ||
    (cachedBlocked === null && isLikelyChinaRegion())
  ) {
    installFirebaseProxy(proxyOrigin);
  }

  const reachable = await isFirebaseReachable(options.probeTimeoutMs);
  writeCachedBlocked(!reachable);

  // A force applied while the probe was in flight also wins over its verdict.
  if (isProxyForced()) {
    return true;
  }
  if (reachable) {
    disableFirebaseProxy();
  } else {
    installFirebaseProxy(proxyOrigin);
  }
  return !reachable;
}
