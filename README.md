# Kissan AI — Smart Farming Assistant

**Kissan AI** (کسان اے آئی) is an AI-powered web application built for Pakistani smallholder farmers. It provides intelligent crop diagnosis, weather-aware irrigation advisory, risk assessment, yield prediction, and daily action recommendations — all in English and Urdu with full RTL support.

The name "Kissan" (کسان) means "farmer" in Urdu, reflecting the app's mission: to bring precision agriculture within reach of every farmer, regardless of farm size or technical expertise.

---

## Overview

Smallholder farmers in Pakistan and South Asia often lack access to timely, data-driven agronomic advice. Kissan AI solves this by combining a farmer's profile (crop, soil, irrigation method, planting date) with live weather data, diagnosis history, and AI reasoning to produce actionable, honest recommendations.

The platform follows an **honest-by-design** philosophy: when critical data is missing, features return an "insufficient" state rather than fabricating advice. Safety-critical recommendations use deterministic rule engines as a baseline, with AI adding explanation and enrichment — never overriding the deterministic layer.

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Farm Dashboard** | Central overview with farm health gauge, active alerts, weather summary, recent diagnoses, upcoming tasks, yield estimates, and crop growth stage. |
| **Farm Profile** | Multi-farm support with farmer name, location, land area, soil type, irrigation method, current crop, planting date, and farm switching. |
| **AI Crop Doctor** | Upload a crop photo and receive AI-powered disease diagnosis with severity, confidence, causes, and treatment recommendations (Google Gemini Vision). |
| **AI Chat Assistant** | Context-aware agricultural assistant that understands your farm profile, growth stage, weather, and recent diagnoses. Supports English and Urdu. |
| **Voice Assistant** | Speak to the app in English, Urdu, or Punjabi using speech-to-text (Sarvam AI) and text-to-speech (browser `speechSynthesis`). |
| **Weather Intelligence** | Live weather conditions and 7-day forecast via Open-Meteo, with deterministic rain/heat/humidity/wind insights and soil moisture data. |
| **Irrigation Advisor** | Rain-aware irrigation recommendations based on crop growth stage, soil type, and irrigation method. Deterministic rules with AI enrichment. |
| **Risk Assessment** | Hybrid deterministic rule engine + AI refinement that monitors weather, diagnosis history, and crop stress signals to flag active risks. |
| **Yield Prediction** | Estimated yield with confidence intervals and key contributing factors based on farm and weather data. |
| **Smart Crop Recommendations** | AI-powered crop suitability recommendations (3–5 crops) based on farm profile, soil, and current conditions. |
| **Today's Actions** | A prioritized daily action list (1–4 items) with evidence-backed reasons sourced from weather, diagnoses, risks, and growth stage. |
| **Expense Tracking** | Log and categorize farm expenses (seeds, fertilizer, pesticide, labor, equipment, fuel, transport, etc.) with CSV export. |
| **Crop Calendar** | Schedule and track farm events (irrigation, fertilizer, pest monitoring, harvest, inspection) with status tracking and CSV export. |
| **Diagnosis History** | Browse and review all past crop diagnoses with severity, confidence, and recommended actions. |
| **Global Search** | Search across diagnoses, expenses, events, and risk alerts from a single search bar. |
| **Dark/Light Theme** | System-aware theme with manual toggle and persistent preference. |
| **Multi-Language (UI)** | Full English and Urdu translations with RTL layout support. |
| **Notification Bell** | Active risk alert notifications visible in the app layout. |

---

## AI Capabilities

All AI features use **Google Gemini** (`gemini-3.5-flash`) via server-side Supabase Edge Functions. API keys never reach the browser.

| AI Feature | Edge Function | How It Works |
|------------|--------------|--------------|
| **Crop Doctor** | `analyze-crop` | Sends crop photo to Gemini Vision API; returns disease name, severity, confidence, causes, and recommended actions. Persists diagnosis via service role. |
| **Chat Assistant** | `chat-assistant` | Builds a system prompt with farm profile, growth stage, weather, and recent diagnoses. Calls Gemini with conversation history. Language detection (English/Urdu). |
| **Risk Assessment** | `assess-risks` | Runs deterministic risk rules on weather, diagnoses, and irrigation data. Optionally enriches with Gemini explanations. Marks previous alerts as expired. |
| **Crop Recommendations** | `recommend-crops` | Validates farm ownership, loads recent diagnoses and growth stage, calls Gemini for 3–5 crop recommendations with suitability scores and reasons. |
| **Irrigation Advisor** | `irrigation-advisor` | Deterministic irrigation rules (rain probability, temperature, growth stage). Gemini adds natural-language explanation. Never fabricates exact water quantities when data is insufficient. |
| **Today's Actions** | `today-actions` | Loads farm context, weather, diagnoses, and risks. Calls Gemini for decision reasoning. Returns 1–4 prioritized actions with sources and timing. |

