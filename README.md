# @sudobility/auth_lib

Firebase authentication library with configurable auth initialization, resilient network clients with automatic token refresh and logout handling, admin utilities, and React hooks for auth state management. Supports both web and React Native platforms.

## Installation

```bash
bun add @sudobility/auth_lib
```

### Peer Dependencies

```bash
bun add react firebase @sudobility/di @sudobility/types @tanstack/react-query
# For React Native, also:
bun add @react-native-firebase/app @react-native-firebase/auth
```

## The network client

Use **`FirebaseAuthNetworkService`**. It implements `NetworkClient`, injects the
Firebase ID token, sets `Content-Type: application/json` on request bodies, and
has a `.rn` variant for React Native.

Its session policy:

| Response | Behavior |
|----------|----------|
| 401, refresh succeeds | retry once with the fresh token |
| 401, unrecoverable | sign the user out -- the session is dead |
| 403 | return the response untouched; the caller is authenticated but lacks permission |

A 403 never ends the session. APIs in this workspace use 403 for role and
permission denials, so signing out there would log a user out for clicking
something they merely lack access to.

## Usage

```typescript
import {
  initializeFirebaseAuth,
  FirebaseAuthNetworkService,
  useSiteAdmin,
  getFirebaseErrorMessage,
} from '@sudobility/auth_lib';

// Initialize Firebase Auth (after Firebase app is initialized)
const { app, auth } = initializeFirebaseAuth();

// Auth-aware network client: 401 refreshes the token and retries once
const networkClient = new FirebaseAuthNetworkService();

// Check if user is a site admin
const { isSiteAdmin, isLoading } = useSiteAdmin({
  networkClient,
  baseUrl: 'https://api.example.com',
  userId: user.uid,
  token: idToken,
});
```

## API

### Firebase Initialization (`config/`)

| Export | Description |
|---|---|
| `initializeFirebaseAuth()` | Initialize Firebase Auth (singleton) |
| `getFirebaseApp()` | Get cached FirebaseApp instance |
| `getFirebaseAuth()` | Get cached Auth instance |
| `isFirebaseConfigured()` | Check if Firebase is initialized |

### Hooks (`hooks/`)

| Export | Description |
|---|---|
| `createFirebaseAuthNetworkClient(platformNetwork?, options?)` | Non-hook factory version |
| `useSiteAdmin(options)` | Check site admin status via TanStack Query |

### Network (`network/`)

| Export | Description |
|---|---|
| `FirebaseAuthNetworkService` | Auth-aware network service (web and RN variants). 401 refresh-and-retry, logout only when unrecoverable; 403 left to the caller |

### Utils (`utils/`)

| Export | Description |
|---|---|
| `getFirebaseErrorMessage(code)` | Map Firebase error code to user-friendly message |
| `formatFirebaseError(error)` | Extract and map error code in one call |
| `isFirebaseAuthError(error)` | Check if error is a Firebase auth error |

### Admin (`admin/`)

| Export | Description |
|---|---|
| `parseAdminEmails(csv)` | Parse comma-separated admin email string |
| `isAdminEmail(email, adminSet)` | Check if email is in admin set |
| `createAdminChecker(csv)` | Returns admin check function (deprecated) |

## Dual Entry Points

- **Web**: `import` resolves to `dist/index.js` (Firebase JS SDK)
- **React Native**: `react-native` condition resolves to `dist/index.rn.js` (@react-native-firebase)

## Development

```bash
bun run build          # Compile TypeScript to dist/
bun run dev            # Watch mode build
bun test               # Run tests with Vitest
bun run typecheck      # Type-check without emitting
bun run lint           # Lint with ESLint
bun run format         # Format with Prettier
```

## License

BUSL-1.1
