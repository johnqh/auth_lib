# auth_lib - AI Development Guide

## Overview

Firebase authentication library providing configurable auth initialization, resilient network clients with automatic token refresh and logout handling, admin utilities, and React hooks for auth state management. Supports both web (Firebase JS SDK) and React Native (@react-native-firebase) platforms through conditional entry points.

- **Package**: `@sudobility/auth_lib`
- **Version**: 0.0.47
- **License**: BUSL-1.1
- **Package Manager**: Bun
- **Registry**: npm (public)
- **Repository**: https://github.com/sudobility/auth_lib.git

## Project Structure

```
src/
├── index.ts                                  # Web entry point (exports all public API)
├── index.rn.ts                               # React Native entry point (parallel exports using RN-specific modules)
├── admin/
│   └── index.ts                              # Re-exports parseAdminEmails, isAdminEmail, createAdminChecker from @sudobility/types
├── config/
│   ├── index.ts                              # Config barrel exports
│   ├── types.ts                              # FirebaseInitResult, FirebaseAuthNetworkClientOptions interfaces
│   ├── firebase-init.ts                      # Web Firebase init (singleton, uses firebase/app + firebase/auth)
│   ├── firebase-init.rn.ts                   # React Native Firebase init (lazy-loads @react-native-firebase modules)
│   └── firebase-init.test.ts                 # Tests for firebase-init
├── hooks/
│   ├── index.ts                              # Hooks barrel exports
│   ├── useFirebaseAuthNetworkClient.ts       # Hook + factory for auth-aware NetworkClient (401 retry, 403 logout)
│   ├── useFirebaseAuthNetworkClient.test.ts  # Tests for useFirebaseAuthNetworkClient
│   └── useSiteAdmin.ts                       # Hook for site admin check via TanStack Query
├── network/
│   ├── index.ts                              # Network barrel exports
│   ├── FirebaseAuthNetworkService.ts         # Web: extends WebNetworkClient with 401 retry + token cache
│   └── FirebaseAuthNetworkService.rn.ts      # RN: extends RNNetworkService with 401 retry + 403 logout
└── utils/
    ├── index.ts                              # Utils barrel exports
    ├── firebase-errors.ts                    # Firebase error code-to-message mapping utilities
    └── firebase-errors.test.ts               # Tests for firebase-errors
```

## Key Exports

### Firebase Initialization (`config/`)
| Export | Type | Description |
|---|---|---|
| `initializeFirebaseAuth()` | function | Initialize Firebase Auth using existing Firebase app (singleton). Web version expects `@sudobility/di/web` to have initialized Firebase first. |
| `getFirebaseApp()` | function | Get cached FirebaseApp instance (or null) |
| `getFirebaseAuth()` | function | Get cached Auth instance (or null) |
| `isFirebaseConfigured()` | function | Check if Firebase app is initialized |
| `FirebaseInitResult` | type | `{ app: FirebaseApp; auth: Auth }` |
| `FirebaseAuthNetworkClientOptions` | type | `{ onLogout?: () => void; onTokenRefreshFailed?: (error: unknown) => void }` |

### Hooks (`hooks/`)
| Export | Type | Description |
|---|---|---|
| `useFirebaseAuthNetworkClient(options?)` | React hook | Returns memoized `NetworkClient` with 401 auto-retry (force token refresh) and 403 auto-logout |
| `createFirebaseAuthNetworkClient(platformNetwork?, options?)` | factory function | Non-hook version for use outside React components |
| `useSiteAdmin(options)` | React hook | Fetches user info from backend `/api/v1/users/:userId` and returns `{ isSiteAdmin, userInfo, isLoading, isError, error, refetch }`. Uses TanStack Query with 5-min stale time, 1 retry, no refetch on window focus. |
| `siteAdminQueryKey(userId)` | function | Returns `['siteAdmin', userId]` for TanStack Query cache management |
| `UseSiteAdminOptions` | type | Options: `networkClient`, `baseUrl`, `userId`, `token`, `staleTime?`, `enabled?` |
| `UseSiteAdminResult` | type | Result: `isSiteAdmin`, `userInfo`, `isLoading`, `isError`, `error`, `refetch` |
| `UserInfoResponse` | type | Re-exported from `@sudobility/types` |

