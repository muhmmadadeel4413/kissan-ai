# Kissan AI — Smart Farming Assistant

Kissan AI is an AI-assisted farming web application designed for farmers in Pakistan. It combines farm-specific information, weather data, deterministic agricultural rules, and AI-generated explanations to help users understand crop health, irrigation, risks, daily tasks, and farm expenses.

The application supports English and Urdu interfaces, including right-to-left (RTL) layout for Urdu.

**Live app:** https://kissan-ai-six.vercel.app  
**Repository:** https://github.com/muhmmadadeel4413/kissan-ai

> **Important:** Kissan AI provides decision support, not a substitute for a qualified agronomist or local agricultural extension service. AI diagnoses and recommendations can be wrong; verify high-impact crop-treatment decisions locally.

---

## Contents

- [Features](#features)
- [Technology stack](#technology-stack)
- [How it works](#how-it-works)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Supabase setup](#supabase-setup)
- [Available scripts](#available-scripts)
- [Tests and quality checks](#tests-and-quality-checks)
- [Deployment](#deployment)
- [Security notes](#security-notes)
- [Localization and voice](#localization-and-voice)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Features

| Feature | What it does |
|---|---|
| Farm dashboard | Summarizes farm health, weather, alerts, diagnoses, upcoming tasks, growth stage, and yield estimates. |
| Multiple farm profiles | Lets a user maintain separate farm profiles and switch between them. |
| Crop Doctor | Accepts a crop photo and returns an AI-assisted diagnosis, severity, possible causes, and suggested actions. |
| AI farming assistant | Provides farm-context-aware agricultural chat in English and Urdu. |
| Weather intelligence | Uses Open-Meteo weather data and derives weather-related insights and alerts. |
| Irrigation advisor | Combines weather, crop growth stage, soil, and irrigation context to provide irrigation guidance. |
| Risk assessment | Uses deterministic rules and available farm signals to identify possible crop risks. |
| Yield prediction | Presents an estimated yield with uncertainty and contributing factors where data is available. |
| Crop recommendations | Suggests crops based on the available farm profile and growing conditions. |
| Today's Actions | Prioritizes practical tasks using available weather, diagnosis, risk, and crop-stage information. |
| Expense tracker | Records farm expenses by category and supports CSV export. |
| Crop calendar | Schedules and tracks farm activities such as irrigation, fertilizer application, monitoring, and harvest. |
| Diagnosis history | Lets users review previous crop diagnoses and recommendations. |
| Search and alerts | Provides global search and in-app risk notifications. |
| English and Urdu UI | Includes translations and RTL layout support for Urdu. |
| Voice input/output | Includes voice input through the configured speech-to-text service and browser text-to-speech support. |

Feature availability can depend on valid Supabase configuration, deployed Edge Functions, and the corresponding third-party API secrets.

## Technology stack

- **Frontend:** React 18, TypeScript 5.9
- **Build and development:** Vite 7
- **Styling:** Tailwind CSS 4
- **UI and icons:** Radix UI, lucide-react
- **Routing:** React Router 7
- **Charts:** Recharts
- **Backend:** Supabase (PostgreSQL, Auth, Row Level Security, Storage, Edge Functions)
- **AI:** Google Gemini through server-side Supabase Edge Functions; optional provider fallback may be configured in individual functions
- **Weather:** Open-Meteo
- **Voice:** Sarvam AI speech-to-text Edge Function and browser `speechSynthesis` for text-to-speech
- **Tests:** Vitest
- **Code quality:** TypeScript, ESLint, Prettier

## How it works

The browser application is built with React and Vite. It uses Supabase for authentication, database access, storage, and server-side Edge Functions. AI provider credentials should remain on the server in Supabase Edge Function secrets; they should not be embedded in frontend code.

Several agricultural recommendations use deterministic TypeScript rules alongside AI-generated explanations. When required data is unavailable, recommendations should be treated as limited rather than assumed to be precise.

## Getting started

### Prerequisites

Install the following:

- Node.js (use a current LTS release compatible with Vite 7)
- npm
- A Supabase project
- A Google Gemini API key for AI features
- A Sarvam AI API key if you want to use speech-to-text

### 1. Clone and install

```bash
git clone https://github.com/muhmmadadeel4413/kissan-ai.git
cd kissan-ai
npm install
```

### 2. Configure frontend environment variables

Create a `.env` file in the project root. Add the values for your own Supabase project:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
```

Get the project URL and public client key from your Supabase project's API settings. Use the public anon/publishable key with Row Level Security enabled. **Never put a Supabase `service_role` key, Gemini key, or Sarvam key in a `VITE_` variable.** Vite variables prefixed with `VITE_` are included in the client-side bundle.

If your local project contains an `.env.example` file, you can copy it and then replace its placeholders. Otherwise, create `.env` using the template above.

### 3. Set up Supabase

1. Open your Supabase project.
2. Open **SQL Editor**.
3. Run the database schema from `supabase/schema.sql` in the repository.
4. Confirm that the tables, policies, helper functions, and storage configuration required by the application were created.
5. Configure the Edge Function secrets described below.

The project also includes SQL utility files for diagnostics and targeted fixes. Do not run a fix script blindly on production data; read it first and back up important data.

### 4. Configure Edge Function secrets

In Supabase, open **Edge Functions / Secrets** and add the secrets required by the functions you intend to use.

| Secret | Used for |
|---|---|
| `GEMINI_API_KEY` | Gemini-powered AI features, including crop diagnosis, chat, risk assessment, irrigation, crop recommendations, daily actions, and `speak-answer`, where configured. |
| `OPENROUTER_API_KEY` | Optional AI fallback used by functions including `analyze-crop`, `assess-risks`, `chat-assistant`, `irrigation-advisor`, `recommend-crops`, and `today-actions`. |
| `SARVAM_API_KEY` | Speech-to-text through the `sarvam-stt` Edge Function. |
| `GROQ_API_KEY` | Whisper speech-to-text through the `whisper-stt` Edge Function. |

Supabase Edge Functions normally receive Supabase server environment values from the platform. Keep provider API keys and the service-role key out of frontend environment variables and never commit them to the repository. Configure only the secrets needed by the functions you intend to use.
### 5. Deploy Edge Functions

Install and authenticate the Supabase CLI, link the local project to your Supabase project, and deploy the functions used by your application. From the repository root, run:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF

supabase functions deploy analyze-crop
supabase functions deploy assess-risks
supabase functions deploy chat-assistant
supabase functions deploy get-weather
supabase functions deploy irrigation-advisor
supabase functions deploy recommend-crops
supabase functions deploy sarvam-stt
supabase functions deploy speak-answer
supabase functions deploy today-actions
supabase functions deploy whisper-stt
```

These commands cover the function directories included in the project. Frontend deployment does not automatically deploy these Edge Functions.

### 6. Run locally

```bash
npm run dev
```

Vite normally serves the app at http://localhost:5173. Open the URL printed in your terminal.

**After changing `.env`, restart the development server** so Vite reads the updated values.

## Environment variables

### Frontend

| Variable | Required | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | URL of your Supabase project. |
| `VITE_SUPABASE_ANON_KEY` | Yes | Public anon/publishable client key used by the frontend. |

### Server-side secrets

Set these in Supabase Edge Function secrets, not in the frontend `.env`:

- `GEMINI_API_KEY` — AI functionality that uses Google Gemini.
- `SARVAM_API_KEY` — speech-to-text functionality.
- Any optional fallback-provider keys referenced by the source of the particular Edge Function you deploy.

Open-Meteo does not normally require an API key for the weather endpoints used by this project.

## Available scripts

These commands are defined in `package.json`:

| Command | Description |
|---|---|
| `npm run dev` | Starts the Vite development server. |
| `npm run build` | Builds the production frontend into `dist/`. |
| `npm run preview` | Serves the production build locally for preview. |
| `npm run typecheck` | Runs TypeScript checking without emitting files. |
| `npm run typecheck:watch` | Runs TypeScript checking in watch mode. |
| `npm run test` | Runs the Vitest test suite once. |
| `npm run test:watch` | Runs Vitest in watch mode. |
| `npm run lint` | Runs ESLint on TypeScript/TSX files and applies automatic fixes. Review the diff afterward. |
| `npm run format` | Formats TypeScript/TSX files under `src/` with Prettier. |

## Tests and quality checks

Before pushing changes, run:

```bash
npm run typecheck
npm run test
npm run build
```

The repository includes Vitest tests for deterministic irrigation and risk logic, export utilities, and localization/voice-related behavior. If a command fails, fix the reported issue and rerun it before committing.

The `lint` and `format` scripts can modify files; inspect the result with `git diff` before committing.

## Deployment

### Frontend (Vercel)

The deployed frontend is available at:

https://kissan-ai-six.vercel.app

For a new deployment:

1. Import the GitHub repository into Vercel.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project's environment-variable settings.
3. Ensure the production Supabase project has the schema, storage, Edge Function secrets, and Edge Functions configured.
4. Deploy the application. Vercel runs the project's build command (`npm run build`) and publishes the Vite output directory (`dist`).

If you change Vite environment variables in Vercel, trigger a new deployment so the values are included in the client bundle.

### Supabase backend

Frontend deployment does not deploy Supabase Edge Functions or apply database changes automatically. Deploy functions and apply schema changes to the intended Supabase project separately.

## Security notes

- Keep database access protected by Row Level Security policies.
- Keep Gemini, Sarvam, and other provider secrets on the server in Supabase Edge Function secrets.
- Never commit `.env`, access tokens, passwords, or private keys.
- Never put privileged secrets in `VITE_*` variables; those values are exposed to browser users.
- Review database migrations and SQL repair scripts before running them against production data.
- Treat AI-generated diagnoses and recommendations as estimates and verify consequential decisions with a qualified local expert.

## Localization and voice

The interface supports English and Urdu, including RTL behavior for Urdu. Voice features depend on browser/device capabilities and the server-side speech-to-text configuration. Browser text-to-speech voices vary by operating system and browser. Punjabi recognition may vary by provider/device; Saraiki speech recognition may not be available even where text-to-speech fallback is possible.

## Project structure

The source tree is organized around these main areas:

```text
kissan-ai/
├── src/
│   ├── components/      # Shared UI, dashboard, farm, auth, layout, and feature components
│   ├── context/         # Authentication, farm, and preferences context
│   ├── hooks/           # Reusable React hooks
│   ├── i18n/            # English/Urdu localization
│   ├── lib/             # Supabase client, services, rules engines, weather, voice, utilities
│   ├── pages/           # Dashboard, assistant, Crop Doctor, calendar, expenses, and other pages
│   ├── types/           # TypeScript types
│   ├── App.tsx          # Routes and application shell
│   └── main.tsx         # Frontend entry point
├── supabase/
│   ├── functions/       # Server-side Supabase Edge Functions
│   └── schema.sql       # Database schema
├── package.json
├── vite.config.ts
├── vitest.config.ts
└── README.md
```

## Troubleshooting

### The app says Supabase configuration is missing

- Confirm `.env` is in the repository root.
- Confirm the variable names are exactly `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Check for placeholder values and extra spaces.
- Stop and restart `npm run dev` after editing `.env`.

### A feature returns an Edge Function or AI error

- Confirm the required Edge Function is deployed to the correct Supabase project.
- Confirm the relevant API key is configured in Supabase Edge Function secrets.
- Check Supabase Edge Function logs for the actual provider response and quota/availability errors.
- Remember that AI providers can rate-limit requests or temporarily become unavailable.

### The frontend works locally but not after deployment

- Verify the Vercel environment variables for the correct deployment environment (Production, Preview, or Development).
- Redeploy after changing environment variables.
- Confirm the deployed app's origin is permitted by the relevant Edge Function CORS configuration.
- Check browser developer tools and Supabase function logs for errors.

### Urdu text or RTL layout looks incorrect

- Check that the selected UI language is Urdu and that the relevant translation exists.
- Test the page at both mobile and desktop widths.
- Confirm text direction and font styles are applied to the specific component, not only the overall page.

## Contributing

Contributions and bug reports are welcome. Before opening a pull request:

1. Run `npm run typecheck`.
2. Run `npm run test`.
3. Run `npm run build`.
4. Review `git diff` and ensure no secrets or unrelated formatting changes are included.
5. Preserve farm-data isolation, Row Level Security, and the application's principle of not inventing advice when required evidence is missing.

## License

No open-source license is currently specified in this README. Unless the repository includes a license file stating otherwise, all rights remain with the copyright holder.

## Support

For bugs and feature requests, open an issue in the GitHub repository.
