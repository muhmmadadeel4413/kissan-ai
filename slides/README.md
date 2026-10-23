# Kissan AI — pitch deck

A self-contained HTML slide deck: **14 slides, 16:9, 10-minute pitch**.
No build step, no internet needed, no dependencies — just open the file.

```
slides/
  index.html          the HTML deck (fullscreen, browser-only)
  Kissan-AI-Pitch.pptx the PowerPoint version
  build-pptx.mjs      regenerates the .pptx from the content below
  SCRIPT.md           what to say, per slide, with timings + Q&A prep
  img/                screenshots (drop yours here)
```

## PowerPoint version

`Kissan-AI-Pitch.pptx` is a real 16:9 deck with the same 14 slides, and the full
speaker script is in the **notes pane** of every slide (open with **View → Notes**,
or Alt+F5 for presenter view).

- Missing screenshots show as dashed placeholders in the file — replace them by
  **Paste**-ing your capture onto the slide, or re-drop the PNGs in `slides/img/`
  and rebuild: `node slides/build-pptx.mjs` (pptxgenjs is already in devDependencies).
- Urdu text uses `Noto Sans Urdu`; if a machine doesn't have it, PowerPoint
  substitutes a system Arabic font.

## Present

1. Double-click `index.html` (Chrome or Edge).
2. Press **F** for fullscreen, **← →** (or click left/right half) to move.
3. `Home` / `End` jump to the first / last slide.

The URL hash tracks the slide (`index.html#5`), so you can bookmark a starting point.

## Export to PDF / handout

`Ctrl+P` → Destination **Save as PDF** → Layout **Landscape** → **Background graphics: on**.
Each slide becomes one page.

## Screenshot slots

The deck renders a labelled placeholder wherever an image is missing, so it never breaks
mid-pitch. Drop the files in `slides/img/` with these exact names:

| File | Page to capture | Suggested state |
|---|---|---|
| `01-landing.png` | `/` (landing hero) | already captured |
| `02-dashboard.png` | `/dashboard` | farm with crop + weather loaded |
| `03-crop-doctor.png` | `/crop-doctor` | **a completed diagnosis, app in Urdu** |
| `04-assistant.png` | `/assistant` | a real answer with key points |
| `05-weather.png` | `/weather` or `/irrigation` | 7-day forecast visible |
| `06-risks.png` | `/risks` or `/actions` | at least one alert |
| `07-yield.png` | `/yield` or `/expenses` | estimate with factors |

**Capture tips**

- Desktop browser, window at least **1280 px wide**, browser zoom **100%**.
- Crop to the content area (no browser chrome, no taskbar) — the deck crops from the **top**.
- 16:10 or wider looks best; the frame is roughly 3:2.
- Take `03-crop-doctor.png` in **Urdu** — it's the slide that lands hardest, and it proves the language work.
- Keep file sizes sane (PNG under ~500 KB each is fine).

## Editing

Everything is in `index.html`: each slide is a `<section class="slide">`, styled by the
CSS at the top. Content uses plain HTML — change text directly, no tooling required.
Brand colours come from the app itself (`#11160f` background, `#8fb06a` / `#b4cd56` accents).