### Network Service (`network/`)
| Export | Type | Description |
|---|---|---|
| `FirebaseAuthNetworkService` | class | Web: extends `WebNetworkClient` from `@sudobility/di`. Overrides `request()` with 401 retry + proactive token cache (30s refresh interval). |
| `FirebaseAuthNetworkService` (RN) | class | RN: extends `RNNetworkService` from `@sudobility/di/rn`. Overrides `request()` with 401 retry + 403 logout. |
| `FirebaseAuthNetworkServiceOptions` | type | `{ onLogout?, onTokenRefreshFailed?, tokenRefreshIntervalMs? }` (web adds `tokenRefreshIntervalMs`) |

### Utils (`utils/`)
| Export | Type | Description |
|---|---|---|
| `getFirebaseErrorMessage(code)` | function | Maps Firebase error code (e.g., `'auth/user-not-found'`) to user-friendly string |
| `getFirebaseErrorCode(error)` | function | Extracts `.code` from an error object, returns `''` if not found |
| `formatFirebaseError(error)` | function | Combines `getFirebaseErrorCode` + `getFirebaseErrorMessage` in one call |
| `isFirebaseAuthError(error)` | function | Returns true if error code starts with `'auth/'` |

### Admin (`admin/`)
| Export | Type | Description |
|---|---|---|
| `parseAdminEmails(csv)` | function | Re-exported from `@sudobility/types`. Parse comma-separated admin email string. |
| `isAdminEmail(email, adminSet)` | function | Re-exported from `@sudobility/types`. Check if email is in admin set. |
| `createAdminChecker(csv)` | function | Re-exported from `@sudobility/types`. Returns a function that checks admin status. Deprecated in favor of `useSiteAdmin`. |

## Development Commands

```bash
bun run build          # Compile TypeScript to dist/ via tsc
bun run dev            # Watch mode build (tsc --watch)
bun run clean          # Remove dist/ directory
bun test               # Run tests with Vitest (vitest run)
bun run test:watch     # Run tests in watch mode (vitest)
bun run typecheck      # Type-check without emitting (bunx tsc --noEmit)
bun run lint           # Lint src/ with ESLint
bun run lint:fix       # Auto-fix lint issues
bun run format         # Format src/ with Prettier
bun run prepublishOnly # Build (alias for bun run build, runs before npm publish)
```

## Architecture / Patterns

### Dual Entry Points (Web + React Native)
The package uses conditional exports in `package.json`:
- **Web**: `import` resolves to `dist/index.js` (uses `firebase/app`, `firebase/auth`, `@sudobility/di`)
- **React Native**: `react-native` condition resolves to `dist/index.rn.js` (uses `@react-native-firebase/*`, `@sudobility/di/rn`)

Each platform has its own `firebase-init` and `FirebaseAuthNetworkService` implementation. Hooks and utils are shared across platforms.

### Singleton Firebase Initialization
`firebase-init.ts` (web) stores `firebaseApp` and `firebaseAuth` as module-level singletons. It expects the consuming app to initialize Firebase via `@sudobility/di/web` (`initializeWebApp()`) before calling `initializeFirebaseAuth()`. The RN variant uses lazy `require()` calls to load `@react-native-firebase` modules on demand.

### 401/403 HTTP Error Handling Strategy
Two parallel implementations exist for auth-aware networking:

1. **`useFirebaseAuthNetworkClient` / `createFirebaseAuthNetworkClient`** (hook/factory pattern):
   - Wraps a platform `NetworkService` obtained via `@sudobility/di`
   - On 401: force-refreshes Firebase ID token, retries once with new `Authorization: Bearer` header
   - On 403: signs out user via `signOut(auth)`, calls `onLogout` callback
   - Returns a `NetworkClient` interface with `request`, `get`, `post`, `put`, `delete` methods