### Deterministic Engines

Two pure TypeScript engines run client-side with no AI calls and no Supabase dependency:

- **Risk Engine** (`src/lib/risk-engine.ts`) — Score-based risk signal detection from weather thresholds (heat ≥ 42°C, rain ≥ 70%, etc.), diagnosis text keyword matching (pest/disease), and irrigation method.
- **Irrigation Engine** (`src/lib/irrigation-engine.ts`) — Rain-aware irrigation advisor that delays recommendations when substantial rain is expected, considers growth stage sensitivity.

Both engines are covered by unit tests.

### Growth Stage Engine

A deterministic algorithm (`src/lib/growth-stage.ts`) calculates crop growth stage from planting date and current date. Supports **wheat, rice, cotton, maize, and sugarcane** with crop-specific day boundaries and Urdu/English aliases (e.g., "gehun" → wheat, "chawal" → rice).

---

## Voice Assistant

Voice input is integrated into the AI Chat page. The implementation uses:

| Component | Technology | Details |
|-----------|-----------|---------|
| **Speech-to-Text (STT)** | Sarvam AI (`saaras:v3` model) | Audio captured via AudioWorklet at 16 kHz PCM, encoded to WAV on stop, uploaded to `sarvam-stt` Edge Function. Non-streaming — transcript arrives after recording ends. |
| **Text-to-Speech (TTS)** | Browser `speechSynthesis` API | No API key required. Voice preference with fallback chain (e.g., Saraiki falls back to Urdu). |

### Supported Voice Languages

| Language | STT | TTS | Notes |
|----------|-----|-----|-------|
| Auto | Supported | Urdu | Auto-detects spoken language |
| English | `en-IN` | `en` | Fully supported |
| Urdu | `ur-IN` | `ur` | Fully supported |
| Punjabi | `pa-IN` | `pa` | Recognition may vary by device |
| Saraiki | Not supported | `skr` (falls back to Urdu) | STT not available from any provider; text input recommended |

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript 5.9 |
| **Build Tool** | Vite 7 with `@vitejs/plugin-react` |
| **Styling** | Tailwind CSS 4 + `tailwindcss-animate` |
| **UI Components** | Radix UI (Accordion, Dialog, Label, Select, Slot) |
| **Charts** | Recharts |
| **Icons** | lucide-react |
| **Routing** | react-router-dom v7 (code-split per route with lazy loading) |
| **Backend / Database** | Supabase (PostgreSQL, Row Level Security, Auth, Storage, Edge Functions) |
| **Edge Functions** | Supabase Edge Functions (Deno runtime) |
| **AI Provider** | Google Gemini `gemini-3.5-flash` (via server-side Edge Functions) |
| **Weather API** | Open-Meteo (free, no API key required) |
| **Speech-to-Text** | Sarvam AI `saaras:v3` (via `sarvam-stt` Edge Function) |
| **Text-to-Speech** | Browser `speechSynthesis` API |
| **Testing** | Vitest |
| **Linting** | ESLint + Prettier |
| **Utilities** | class-variance-authority, clsx, tailwind-merge |

---

## Architecture

Kissan AI is a single-page application with a clear separation between the browser client and server-side Edge Functions:

```
Browser (React + Vite)
  ├── AuthProvider (Supabase Auth, implicit flow)
  ├── PreferencesProvider (language, theme — localStorage)
  └── FarmProvider (multi-farm state, active farm — localStorage)
        │
        ├── Client-side services (src/lib/*-service.ts)
        │     └── Call Supabase REST API or invoke Edge Functions
        │
        └── Supabase Edge Functions (Deno)
              ├── analyze-crop      → Google Gemini Vision
              ├── chat-assistant    → Google Gemini
              ├── assess-risks      → Deterministic rules + Google Gemini
              ├── irrigation-advisor→ Deterministic rules + Google Gemini
              ├── recommend-crops   → Google Gemini
              ├── today-actions     → Google Gemini
              ├── get-weather       → Open-Meteo API
              └── sarvam-stt        → Sarvam AI STT
```

**Key patterns:**

- **Farm-centric isolation** — Every service scopes queries by `farm_id`. The active farm is persisted in `localStorage` (`kissania.activeFarmId.v1`).
- **Hybrid deterministic + AI** — Safety-critical decisions use deterministic rules as baseline; AI adds explanation but never overrides.
- **Service role for writes** — All database writes go through Edge Functions using the Supabase service role, preventing client-side forgery.
- **Honest states** — Missing data results in "insufficient" states, never fabricated recommendations.

---

