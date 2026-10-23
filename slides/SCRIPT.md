# Kissan AI — 10-minute pitch script

**Deck:** `slides/index.html` (open in Chrome, press **F** for fullscreen, **←/→** to move)
**Export:** Ctrl+P → *Save as PDF* → Landscape → Background graphics **on**.
**Total:** 10:00 · 14 slides · ~40 s each. Slide 4–9 are the demo — rehearse those the most.

| # | Slide | Time | Running |
|---|---|---|---|
| 1 | Title | 0:25 | 0:25 |
| 2 | Problem | 0:50 | 1:15 |
| 3 | Solution | 0:45 | 2:00 |
| 4 | Demo · Dashboard | 0:40 | 2:40 |
| 5 | Demo · Crop Doctor | 0:55 | 3:35 |
| 6 | Demo · Assistant | 0:45 | 4:20 |
| 7 | Demo · Weather & Irrigation | 0:40 | 5:00 |
| 8 | Demo · Risks & Actions | 0:35 | 5:35 |
| 9 | Demo · Yield & Expenses | 0:35 | 6:10 |
| 10 | Urdu-first | 0:45 | 6:55 |
| 11 | Architecture | 0:50 | 7:45 |
| 12 | Engineering choices | 1:00 | 8:45 |
| 13 | Quality & security | 0:40 | 9:25 |
| 14 | Impact, roadmap, ask | 0:35 | 10:00 |

---

## 1 · Title — 25 s

> "Assalam-o-alaikum. I'm Muhammad Adeel, and this is **Kissan AI** — an AI farming assistant built for smallholder farmers in Pakistan.
>
> The one-line version: **farming advice that speaks your language.** Not just translated into Urdu — designed in Urdu from the first screen."

*Point at the live URL. Say it's deployed, not a mock-up.*

---

## 2 · Problem — 50 s

> "A farmer makes dozens of decisions in a season: when to water, when to spray, what's wrong with this leaf, is the weather about to ruin everything.
>
> Four things make that hard. Advice is scattered across the pesticide shop, YouTube, neighbours and an extension officer who visits twice a year. Risk is invisible until the damage is done. A proper diagnosis costs a photo, a journey and a wait — so most people guess, or over-spray. And almost every agri-app is English-first, which excludes exactly the people who farm.
>
> The information exists. It just never reaches the farmer in a form they can use."

---

## 3 · Solution — 45 s

> "So we put ten jobs in one app: crop diagnosis, an AI assistant with voice, weather, irrigation, risk alerts, today's actions, yield, crop calendar, expenses and a farm profile.
>
> Two languages that matter — Urdu and English — with full right-to-left layout.
>
> And it runs on a phone, in the field, on a weak connection."

*Don't read all ten cards. Sweep your hand across them.*

---

## 4 · Demo · Dashboard — 40 s

> "This is the whole farm on one screen. Today's weather and the week ahead, the crop and its stage, farm health, active risks, when irrigation is due, and recent diagnoses.
>
> Everything the AI needs to answer a question is already here — which is why the answers sound like they're about *this* farm, not farms in general."

---

## 5 · Demo · Crop Doctor — 55 s ⭐ (the money slide)

> "This is the part people react to. You take a photo of a sick leaf, and you get a diagnosis: what it probably is, how severe, how confident, why it happened, what to do — and what not to assume.
>
> Notice it's in Urdu, and the advice is a smallholder's advice: what you can actually afford and safely do.
>
> Two things I want to highlight. First, it's saved to history, so the farm remembers. Second — and this is the hard part — the language isn't left to the model's mood. The server checks the script of every field and repairs it if the model drifts back to English."

---

## 6 · Demo · Assistant — 45 s

> "You can just ask. 'What should I do today?' or 'meri fasal ke liye aaj kya karna chahiye?'
>
> It answers using the farm's own data — crop, stage, soil, water, weather, risks — and it can read the answer aloud, including the key points and the next steps, so a farmer who can't read comfortably can still use it."

*If the demo is live: do one short spoken question. Have a typed fallback ready.*

---

## 7 · Demo · Weather & Irrigation — 40 s

> "Weather is the easy part — forecast from Open-Meteo, no key, no billing. The useful part is what we do with it: every forecast is translated into farming impact, not just degrees.
>
> Irrigation combines that with soil type, irrigation method, crop stage and recent rain, and tells you when to water and roughly how much — and it explains why, so you can trust it."

---

## 8 · Demo · Risks & Actions — 35 s

> "The risk screen looks ahead: heat, frost, rain, wind, pest and disease windows. Every alert tells you what triggered it and when the window is.
>
> Then Today's Actions turns all of it into a short ordered list — ideally one screen the farmer can act on in under a minute."

---

