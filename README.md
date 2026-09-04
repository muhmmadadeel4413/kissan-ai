# 🌾 Kissan AI — Smart Farming Assistant

**Kissan AI** (کسان اے آئی) is an AI-powered web application built for Pakistani smallholder farmers. It provides intelligent crop diagnosis, weather-aware irrigation advisory, risk assessment, yield prediction, and daily action recommendations — all in English and Urdu with full RTL support.

The name "Kissan" (کسان) means "farmer" in Urdu, reflecting the app's mission: to bring precision agriculture within reach of every farmer, regardless of farm size or technical expertise.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Crop Doctor** | Upload a photo of your crop and receive AI-powered disease diagnosis with treatment recommendations (Google Gemini Vision API). |
| **AI Assistant** | Chat with a context-aware agricultural assistant that understands your farm profile, growth stage, and recent diagnoses. |
| **Voice Assistant** | Speak to the app in English, Urdu, Punjabi, or Saraiki using real-time speech-to-text (Speechmatics) and text-to-speech. |
| **Weather Intelligence** | Live weather conditions and 5-day forecast powered by OpenWeatherMap, with rain probability and farmer-friendly summaries. |
| **Irrigation Advisory** | Rain-aware irrigation recommendations based on your crop's growth stage, soil type, and irrigation method. |
| **Risk Assessment** | Deterministic rule engine + AI refinement that monitors weather, diagnosis history, and crop stress signals to flag active risks. |
| **Yield Prediction** | Estimated yield with confidence intervals and key contributing factors. |
| **Smart Crop Recommendations** | AI-powered crop suitability recommendations based on your farm profile and current conditions. |
| **Today's Actions** | A prioritized daily action list (1–4 items) with evidence-backed reasons for each recommendation. |
| **Expense Tracking** | Log and categorize farm expenses (seeds, fertilizer, pesticide, labor, etc.) with breakdown charts. |
| **Crop Calendar** | Schedule and track farm events (planting, spraying, harvesting) with status tracking. |
| **Global Search** | Search across diagnoses, expenses, events, and risk alerts from a single search bar. |
| **Dark/Light Theme** | System-aware theme with manual toggle and persistent preference. |
| **Multi-Language** | Full English and Urdu translations with RTL layout support. |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18.3.1, TypeScript 5.9.3 |
| **Build Tool** | Vite 7.2.4 |
| **Styling** | Tailwind CSS 4.1.18 + tailwindcss-animate |
| **UI Components** | Radix UI (Accordion, Dialog, Label, Select, Slot) |
| **Icons** | lucide-react |
| **Routing** | react-router-dom v7.18.3 (code-split per route) |
| **Backend / Database** | Supabase (PostgreSQL, Row Level Security, Auth) |
| **Edge Functions** | Supabase Edge Functions (Deno runtime) |
| **AI Provider** | Google Gemini (via server-side Edge Functions) |
| **Weather API** | OpenWeatherMap |
| **Speech-to-Text** | Speechmatics (real-time WebSocket) |
| **Text-to-Speech** | Browser `speechSynthesis` API |
| **Testing** | Vitest 4.1.11, Playwright CLI |
| **Utilities** | class-variance-authority, clsx, tailwind-merge |

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18+ (LTS recommended)
- **npm** or **pnpm**
- A **Supabase** project (free tier works) — [supabase.com](https://supabase.com)
- A **Google Gemini API key** — [aistudio.google.com](https://aistudio.google.com)
- An **OpenWeatherMap API key** — [openweathermap.org](https://openweathermap.org/api)
- A **Speechmatics API key** (optional, for voice features) — [speechmatics.com](https://www.speechmatics.com)

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-username/kissan-ai.git
cd kissan-ai
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env` file in the project root (copy from `.env.example` if available):

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

> **Note:** The Supabase anon key is safe to expose in the frontend — it is scoped by Row Level Security (RLS) policies. Never expose the `service_role` key.

### 4. Configure Supabase Edge Function secrets

In your Supabase Dashboard → **Edge Functions** → **Secrets**, add:

| Secret Name | Description |
|-------------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key for AI features |
| `OPENWEATHER_API_KEY` | OpenWeatherMap key for weather data |
| `SPEECHMATICS_API_KEY` | Speechmatics key for voice features (optional) |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-provided by Supabase (used by Edge Functions) |

### 5. Deploy Edge Functions

Deploy each Edge Function to your Supabase project:

```bash
# Example for the chat-assistant function
supabase functions deploy chat-assistant
supabase functions deploy analyze-crop
supabase functions deploy assess-risks
supabase functions deploy get-weather
supabase functions deploy irrigation-advisor
supabase functions deploy recommend-crops
supabase functions deploy today-actions
supabase functions deploy speechmatics-token
```

### 6. Run the development server

```bash
npm run dev
```

The app will be available at [http://localhost:5173](http://localhost:5173).

---

## 📦 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Vite development server with HMR |
| `npm run build` | Build the production bundle |
| `npm run preview` | Preview the production build locally |
| `npm run typecheck` | Run TypeScript type checking (`tsc --noEmit`) |
| `npm run test` | Run unit tests with Vitest |

---

## 🧪 Testing

The project uses **Vitest** for unit testing. Currently, the deterministic engines have test coverage:

- **Risk Engine** (`src/lib/risk-engine.test.ts`) — 19 tests covering risk signal detection, threshold logic, and alert generation
- **Irrigation Engine** (`src/lib/irrigation-engine.test.ts`) — 14 tests covering rain-aware irrigation recommendations

Run all tests:

```bash
npm run test
```

Run tests in watch mode:

```bash
npx vitest
```

---

## 📁 Project Structure

```
kissan-ai/
├── public/                     # Static assets (favicon, robots.txt, sitemap)
├── src/
│   ├── components/
│   │   ├── actions/            # Today's actions card
│   │   ├── auth/               # Login, signup, logout, auth guards
│   │   ├── calendar/           # Farm event calendar form
│   │   ├── crop-recommendation/# Crop recommendation display
│   │   ├── dashboard/          # Dashboard cards (13 components)
│   │   ├── expenses/           # Expense form
│   │   ├── farm/               # Crop cycle and growth stage cards
│   │   ├── irrigation/         # Irrigation advisor and soil moisture
│   │   ├── landing/            # Marketing landing page sections
│   │   ├── layout/             # App layout, navigation, search, notifications
│   │   ├── ui/                 # Reusable UI primitives (button, card, dialog, etc.)
│   │   ├── weather/            # Weather summary card
│   │   ├── yield/              # Yield comparison chart
│   │   └── ErrorBoundary.tsx   # Global error boundary
│   ├── context/                # React Context providers (Auth, Farm, Preferences)
│   ├── hooks/                  # Custom hooks (weather, risks, actions, activity)
│   ├── lib/                    # Services, engines, i18n, Supabase client
│   ├── pages/                  # Page components (22 pages, lazy-loaded)
│   ├── types/                  # TypeScript type definitions
│   ├── App.tsx                 # Root component with routing
│   ├── main.tsx                # Application entry point
│   └── index.css               # Global styles and Tailwind imports
├── supabase/
│   └── functions/              # Supabase Edge Functions (Deno)
│       ├── analyze-crop/       # Gemini Vision crop diagnosis
│       ├── assess-risks/       # Farm risk engine + AI refinement
│       ├── chat-assistant/     # Context-aware AI chat
│       ├── gemini-probe/       # Diagnostic endpoint (disabled)
│       ├── get-weather/        # OpenWeatherMap integration
│       ├── irrigation-advisor/ # Irrigation recommendation engine
│       ├── recommend-crops/    # Smart crop recommendations
│       ├── speechmatics-token/ # STT token generation
│       └── today-actions/      # Daily action decision engine
├── .env                        # Environment variables (NOT committed)
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 🔐 Security Model

Kissan AI follows a defense-in-depth security approach:

- **Row Level Security (RLS)** — All database tables are protected with RLS policies; users can only access their own farm's data.
- **Server-side API keys** — Gemini, OpenWeatherMap, and Speechmatics keys live exclusively in Supabase Edge Function secrets and never reach the browser.
- **JWT validation** — All Edge Functions perform a lightweight Bearer JWT sanity check before processing requests.
- **Farm ownership validation** — Every Edge Function verifies farm ownership server-side using the service role before returning or modifying data.
- **Service role writes** — AI-generated results (diagnoses, risk alerts, recommendations) are persisted via the service role so clients cannot inject or tamper with records.
- **CORS allowlist** — Edge Functions restrict preflight responses to a defined set of allowed origins.
- **Error sanitization** — Error messages shown to users are friendly and never expose raw internals or stack traces.

---

## 🌍 Localization

Kissan AI supports two languages:

| Language | Direction | Font |
|----------|-----------|------|
| English | LTR | System default |
| Urdu (اردو) | RTL | Noto Nastaliq Urdu / Noto Sans Urdu |

Language preference is persisted in `localStorage` and applied globally. The i18n system is a custom implementation (~1,782 lines of translations) with full RTL layout flipping.

Voice input supports additional languages: **Punjabi** and **Saraiki** (via Speechmatics).

---

## 🚢 Deployment

### Frontend

The frontend can be deployed to any static hosting provider:

- **Vercel** — `vercel` CLI or connect your GitHub repo
- **Netlify** — Drag and drop the `dist/` folder or connect via Git
- **Cloudflare Pages** — Connect your GitHub repo

Build the production bundle:

```bash
npm run build
```

The output will be in the `dist/` directory.

### Edge Functions

Edge Functions must be deployed to your Supabase project (see [Deploy Edge Functions](#5-deploy-edge-functions) above). They run on Supabase's global Deno runtime and are automatically scaled.

---

## 🤝 Contributing

Contributions are welcome. Before submitting a PR:

1. Ensure `npm run typecheck` passes with no errors.
2. Ensure `npm run test` passes (all tests green).
3. Follow the existing code style (Tailwind utility classes, functional components, TypeScript strict mode).
4. Keep Edge Functions honest — never fabricate data when information is insufficient.

---

## 📄 License

This project is proprietary. All rights reserved.

---

## 📞 Support

For issues or questions, please open an issue on the project repository.