2. **`FirebaseAuthNetworkService`** (class inheritance pattern):
   - Web: extends `WebNetworkClient`, overrides `request()`. Includes proactive token caching (default 30s refresh interval). Does NOT logout on 403 (treats it as a permission error, not an auth error).
   - RN: extends `RNNetworkService`, overrides `request()`. Logs out on 403.

### Token Caching (Web `FirebaseAuthNetworkService` only)
The web `FirebaseAuthNetworkService` maintains a module-level token cache (`cachedToken`, `tokenTimestamp`). Tokens are proactively refreshed if older than `tokenRefreshIntervalMs` (default 30 seconds), avoiding unnecessary calls to `user.getIdToken()`.

### Analytics Integration
On auth state change, both web and RN `firebase-init` modules set the analytics user ID via `@sudobility/di` service locator:
- Web: `getFirebaseService().analytics.setUserId(user.uid)`
- RN: `getAnalyticsClient().setUserId(user.uid)`

### Barrel Exports
Every subdirectory has an `index.ts` that re-exports from implementation files. The top-level `index.ts` and `index.rn.ts` aggregate all barrel exports for the public API.

### TypeScript Configuration
- Target: ES2020, Module: ESNext, JSX: react-jsx
- Full strict mode enabled (strict, exactOptionalPropertyTypes, noUncheckedIndexedAccess, etc.)
- Declaration files and source maps are generated
- Test files (`*.test.ts`, `*.spec.ts`) are excluded from compilation

## Common Tasks

### Adding a new hook
1. Create `src/hooks/useMyHook.ts` with implementation
2. Export it from `src/hooks/index.ts`
3. Export it from both `src/index.ts` (web) and `src/index.rn.ts` (React Native)
4. Add tests in `src/hooks/useMyHook.test.ts`

### Adding a new utility function
1. Create or edit the relevant file in `src/utils/`
2. Export from `src/utils/index.ts`
3. Export from `src/index.ts` and `src/index.rn.ts`

### Adding platform-specific code
1. Create two files: `myModule.ts` (web) and `myModule.rn.ts` (React Native)
2. Web entry point (`src/index.ts`) imports from `myModule`
3. RN entry point (`src/index.rn.ts`) imports from `myModule.rn.js` (note `.js` extension for RN imports)

### Publishing
```bash
bun run build && npm publish
```
CI/CD is handled via GitHub Actions using a shared workflow (`johnqh/workflows/.github/workflows/unified-cicd.yml`). Pushes to `main` or `develop` trigger the pipeline. NPM publish uses public access.

## Peer / Key Dependencies

### Peer Dependencies (required in consuming app)
| Package | Version | Optional | Purpose |
|---|---|---|---|
| `react` | ^18.0.0 \|\| ^19.0.0 | No | React hooks (useMemo, etc.) |
| `firebase` | ^12.7.0 | Yes | Web Firebase SDK (web builds) |
| `@react-native-firebase/app` | >=18.0.0 | Yes | React Native Firebase app (RN builds) |
| `@react-native-firebase/auth` | >=18.0.0 | Yes | React Native Firebase auth (RN builds) |
| `@sudobility/di` | ^1.5.36 | No | Dependency injection, WebNetworkClient, RNNetworkService, service locators |
| `@sudobility/types` | ^1.9.51 | No | Shared types (NetworkClient, NetworkResponse, UserInfoResponse, admin utils) |
| `@tanstack/react-query` | ^5.0.0 | No | Used by useSiteAdmin hook for caching |

### Key Dev Dependencies
| Package | Version | Purpose |
|---|---|---|
| `typescript` | ~5.9.3 | TypeScript compiler |
| `vitest` | ^4.0.4 | Test runner |
| `eslint` | ^9.0.0 | Linter (flat config) |
| `prettier` | ^3.0.0 | Code formatter |

### Consuming Apps
```
auth_lib (this package)
    ^
shapeshyft_app (consumes auth)
sudojo_app (consumes auth)
```

### Code Style
- Prettier: single quotes, trailing commas (es5), 80 char width, 2-space indent, no tabs, arrow parens avoid
- ESLint: flat config, TypeScript plugin, prefer-const, no-var, prefer-template, sorted imports
- Unused vars prefixed with `_` are allowed
