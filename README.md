# SyndicPro

SyndicPro is a Next.js property and condominium management PWA with role-scoped dashboards, reclamations, announcements, notifications, and optional Gemini AI assistance.

## Requirements

- Node.js compatible with the project's Next.js 16 version
- MongoDB (a local replica set is not required for the standard flows)
- npm

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Set `MONGODB_URI` to a development/test database and replace `AUTH_SECRET` with a long random secret.
3. Optionally configure `GEMINI_API_KEY` and `GEMINI_MODEL` for AI features. The core management workflows do not require Gemini.
4. Run `npm install`, then `npm run dev`.

Open `http://localhost:3000`. Never point local tests or seed scripts at production data.

## Validation

```bash
npm test
npm run lint
npx tsc --noEmit
npm run validate:openapi
npm run build
```

`npm run lint` currently reports existing lint violations across the repository; focused lint can be run on changed files while those are triaged.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `AUTH_SECRET` | Yes | Auth.js session/JWT signing secret |
| `CRON_SECRET` | For scheduled publishing | Secret used by the scheduled announcement publication endpoint |
| `GEMINI_API_KEY` | No | Server-side Gemini access; omit to disable AI features |
| `GEMINI_MODEL` | No | Gemini model identifier used by AI routes |
| `ENABLE_API_DOCS` | No | Set to `true` to enable API docs in production |

Keep `.env.local` private; it is ignored by Git. Never expose server-only values through `NEXT_PUBLIC_*`.

## AI features

AI assistance is optional. The core incident, announcement, and residence workflows continue to work without provider keys. Configure these server-side variables in `.env.local` to enable the supported AI features:

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | No | Enables Gemini text, image analysis, and embeddings |
| `GEMINI_MODEL` | No | Gemini text/vision model; defaults to `gemini-2.5-flash` |
| `GEMINI_EMBEDDING_MODEL` | No | Embedding model; defaults to `gemini-embedding-001` |
| `GROQ_API_KEY` | No | Optional text-only fallback when Gemini is unavailable |
| `GROQ_MODEL` | No | Groq model; defaults to `openai/gpt-oss-120b` |

With no AI key configured, AI buttons return a friendly unavailable/configuration message; manual workflows remain available. AI output is advisory: it never publishes announcements, changes incident status, or grants or changes permissions. Users review and apply suggestions themselves.

## PWA and deployment notes

The web manifest and service worker are served by the Next.js app; icons are under `public/icons`. Use HTTPS in production for service-worker installation. Set the deployment platform's Auth.js secret and MongoDB URI, and configure the canonical application origin using the platform/Auth.js URL configuration. Validate sign-in, role-scoped access, offline synchronization, and scheduled announcement publication against a staging database before deployment.

### Scheduled announcement publication

Scheduled announcements are processed by `POST /api/cron/publish-announcements`, so publication does not depend on authenticated users making application requests. The Vercel cron configuration calls a small GET adapter at `/api/cron/vercel-publish-announcements`; it forwards the authorization header to the existing POST-only endpoint. Both routes use the same `CRON_SECRET` authentication and publication implementation.

Generate a strong random secret locally. For example, in PowerShell:

```powershell
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$bytes = New-Object byte[] 32
$rng.GetBytes($bytes)
[Convert]::ToBase64String($bytes)
$rng.Dispose()
```

In the deployment platform's project settings, add the generated value as the server-side environment variable `CRON_SECRET` and enable it for **Production** (and Preview only if you intend to run cron jobs there). Redeploy after adding or changing environment variables. Never use a `NEXT_PUBLIC_` prefix.

For Vercel, `vercel.json` configures this job to run every five minutes. Vercel Cron sends GET requests and automatically supplies the `Authorization: Bearer <CRON_SECRET>` header when `CRON_SECRET` is configured in the project. Vercel Hobby currently permits only daily cron schedules; this five-minute schedule requires Pro or Enterprise. The schedule runs at five-minute intervals, so an announcement is published on the next successful run after its scheduled time, not necessarily at the exact scheduled second.

To securely test the POST endpoint manually, use your real domain and provide the secret through a local shell variable rather than placing it in source code or a URL:

```text
curl -X POST "https://YOUR_DOMAIN/api/cron/publish-announcements" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

This project contains Vercel Cron configuration, but the repository alone does not establish that the production app is deployed on Vercel or that its cron is active. Confirm the production project and deployment in the Vercel dashboard. On another hosting platform, configure that platform's scheduler to send the same authenticated POST request to `/api/cron/publish-announcements` at the desired interval; do not assume `vercel.json` activates scheduling there.