## Project Structure

```
kissan-ai/
├── public/                        # Static assets (favicon, robots.txt, sitemap)
├── src/
│   ├── components/
│   │   ├── actions/               # Today's actions card
│   │   ├── auth/                  # Login, signup, logout, auth guards
│   │   ├── crop-recommendation/   # Crop recommendation display
│   │   ├── dashboard/             # Dashboard cards (weather, alerts, health, yield, etc.)
│   │   ├── farm/                  # Crop cycle and growth stage cards
│   │   ├── irrigation/            # Irrigation advisor and soil moisture
│   │   ├── landing/               # Marketing landing page sections
│   │   ├── layout/                # App layout, navigation, search, notifications, farm switcher
│   │   ├── ui/                    # Reusable UI primitives (button, card, dialog, etc.)
│   │   ├── yield/                 # Yield comparison chart
│   │   └── ErrorBoundary.tsx      # Global error boundary
│   ├── context/                   # React Context providers (Auth, Farm, Preferences)
│   ├── hooks/                     # Custom hooks (weather, risks, actions, activity, voice)
│   ├── i18n/                      # Translation modules (English + Urdu)
│   ├── lib/                       # Services, engines, Supabase client, voice, utilities
│   ├── pages/                     # Page components (lazy-loaded where possible)
│   ├── types/                     # TypeScript type definitions
│   ├── App.tsx                    # Root component with routing
│   ├── main.tsx                   # Application entry point
│   └── index.css                  # Global styles and Tailwind imports
├── supabase/
│   ├── functions/                 # Supabase Edge Functions (Deno)
│   │   ├── analyze-crop/          # Gemini Vision crop diagnosis
│   │   ├── assess-risks/          # Hybrid risk engine + AI refinement
│   │   ├── chat-assistant/        # Context-aware AI chat
│   │   ├── get-weather/           # Open-Meteo weather integration
│   │   ├── irrigation-advisor/    # Irrigation recommendation engine
│   │   ├── recommend-crops/       # Smart crop recommendations
│   │   ├── sarvam-stt/            # Sarvam AI speech-to-text proxy
│   │   └── today-actions/         # Daily action decision engine
│   ├── schema.sql                 # Complete database schema setup script
│   ├── diagnostic.sql             # Database diagnostic queries
│   └── fix-user-id.sql            # User ID fix utility
├── .env.example                   # Environment variable template
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

---

## Database

Kissan AI uses **Supabase** (PostgreSQL) with Row Level Security (RLS) on every table. The schema is defined in `supabase/schema.sql` and is applied via the Supabase SQL Editor.

### Tables

| Table | Purpose |
|-------|---------|
| `farms` | Farmer profile — name, location, soil type, irrigation method, current crop, planting date |
| `diagnoses` | Crop health analysis — disease, severity, confidence, causes, recommended actions |
| `expenses` | Farm expense tracking by category (seeds, fertilizer, pesticide, labor, etc.) |
| `chat_conversations` | AI assistant conversation threads |
| `chat_messages` | Individual chat messages within conversations |
| `farm_events` | Crop calendar events (irrigation, fertilizer, harvest, etc.) |
| `risk_alerts` | Active/expired/resolved risk assessments with evidence |
| `action_items` | Today's prioritized actions with category, priority, and completion status |

### Storage

- **`crop-images`** — Public storage bucket for Crop Doctor photo uploads. Users can only delete their own uploads (scoped by user ID path prefix).

### Row Level Security

All tables implement RLS scoped to `auth.uid()`. Child tables use a `user_owns_farm(uuid)` helper function to verify farm ownership. Auto-fill triggers set `user_id` from `auth.uid()` on insert.

---

## Environment Variables

### Client-Side (`.env`)

These are bundled into the browser app. Copy `.env.example` to `.env` and fill in your values:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> **Note:** The Supabase anon key is safe to expose — it is scoped by Row Level Security (RLS) policies. Never expose the `service_role` key.

### Server-Side (Edge Function Secrets)

These must be added in **Supabase Dashboard → Edge Functions → Secrets**:

| Secret | Required For | Description |
|--------|-------------|-------------|
| `GEMINI_API_KEY` | Crop Doctor, Chat, Risks, Recommendations, Irrigation, Actions | Google Gemini API key — [aistudio.google.com](https://aistudio.google.com/apikey) |
| `SARVAM_API_KEY` | Voice Assistant (STT) | Sarvam AI API key — [sarvam.ai](https://www.sarvam.ai) |
| `SUPABASE_SERVICE_ROLE_KEY` | All Edge Functions (auto-provided) | Set automatically by Supabase — do not add manually |

> **Note:** Weather data uses Open-Meteo, which requires no API key.

---

## Installation

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm**
- A **Supabase** project (free tier works) — [supabase.com](https://supabase.com)
- A **Google Gemini API key** — [aistudio.google.com](https://aistudio.google.com/apikey)
- A **Sarvam AI API key** (for voice features) — [sarvam.ai](https://www.sarvam.ai)

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/muhmmadadeel4413/kissan-ai.git
cd kissan-ai

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env
# Edit .env with your Supabase project URL and anon key

# 4. Set up the database
# Open Supabase Dashboard → SQL Editor → paste supabase/schema.sql → Run

# 5. Configure Edge Function secrets
# In Supabase Dashboard → Edge Functions → Secrets, add:
#   GEMINI_API_KEY
#   SARVAM_API_KEY

# 6. Deploy Edge Functions
supabase functions deploy analyze-crop
supabase functions deploy assess-risks
supabase functions deploy chat-assistant
supabase functions deploy get-weather
supabase functions deploy irrigation-advisor
supabase functions deploy recommend-crops
supabase functions deploy sarvam-stt
supabase functions deploy today-actions

# 7. Start the development server
npm run dev
```