## 9 · Demo · Yield & Expenses — 35 s

> "Finally, the season and the money. Yield gives an estimate *with the factors behind it* — not a magic number. Expenses track cost by category across the season, and the calendar ties sowing to harvest using the real crop stage.
>
> The point is the next season being cheaper and better planned than this one."

---

## 10 · Urdu-first — 45 s

> "I want to spend a slide on the decision I'm proudest of, because it's the one most teams skip.
>
> Urdu isn't a translation layer here — it's the product. Real right-to-left layout using logical properties, so screens mirror instead of breaking. Noto Sans Urdu for the UI, because Nastaliq is beautiful but unreadable at 13 pixels. And the AI answers in the language the app is set to, enforced on the server.
>
> There's also a test that fails the build if English and Urdu ever drift apart. [Point at the Urdu strip.] That's the product, not a translation of it."

---

## 11 · Architecture — 50 s

> "The stack is deliberately boring. React, TypeScript, Vite and Tailwind on the client; Supabase for Postgres, auth, storage and row-level security; ten Deno edge functions for anything that needs a secret; Gemini for vision, text and speech, with OpenRouter as a fallback; Open-Meteo for weather, which is free and needs no key.
>
> The browser never sees an API key. That was a hard rule from day one."

---

## 12 · Engineering choices — 60 s ⭐ (the technical slide)

> "Here's the design decision that makes the rest work.
>
> Anything that must be right is deterministic code, not a model. Growth stage, risk scoring, irrigation amounts and yield are plain TypeScript engines — same input, same answer, explainable, testable, and free.
>
> The model only does language: reading the photo and writing the sentence. It never decides the risk score or the watering amount.
>
> And because models drift, the language is enforced server-side: prompt, schema hints, a script check on every field, and a repair pass if the output comes back in the wrong language."

---

## 13 · Quality & security — 40 s

> "76 automated tests, every table behind row-level security, every function JWT-verified, and typecheck plus a production build gating changes.
>
> And no placeholder numbers in the interface: when data is missing, the screen says so instead of inventing it."

---

## 14 · Close — 35 s

> "So: it's built, it's deployed, and it's in Urdu.
>
> What it needs now is farmers. My ask is a pilot with 25 to 50 farmers this season, and mentorship on turning this prototype into something they keep using after harvest.
>
> Thank you — happy to take questions, and happy to demo in Urdu."

---

# Before you present

**Technical**
- [ ] Open `slides/index.html` in Chrome. Press `F`. Check every slide fits (no scrollbars).
- [ ] Screenshots are in `slides/img/` — see `slides/README.md` for the exact capture list.
- [ ] Sign in to the live app in a **second tab**, already on the Dashboard.
- [ ] Pre-load the Crop Doctor with a photo ready on the desktop (not buried in Downloads).
- [ ] Run one full analysis **before** the pitch so you know the network is fine.
- [ ] Toggle the app to Urdu, then back to English, once — confirm the DB isn't slow today.
- [ ] Offline plan: if the venue Wi-Fi dies, present the screenshots and say so honestly.

**Delivery**
- [ ] Don't read the slides. The bullets are for the audience; your voice carries the story.
- [ ] Pause after the Crop Doctor result appears — let them read the Urdu.
- [ ] Slow down on slide 12; that's where technical judges decide whether you built or assembled.
- [ ] End with the ask, not "that's all".

---

# Likely questions

**"Is this just a ChatGPT wrapper?"**
> No. The assistant is grounded in this farm's data, and the decisions that must be right — risk scores, irrigation amounts, yield — are deterministic code with tests. The model does language, not judgement.

**"How accurate is the diagnosis?"**
> It's a vision model with a confidence score and an explicit caveat; it's decision support, not a lab test. The UI never presents a low-confidence guess as fact. Accuracy improves with a real pilot and agronomist review — which is part of the ask.

**"What about farmers without smartphones?"**
> That's the roadmap: SMS and IVR for feature phones. The backend already returns short structured text, which is exactly what SMS needs.

**"Where does the data come from and who owns it?"**
> Weather is Open-Meteo. Farm, diagnosis and expense records live in the farmer's own Supabase rows, protected by row-level security — one farmer can't read another's farm.

**"What does it cost per user?"**
> Near zero at pilot scale: Vercel and Supabase free tiers, Open-Meteo free, and a Gemini call per diagnosis. The model layer is abstracted, so we can swap providers on price.

**"What was the hardest part?"**
> Making Urdu a first-class language instead of a translation: right-to-left layout, readable typography at small sizes, and making the AI reliably answer in the selected language — which had to be enforced on the server, not requested in a prompt.

**"What's next?"**
> A pilot cohort, an agronomist review loop, then SMS/IVR and offline caching.
