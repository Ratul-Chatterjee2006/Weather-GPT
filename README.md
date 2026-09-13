# WeatherGPT

A conversational weather assistant for India and beyond. Ask about current
conditions or forecasts in plain language, get real forecast data back, and
see automatic warnings when a forecast crosses a severe-weather threshold
(heavy rain/flooding, high wind/storm, thunderstorm, heatwave, cold wave).

## Features

- **Chat** — natural-language weather Q&A backed by live forecast data (not
  guesses), with automatic flood/storm/heatwave/cold-wave risk flags for the
  next 7 days.
- **Weather map** (`/map`) — active alerts, live rainfall radar, and wind
  direction on an interactive map.
- **Home page** — current conditions for your location plus any active
  risk warnings, at a glance.
- **Blog** — published articles about reading forecasts and understanding
  weather data.
- **Alerts** — admin-managed regional weather alerts shown on the home page
  and the map.
- **Accounts** — email/password and Google sign-in, with role-based access
  (user / admin).
- **Admin panel** (`/admin`) — manage users and roles, blog posts, alerts,
  contact messages, site-wide broadcasts, and view usage analytics and
  data-source health.

## Tech stack

- [TanStack Start](https://tanstack.com/start) (React, file-based routing,
  server functions) + TypeScript
- Tailwind CSS + shadcn/ui components
- [Supabase](https://supabase.com) — Postgres database, authentication, and
  row-level security
- [Groq](https://groq.com) — LLM inference for the chat assistant
- [Open-Meteo](https://open-meteo.com) — weather forecast and geocoding data
  (no API key required)
- [RainViewer](https://www.rainviewer.com) — live rainfall radar tiles
- [Leaflet](https://leafletjs.com) + OpenStreetMap — the interactive map
- Deployed on [Vercel](https://vercel.com)

## Getting started

### 1. Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Where to get it |
| --- | --- |
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | Supabase project → Settings → API |
| `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase project → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project → Settings → API (server-side only, never expose to the client) |
| `VITE_SUPABASE_PROJECT_ID` | The `xxxx` in `https://xxxx.supabase.co` |
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) (server-side only) |

### 2. Database

In the Supabase SQL editor, run the migrations in `supabase/` **in order**
(`schema.sql` for a fresh project, or the numbered `NNN-*.sql` files if
adapting an existing schema). Each is safe to re-run.

### 3. Google sign-in (optional)

1. Google Cloud Console → OAuth Client ID → add redirect URI
   `https://<your-project-ref>.supabase.co/auth/v1/callback`.
2. Supabase → Authentication → Providers → Google → paste the Client
   ID/Secret.
3. Supabase → Authentication → URL Configuration → add your local and
   production URLs to Site URL / Redirect URLs.

### 4. Install and run

```sh
npm install
npm run dev
```

### 5. Deploy

Push to your Git provider and import the repo into
[Vercel](https://vercel.com). Add the same environment variables from step 1
in the Vercel project settings, then deploy.

## Project structure

```
src/
  routes/            file-based routes (pages)
  components/site/   shared site UI (layout, live weather widget, banner)
  components/ui/     shadcn/ui components
  integrations/      Supabase client setup
  lib/                server functions (chat, weather, admin) and hooks
supabase/            SQL migrations
```
