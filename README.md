# Chatra Frontend

Nuxt 3 + Vue 3 + Pinia frontend for the Chatra education platform.

## Prerequisites

- Git, Node.js and npm. The locked Nuxt version requires Node.js `^20.19.0 || >=22.12.0`; use Node.js 22.12 or newer for this setup.
- A running [Chatra backend](https://github.com/yasmina777-kz/chatra-with-avatar-B). Starting the frontend does not start the API or WebSocket server; login and chat require the backend.

## Quick start

### 1. Get the source

```bash
git clone https://github.com/yasmina777-kz/chatra-with-avatar-F.git
cd chatra-with-avatar-F
```

### 2. Configure environment

Create a file named `.env` in the repository root, next to `package.json`:

```env
NUXT_PUBLIC_API_BASE=http://localhost:8000
NUXT_PUBLIC_WS_BASE=ws://localhost:8000
```

These are the defaults in `nuxt.config.ts`. Change them if your backend runs elsewhere, and restart the development server after editing `.env`.

Use the backend base URL, not a specific endpoint: the API client adds paths such as `/auth/login`, and the chat client adds `/ws/{chatId}`. Do not append those paths to the environment values. Avoid a trailing slash on `NUXT_PUBLIC_WS_BASE`.

Both variables belong to Nuxt's public runtime configuration and are available in the browser. Keep API secrets and database credentials in the backend, not in these values. The local `.env` file is excluded by `.gitignore`.

### 3. Install and run

```bash
npm ci
npm run dev
```

Open http://localhost:3000, or the URL printed by Nuxt if that port is occupied. `npm ci` installs from the committed lockfile. Stop the development server with Ctrl+C.

## Build and preview

```bash
npm run build
npm run preview
```

Use the preview URL printed in the terminal. The backend is still required for API-dependent features.

## API client regression tests

After installing dependencies, run `npm test`. The tests exercise concurrent requests through the Axios interceptors: successful token refresh, failed refresh, and a repeated 401 after retry. Network calls and the auth store are replaced with test doubles, so no running backend, account or API keys are needed.