The app will be available at [http://localhost:5173](http://localhost:5173).

> **Important:** Vite reads `.env` only at startup. After editing environment variables, restart the dev server.

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Vite development server with HMR |
| `npm run build` | Build the production bundle |
| `npm run preview` | Preview the production build locally |
| `npm run typecheck` | Run TypeScript type checking (`tsc --noEmit`) |
| `npm run typecheck:watch` | Run TypeScript type checking in watch mode |
| `npm run test` | Run unit tests with Vitest |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Lint and fix TypeScript/TSX files with ESLint |
| `npm run format` | Format source files with Prettier |

---

## Testing

The project uses **Vitest** for unit testing. Four test files cover the deterministic engines and utilities:

| Test File | Coverage |
|-----------|----------|
| `src/lib/risk-engine.test.ts` | Risk signal detection, threshold logic, aggregation, and alert generation |
| `src/lib/irrigation-engine.test.ts` | Rain-aware irrigation recommendations and growth stage sensitivity |
| `src/lib/export-utils.test.ts` | CSV export with escaping for commas, quotes, newlines, and null values |
| `src/i18n/index.test.ts` | Translation dictionaries, language options, fallback behavior, and interpolation |

Run all tests (52 tests across 4 files):

```bash
npm run test
```

Run tests in watch mode:

```bash
npm run test:watch
```

---

## Deployment

### Frontend

The frontend is a static Vite build suitable for any hosting provider:

```bash
npm run build
```

The output is in the `dist/` directory. Deploy to:

- **Vercel** — Connect your GitHub repo or use `vercel` CLI
- **Netlify** — Drag and drop `dist/` or connect via Git
- **Cloudflare Pages** — Connect your GitHub repo

### Edge Functions

Edge Functions must be deployed to your Supabase project. They run on Supabase's global Deno runtime:

```bash
supabase functions deploy <function-name>
```

---

## Security Model

- **Row Level Security (RLS)** — All database tables are protected with RLS policies; users can only access their own farm's data.
- **Server-side API keys** — Gemini and Sarvam keys live exclusively in Supabase Edge Function secrets and never reach the browser.
- **Farm ownership validation** — Every Edge Function verifies farm ownership server-side using the service role before returning or modifying data.
- **Service role writes** — AI-generated results (diagnoses, risk alerts, recommendations) are persisted via the service role so clients cannot inject or tamper with records.
- **CORS allowlist** — Edge Functions restrict preflight responses to a defined set of allowed origins.
- **Error sanitization** — Error messages shown to users are friendly and never expose raw internals or stack traces.
- **Never commit `.env`** — The `.env` file is listed in `.gitignore` and must never be committed.

---

## Localization

Kissan AI supports two UI languages:

| Language | Direction | Font |
|----------|-----------|------|
| English | LTR | System default |
| Urdu (اردو) | RTL | Noto Nastaliq Urdu / Noto Sans Urdu |

Language preference is persisted in `localStorage` (`kissanai.language.v1`) and applied globally. The i18n system is a custom implementation with 5 translation modules (landing, app, farm, features, auth) and English fallback for missing keys. RTL layout flipping is applied before first paint via an inline script in `index.html`.

---

## Contributing

Contributions are welcome. Before submitting a PR:

1. Ensure `npm run typecheck` passes with no errors.
2. Ensure `npm run test` passes (all tests green).
3. Follow the existing code style (Tailwind utility classes, functional components, TypeScript strict mode).
4. Keep Edge Functions honest — never fabricate data when information is insufficient.

---

## License

This project is proprietary. All rights reserved.

---

## Support

For issues or questions, please open an issue on the project repository.
