import PptxGenJS from "pptxgenjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Run from anywhere: images and output live next to this script. */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const IMGDIR = path.join(HERE, "img") + "/";
const OUT = path.join(HERE, "Kissan-AI-Pitch.pptx");

const C = {
  bg: "11160F",
  panel: "151D12",
  panel2: "1B2417",
  line: "26321F",
  chip: "212C1A",
  ink: "E9EFE1",
  muted: "9FAC93",
  dim: "6F7D66",
  lime: "8FB06A",
  accent: "B4CD56",
  logo: "3E7C4F",
};

const URDU = "Noto Sans Urdu";
const F = "Segoe UI";

const W = 13.33;
const MX = 0.62;
const CW = W - MX * 2;

const pptx = new PptxGenJS();
pptx.defineLayout({ name: "W16x9", width: 13.33, height: 7.5 });
pptx.layout = "W16x9";
pptx.author = "Muhammad Adeel";
pptx.company = "Kissan AI";
pptx.title = "Kissan AI — Pitch Deck";
pptx.theme = { headFontFace: F, bodyFontFace: F };

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

function chrome(s, kicker, idx) {
  s.background = { color: C.bg };

  s.addShape(pptx.ShapeType.roundRect, {
    x: MX, y: 0.34, w: 0.34, h: 0.34, rectRadius: 0.07,
    fill: { color: C.logo }, line: { type: "none", color: C.logo },
  });
  s.addText("Kissan AI", {
    x: MX + 0.42, y: 0.3, w: 2.4, h: 0.42,
    fontSize: 12.5, bold: true, color: C.ink, valign: "middle", fontFace: F,
  });

  if (kicker) {
    s.addText(kicker, {
      x: W - MX - 4.6, y: 0.36, w: 4.6, h: 0.3,
      fontSize: 9, bold: true, color: C.dim, align: "right",
      charSpacing: 2.2, fontFace: F,
    });
  }

  s.addText("Kissan AI · pitch", {
    x: MX, y: 7.06, w: 3.2, h: 0.26, fontSize: 8.5, color: C.dim, fontFace: F,
  });
  s.addText(`${idx} / 14`, {
    x: W - MX - 1.1, y: 7.06, w: 1.1, h: 0.26, fontSize: 8.5, color: C.dim,
    align: "right", fontFace: F,
  });
}

function head(s, runs, y = 1.08, size = 26, h = 1.0) {
  s.addText(runs, {
    x: MX, y, w: CW, h, fontSize: size, bold: true, color: C.ink,
    valign: "top", lineSpacing: size * 1.15, fontFace: F, charSpacing: 0,
  });
}

function card(s, x, y, w, h, title, body, opts = {}) {
  s.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.09,
    fill: { color: opts.fill ?? C.panel },
    line: { color: opts.line ?? C.line, width: 1 },
  });

  const ty = y + 0.16;
  if (opts.num !== undefined) {
    s.addText(String(opts.num), {
      x: x + 0.2, y: ty, w: 0.6, h: 0.3,
      fontSize: 11.5, bold: true, color: C.accent, fontFace: F,
    });
  }

  s.addText(title, {
    x: x + 0.2, y: opts.num !== undefined ? ty + 0.26 : ty,
    w: w - 0.4, h: 0.32,
    fontSize: opts.titleSize ?? 12.5, bold: true, color: C.ink, fontFace: F,
  });

  s.addText(body, {
    x: x + 0.2, y: opts.num !== undefined ? ty + 0.58 : ty + 0.38,
    w: w - 0.4, h: h - (opts.num !== undefined ? 0.86 : 0.62),
    fontSize: opts.bodySize ?? 10, color: C.muted,
    valign: "top", lineSpacing: 13.5, fontFace: F,
  });
}

function bullets(s, x, y, w, h, items, opts = {}) {
  s.addText(
    items.map((t) => ({ text: t + "\n", options: {} })),
    {
      x, y, w, h,
      fontSize: opts.size ?? 11.5, color: opts.color ?? C.ink,
      valign: "top", lineSpacing: (opts.spacing ?? 26), fontFace: F,
      bullet: { characterCode: "2022", indent: 16 },
    },
  );
}

function stat(s, x, y, w, h, value, label) {
  s.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.09,
    fill: { color: C.panel }, line: { color: C.line, width: 1 },
  });
  s.addText(value, {
    x: x + 0.18, y: y + 0.14, w: w - 0.36, h: 0.52,
    fontSize: 21, bold: true, color: C.accent, fontFace: F,
  });
  s.addText(label, {
    x: x + 0.18, y: y + 0.66, w: w - 0.36, h: h - 0.76,
    fontSize: 9, color: C.muted, valign: "top", lineSpacing: 11.5, fontFace: F,
  });
}

function shot(s, x, y, w, h, file, label) {
  const p = IMGDIR + file;
  const exists = fs.existsSync(p);

  if (exists) {
    s.addImage({ path: p, x, y, w, h, sizing: { type: "cover", w, h } });
    s.addShape(pptx.ShapeType.rect, {
      x, y, w, h,
      fill: { color: C.bg, transparency: 100 },
      line: { color: "2A3626", width: 1 },
    });
    return;
  }

  s.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.09,
    fill: { color: "0D120A" },
    line: { color: "39452F", width: 1.25, dashType: "dash" },
  });
  s.addText(label, {
    x: x + 0.2, y: y + h / 2 - 0.4, w: w - 0.4, h: 0.35,
    fontSize: 12, bold: true, color: C.muted, align: "center", fontFace: F,
  });
  s.addText("paste screenshot as slides/img/" + file, {
    x: x + 0.2, y: y + h / 2, w: w - 0.4, h: 0.3,
    fontSize: 8.5, color: C.dim, align: "center", fontFace: F,
  });
}

const MODULES = [
  ["Crop Doctor", "Photo → diagnosis"],
  ["AI Assistant", "Chat + voice"],
  ["Weather", "7-day + impact"],
  ["Irrigation", "When and how much"],
  ["Risk alerts", "Before the damage"],
  ["Today's actions", "Prioritised list"],
  ["Yield", "Estimate + factors"],
  ["Crop calendar", "Sow → harvest"],
  ["Expenses", "Cost per season"],
  ["Farm profile", "Soil, water, crop"],
];

/* ------------------------------------------------------------------ */
/* 1 · TITLE                                                          */
/* ------------------------------------------------------------------ */

{
  const s = pptx.addSlide();
  chrome(s, "Final year project · 2026", 1);

  s.addShape(pptx.ShapeType.roundRect, {
    x: MX, y: 1.42, w: 4.9, h: 0.46, rectRadius: 0.23,
    fill: { color: "1C2612" }, line: { color: "3A4A26", width: 1 },
  });
  s.addText([
    { text: "●  ", options: { color: C.accent, fontSize: 8 } },
    { text: "Urdu-first · Offline-tolerant · Built for smallholders", options: { color: "D6E6AC", fontSize: 10.5, bold: true, fontFace: F } },
  ], { x: MX + 0.2, y: 1.42, w: 4.7, h: 0.46, valign: "middle", fontFace: F });

  s.addText([
    { text: "Farming advice\n", options: { color: C.ink } },
    { text: "that speaks\n", options: { color: C.ink } },
    { text: "your language.", options: { color: C.accent } },
  ], {
    x: MX, y: 2.2, w: 6.4, h: 2.35,
    fontSize: 38, bold: true, lineSpacing: 44, fontFace: F,
  });

  s.addText(
    "An AI assistant that turns a crop photo, today's weather and the farm's own records into one clear next step — in Urdu or English.",
    {
      x: MX, y: 4.75, w: 5.9, h: 1.0,
      fontSize: 13, color: C.muted, lineSpacing: 19, valign: "top", fontFace: F,
    },
  );

  s.addText([
    { text: "Presented by  ", options: { color: C.dim } },
    { text: "Muhammad Adeel", options: { color: C.muted, bold: true } },
    { text: "        Live  ", options: { color: C.dim } },
    { text: "kissan-ai-six.vercel.app", options: { color: C.muted, bold: true } },
  ], { x: MX, y: 6.2, w: 6.2, h: 0.34, fontSize: 10.5, fontFace: F });

  shot(s, 7.5, 1.42, 5.2, 5.1, "01-landing.png", "Landing page");
  s.addNotes(
    "ASSALAM-O-ALAIKUM. I'm Muhammad Adeel, and this is Kissan AI — an AI farming assistant built for smallholder farmers in Pakistan.\n" +
    "The one-line version: farming advice that speaks your language. Not just translated into Urdu — designed in Urdu from the first screen.\n" +
    "([25 s] Point at the live URL. Say it's deployed, not a mock-up.)"
  );
}

/* ------------------------------------------------------------------ */
/* 2 · PROBLEM                                                        */
/* ------------------------------------------------------------------ */

{
  const s = pptx.addSlide();
  chrome(s, "The problem", 2);

  head(s, [
    { text: "A farmer makes dozens of decisions a season, with ", options: {} },
    { text: "nobody to ask.", options: { color: C.accent } },
  ], 1.08, 26, 1.5);

  const cw = (CW - 0.26) / 2;
  const kh = 1.55;
  card(s, MX, 2.25, cw, kh, "Advice is scattered", "Pesticide shop, YouTube, neighbours, the extension officer who visits twice a year. Nobody agrees.");
  card(s, MX + cw + 0.26, 2.25, cw, kh, "Risk stays invisible", "Heat, frost, untimely rain and disease pressure are only noticed after the damage is done.");
  card(s, MX, 4.0, cw, kh, "Diagnosis costs a trip", "A sick leaf means a photo, a journey and a wait — so most farmers guess, or over-spray.");
  card(s, MX + cw + 0.26, 4.0, cw, kh, "English-only tools exclude", "The people who farm are least served by apps written for a different user in a different language.");

  s.addText(
    "The information exists. It just never reaches the farmer in a form they can use, in a language they read.",
    {
      x: MX, y: 5.95, w: CW - 0.2, h: 0.6,
      fontSize: 11.5, color: C.muted, valign: "middle",
      fontFace: F, border: { pt: 0, color: C.bg },
    },
  );
  s.addShape(pptx.ShapeType.rect, { x: MX, y: 5.95, w: 0.045, h: 0.6, fill: { color: C.accent } });

  s.addNotes(
    "A farmer makes dozens of decisions in a season: when to water, when to spray, what's wrong with this leaf, is the weather about to ruin everything.\n" +
    "Four things make that hard. Advice is scattered across the pesticide shop, YouTube, neighbours and an extension officer who visits twice a year. Risk is invisible until the damage is done. A proper diagnosis costs a photo, a journey and a wait — so most people guess, or over-spray. And almost every agri-app is English-first, which excludes exactly the people who farm.\n" +
    "The information exists. It just never reaches the farmer in a form they can use.\n([50 s])"
  );
}

/* ------------------------------------------------------------------ */
/* 3 · SOLUTION                                                       */
/* ------------------------------------------------------------------ */

{
  const s = pptx.addSlide();
  chrome(s, "The solution", 3);

  head(s, [
    { text: "One app. Ten jobs. ", options: {} },
    { text: "Two languages that actually matter.", options: { color: C.accent } },
  ], 1.05, 26, 1.0);

  const cols = 5;
  const gap = 0.14;
  const mw = (CW - gap * (cols - 1)) / cols;

  MODULES.forEach((m, k) => {
    const cx = MX + (k % cols) * (mw + gap);
    const cy = 2.28 + Math.floor(k / cols) * 1.12;
    s.addShape(pptx.ShapeType.roundRect, {
      x: cx, y: cy, w: mw, h: 0.98, rectRadius: 0.08,
      fill: { color: C.panel }, line: { color: C.line, width: 1 },
    });
    s.addText(m[0], { x: cx + 0.12, y: cy + 0.13, w: mw - 0.24, h: 0.3, fontSize: 10.5, bold: true, color: C.ink, fontFace: F });
    s.addText(m[1], { x: cx + 0.12, y: cy + 0.45, w: mw - 0.24, h: 0.32, fontSize: 8, color: C.muted, fontFace: F });
  });

  const sw = (CW - 0.21 * 3) / 4;
  const vals = [
    ["25+", "crops recognised"],
    ["2", "UI languages, full RTL"],
    ["10", "serverless AI functions"],
    ["0", "API keys in the browser"],
  ];
  vals.forEach((v, k) => {
    stat(s, MX + k * (sw + 0.21), 4.85, sw, 1.15, v[0], v[1]);
  });

  s.addText("Built for a phone, in the field, on a weak connection.", {
    x: MX, y: 6.35, w: CW, h: 0.4, fontSize: 11, color: C.dim, align: "center", fontFace: F,
  });

  s.addNotes(
    "So we put ten jobs in one app: crop diagnosis, an AI assistant with voice, weather, irrigation, risk alerts, today's actions, yield, crop calendar, expenses and a farm profile.\n" +
    "Two languages that matter — Urdu and English — with full right-to-left layout.\n" +
    "And it runs on a phone, in the field, on a weak connection.\n" +
    "([45 s] Don't read all ten cards. Sweep your hand across them.)"
  );
}

/* ------------------------------------------------------------------ */
/* 4–9 · DEMO SLIDES                                                  */
/* ------------------------------------------------------------------ */

const DEMOS = [
  {
    idx: 4, kicker: "Live demo · 1 of 6", img: "02-dashboard.png", label: "Dashboard",
    title: [
      { text: "The whole farm\n", options: {} },
      { text: "on one screen.", options: { color: C.accent } },
    ],
    notes: "This is the whole farm on one screen. Today's weather and the week ahead, the crop and its stage, farm health, active risks, when irrigation is due, and recent diagnoses.\nEverything the AI needs to answer a question is already here — which is why the answers sound like they're about THIS farm, not farms in general.\n([40 s])",
    items: [
      "Today's weather and the 7-day outlook — in one glance",
      "Crop stage, farm health and active risks",
      "Irrigation due, recent diagnoses, tasks for today",
      "Everything the AI needs, already on the page",
    ],
  },
  {
    idx: 5, kicker: "Live demo · 2 of 6", img: "03-crop-doctor.png", label: "Crop Doctor result (capture in Urdu)", flip: true,
    title: [
      { text: "Photo in. Diagnosis out — ", options: {} },
      { text: "in Urdu.", options: { color: C.accent } },
    ],
    notes: "This is the part people react to. You take a photo of a sick leaf, and you get a diagnosis: what it probably is, how severe, how confident, why it happened, what to do — and what not to assume.\nNotice it's in Urdu, and the advice is a smallholder's advice: what you can actually afford and safely do.\nTwo things I want to highlight. First, it's saved to history, so the farm remembers. Second — the language isn't left to the model's mood. The server checks the script of every field and repairs it if the model drifts back to English.\n([55 s — pause and let the panel read the Urdu.])",
    items: [
      "Camera or gallery → compressed upload",
      "Vision model returns severity, confidence, causes, actions, caveats",
      "Saved to history so the farm remembers",
      "Language checked server-side, not left to the model's mood",
    ],
  },
  {
    idx: 6, kicker: "Live demo · 3 of 6", img: "04-assistant.png", label: "AI Assistant",
    title: [
      { text: "Ask it the way\n", options: {} },
      { text: "you'd ask a neighbour.", options: { color: C.accent } },
    ],
    notes: "You can just ask. 'What should I do today?' or 'meri fasal ke liye aaj kya karna chahiye?'\nIt answers using the farm's own data — crop, stage, soil, water, weather, risks — and it can read the answer aloud, including key points and next steps, so a farmer who can't read comfortably can still use it.\n([45 s] If live: one short spoken question. Have a typed fallback ready.)",
    items: [
      "Answers grounded in this farm: crop, stage, soil, water, weather, risks",
      "Type or hold the mic — speech in, speech out",
      "Reply is read aloud, including key points and next steps",
      "'What should I do today?' works in Urdu and English",
    ],
  },
  {
    idx: 7, kicker: "Live demo · 4 of 6", img: "05-weather.png", label: "Weather / Irrigation", flip: true,
    title: [
      { text: "Irrigate on evidence,\n", options: {} },
      { text: "not on habit.", options: { color: C.accent } },
    ],
    notes: "Weather is the easy part — forecast from Open-Meteo, no key, no billing. The useful part is what we do with it: every forecast is translated into farming impact, not just degrees.\nIrrigation combines that with soil type, irrigation method, crop stage and recent rain, and tells you when to water and roughly how much — and it explains why, so you can trust it.\n([40 s])",
    items: [
      "Forecast from Open-Meteo — no key, no billing, no lock-in",
      "Weather translated into farming impact, not just degrees",
      "Irrigation advice uses soil type, method, crop stage and recent rain",
      "Every recommendation says why, so it can be trusted",
    ],
  },
  {
    idx: 8, kicker: "Live demo · 5 of 6", img: "06-risks.png", label: "Risks / Today's Actions",
    title: [
      { text: "Know what's coming.\n", options: {} },
      { text: "And what to do about it.", options: { color: C.accent } },
    ],
    notes: "The risk screen looks ahead: heat, frost, rain, wind, pest and disease windows. Every alert tells you what triggered it and when the window is.\nThen Today's Actions turns all of it into a short ordered list — ideally one screen the farmer can act on in under a minute.\n([35 s])",
    items: [
      "Heat, frost, rain, wind, pest and disease windows",
      "Each alert explains the trigger and the window",
      "Today's Actions turn everything into a short, ordered list",
      "One screen the farmer can act on in 60 seconds",
    ],
  },
  {
    idx: 9, kicker: "Live demo · 6 of 6", img: "07-yield.png", label: "Yield / Expenses", flip: true,
    title: [
      { text: "Plan the season.\n", options: {} },
      { text: "And the money.", options: { color: C.accent } },
    ],
    notes: "Finally, the season and the money. Yield gives an estimate WITH the factors behind it — not a magic number. Expenses track cost by category across the season, and the calendar ties sowing to harvest using the real crop stage.\nThe point is the next season being cheaper and better planned than this one.\n([35 s])",
    items: [
      "Yield estimate with the factors behind it — not a magic number",
      "Costs tracked by category across the season",
      "Sowing → harvest calendar tied to the real crop stage",
      "Comparisons that make the next season cheaper",
    ],
  },
];

for (const d of DEMOS) {
  const s = pptx.addSlide();
  chrome(s, d.kicker, d.idx);

  const imgOnLeft = !!d.flip;
  const imgW = 6.0, imgH = 4.6, imgY = 1.55;
  const imgX = imgOnLeft ? MX : W - MX - imgW;
  const txtX = imgOnLeft ? MX + imgW + 0.5 : MX;
  const txtW = CW - imgW - 0.5;

  if (imgOnLeft) shot(s, imgX, imgY, imgW, imgH, d.img, d.label);
  else shot(s, imgX, imgY, imgW, imgH, d.img, d.label);

  s.addText(d.title, {
    x: txtX, y: 1.55, w: txtW, h: 1.55,
    fontSize: 24, bold: true, lineSpacing: 28, valign: "top", fontFace: F,
  });

  bullets(s, txtX, 3.2, txtW, 2.9, d.items, { size: 11.5, spacing: 27 });

  s.addNotes(d.notes);
}

/* ------------------------------------------------------------------ */
/* 10 · URDU-FIRST                                                    */
/* ------------------------------------------------------------------ */

{
  const s = pptx.addSlide();
  chrome(s, "Design decision", 10);

  head(s, [
    { text: "Urdu isn't a translation layer.\n", options: {} },
    { text: "It's the product.", options: { color: C.accent } },
  ], 1.05, 26, 1.5);

  const cw3 = (CW - 0.32) / 3;
  card(s, MX, 2.55, cw3, 1.5, "Real RTL, not flipped", "Logical spacing and alignment throughout, so layouts mirror correctly instead of breaking.");
  card(s, MX + cw3 + 0.16, 2.55, cw3, 1.5, "Typography that stays readable", "Noto Sans Urdu for UI at 12–16 px; no root font scaling, so nothing overflows.");
  card(s, MX + (cw3 + 0.16) * 2, 2.55, cw3, 1.5, "AI follows the UI", "Diagnosis and chat answer in the selected language — verified on the server.");

  function urduStrip(y, tag, text) {
    s.addShape(pptx.ShapeType.roundRect, {
      x: MX, y, w: CW, h: 0.62, rectRadius: 0.08,
      fill: { color: C.panel2 }, line: { color: C.line, width: 1 },
    });
    s.addText(tag, {
      x: MX + 0.2, y: y + 0.05, w: 1.0, h: 0.52,
      fontSize: 8.5, bold: true, color: C.dim, valign: "middle", charSpacing: 1.5, fontFace: F,
    });
    s.addText(text, {
      x: MX + 1.3, y: y + 0.03, w: CW - 1.7, h: 0.56,
      fontSize: 13, color: C.ink, align: "right", valign: "middle",
      fontFace: URDU, rtlMode: true,
    });
  }
  urduStrip(4.35, "UI  ·  ENGLISH", "What should I do today?");
  urduStrip(5.07, "UI  ·  URDU", "آج کیا کرنا ہے؟");
  urduStrip(5.79, "AI  ·  URDU", "آلو کے پتوں پر دھبے دیر سے جھلسنے کی علامت ہیں۔");

  s.addShape(pptx.ShapeType.rect, { x: MX, y: 6.6, w: 0.045, h: 0.4, fill: { color: C.accent } });
  s.addText("Every key exists in both dictionaries, and a test fails the build if English and Urdu drift apart.", {
    x: MX + 0.18, y: 6.6, w: CW - 0.2, h: 0.4,
    fontSize: 10.5, color: C.muted, valign: "middle", fontFace: F,
  });

  s.addNotes(
    "I want to spend a slide on the decision I'm proudest of, because it's the one most teams skip.\n" +
    "Urdu isn't a translation layer here — it's the product. Real right-to-left layout using logical properties, so screens mirror instead of breaking. Noto Sans Urdu for the UI, because Nastaliq is beautiful but unreadable at 13 pixels. And the AI answers in the language the app is set to, enforced on the server.\n" +
    "There's also a test that fails the build if English and Urdu ever drift apart. [Point at the Urdu strip.] That's the product, not a translation of it.\n([45 s])"
  );
}

/* ------------------------------------------------------------------ */
/* 11 · ARCHITECTURE                                                  */
/* ------------------------------------------------------------------ */

{
  const s = pptx.addSlide();
  chrome(s, "How it works", 11);

  head(s, [
    { text: "A small stack with ", options: {} },
    { text: "nothing to babysit.", options: { color: C.accent } },
  ], 1.05, 24, 0.6);

  const rows = [
    ["Client", [["React 18", true], ["TypeScript", false], ["Vite 7", false], ["Tailwind 4", false], ["Radix UI", false], ["Recharts", false], ["Vercel", false]]],
    ["Backend", [["Supabase Postgres", true], ["Row Level Security", false], ["Auth", false], ["Storage", false], ["7 tables", false]]],
    ["Edge functions", [["analyze-crop", false], ["chat-assistant", false], ["assess-risks", false], ["irrigation-advisor", false], ["today-actions", false], ["recommend-crops", false], ["get-weather", false], ["speak-answer", false], ["sarvam-stt", false], ["whisper-stt", false]]],
    ["AI & data", [["Gemini — vision, text, speech", true], ["OpenRouter fallback", false], ["Open-Meteo forecast", false]]],
  ];

  let y = 1.95;
  for (const [label, chips] of rows) {
    s.addText(label.toUpperCase(), {
      x: MX, y: y + 0.05, w: 1.75, h: 0.85,
      fontSize: 8.5, bold: true, color: C.dim, align: "right",
      valign: "middle", charSpacing: 1.6, fontFace: F,
    });

    s.addShape(pptx.ShapeType.roundRect, {
      x: MX + 1.95, y, w: CW - 1.95, h: 0.9, rectRadius: 0.08,
      fill: { color: C.panel }, line: { color: C.line, width: 1 },
    });

    const runs = [];
    chips.forEach(([t, hi], i) => {
      if (i > 0) runs.push({ text: "   ", options: {} });
      runs.push({
        text: t,
        options: {
          color: hi ? "DCECB0" : C.ink,
          bold: !!hi,
          fill: { color: hi ? "2A3B1C" : "1F2A18" },
        },
      });
    });

    s.addText(runs, {
      x: MX + 2.15, y: y + 0.1, w: CW - 2.35, h: 0.7,
      fontSize: 9.5, valign: "middle", fontFace: "Consolas",
    });

    y += 1.12;
    if (rows.indexOf(rows.find((r) => r[0] === label)) < rows.length - 1) {
      s.addText("▼", { x: W / 2 - 0.4, y: y - 0.24, w: 0.8, h: 0.3, fontSize: 8, color: C.dim, align: "center", fontFace: F });
    }
  }

  s.addShape(pptx.ShapeType.rect, { x: MX, y: 6.62, w: 0.045, h: 0.4, fill: { color: C.accent } });
  s.addText("Secrets live only in Edge Function env vars. The browser never sees a model key.", {
    x: MX + 0.18, y: 6.62, w: CW - 0.2, h: 0.4, fontSize: 10.5, color: C.muted, valign: "middle", fontFace: F,
  });

  s.addNotes(
    "The stack is deliberately boring. React, TypeScript, Vite and Tailwind on the client; Supabase for Postgres, auth, storage and row-level security; ten Deno edge functions for anything that needs a secret; Gemini for vision, text and speech, with OpenRouter as a fallback; Open-Meteo for weather, which is free and needs no key.\n" +
    "The browser never sees an API key. That was a hard rule from day one.\n([50 s])"
  );
}

/* ------------------------------------------------------------------ */
/* 12 · ENGINEERING CHOICES                                           */
/* ------------------------------------------------------------------ */

{
  const s = pptx.addSlide();
  chrome(s, "Engineering choices", 12);

  head(s, [
    { text: "AI where it helps. ", options: {} },
    { text: "Deterministic code where it matters.", options: { color: C.accent } },
  ], 1.05, 24, 1.4);

  const cw2 = (CW - 0.26) / 2;
  card(s, MX, 2.5, cw2, 1.85, "Rules, not guesses", "Growth stage, risk scoring, irrigation and yield are plain TypeScript engines. Same input, same answer — explainable, testable, free.", { num: 1 });
  card(s, MX + cw2 + 0.26, 2.5, cw2, 1.85, "The model only does language", "Gemini reads the photo and writes the sentence. It never decides the risk score or the watering amount.", { num: 2 });
  card(s, MX, 4.55, cw2, 1.85, "Language is enforced server-side", "Prompt + schema hints + a script check on every field, with a repair pass if the model drifts back to English.", { num: 3 });
  card(s, MX + cw2 + 0.26, 4.55, cw2, 1.85, "Degrade, don't fail", "Rate-limited model → second provider. Weather source down → cached view. Missing data → the UI says so.", { num: 4 });

  s.addNotes(
    "Here's the design decision that makes the rest work.\n" +
    "Anything that must be right is deterministic code, not a model. Growth stage, risk scoring, irrigation amounts and yield are plain TypeScript engines — same input, same answer, explainable, testable, and free.\n" +
    "The model only does language: reading the photo and writing the sentence. It never decides the risk score or the watering amount.\n" +
    "And because models drift, the language is enforced server-side: prompt, schema hints, a script check on every field, and a repair pass if the output comes back in the wrong language.\n([60 s — this is where technical judges decide whether you built or assembled.])"
  );
}

/* ------------------------------------------------------------------ */
/* 13 · QUALITY & SECURITY                                            */
/* ------------------------------------------------------------------ */

{
  const s = pptx.addSlide();
  chrome(s, "Quality & security", 13);

  head(s, [{ text: "Boring on purpose.", options: {} }], 1.08, 26, 0.7);

  const sw = (CW - 0.21 * 3) / 4;
  const vals = [
    ["76", "automated tests"],
    ["100%", "tables behind RLS"],
    ["10", "JWT-verified functions"],
    ["0", "secrets shipped to users"],
  ];
  vals.forEach((v, k) => {
    stat(s, MX + k * (sw + 0.21), 2.15, sw, 1.3, v[0], v[1]);
  });

  bullets(s, MX, 3.95, CW - 0.2, 2.6, [
    "Every table is row-level secured — one farmer never sees another's farm",
    "Function calls are JWT-verified, with an explicit CORS allow-list",
    "Typecheck and production build gate every change; tests cover engines, i18n parity and voice",
    "No placeholder numbers in the UI: when data is missing, it says so",
  ], { size: 11.5, spacing: 30 });

  s.addNotes(
    "76 automated tests, every table behind row-level security, every function JWT-verified, and typecheck plus a production build gating changes.\n" +
    "And no placeholder numbers in the interface: when data is missing, the screen says so instead of inventing it.\n([40 s])"
  );
}

/* ------------------------------------------------------------------ */
/* 14 · CLOSE                                                         */
/* ------------------------------------------------------------------ */

{
  const s = pptx.addSlide();
  chrome(s, "Impact · Roadmap · Ask", 14);

  head(s, [
    { text: "Built and shipped.\n", options: {} },
    { text: "Now it needs farmers.", options: { color: C.accent } },
  ], 1.05, 26, 1.5);

  const cw3 = (CW - 0.32) / 3;
  const cw2 = (CW - 0.26) / 2;
  card(s, MX, 2.6, cw3, 1.45, "Next: reach", "SMS and IVR for feature phones — no smartphone, no data plan required.");
  card(s, MX + cw3 + 0.16, 2.6, cw3, 1.45, "Next: offline", "Cache today's advice and the crop calendar so the field has no dead zones.");
  card(s, MX + (cw3 + 0.16) * 2, 2.6, cw3, 1.45, "Next: trust", "An agronomist review loop that audits AI diagnoses and feeds corrections back.");

  card(s, MX, 4.35, cw2, 1.5, "The ask", "A pilot with 25–50 farmers this season, and mentorship on turning the prototype into a service they keep using after harvest.", {
    fill: "24300F", line: "3C5220",
  });
  card(s, MX + cw2 + 0.26, 4.35, cw2, 1.5, "Why it can work", "Free-tier infrastructure, a model-agnostic backend and Urdu-first design mean each extra farmer costs almost nothing.");

  s.addText([
    { text: "Thank you.", options: { fontSize: 24, bold: true, color: C.ink } },
    { text: "    Questions — and an Urdu demo — welcome.", options: { fontSize: 12, color: C.dim } },
  ], { x: MX, y: 6.25, w: CW, h: 0.5, valign: "middle", fontFace: F });

  s.addNotes(
    "So: it's built, it's deployed, and it's in Urdu.\n" +
    "What it needs now is farmers. My ask is a pilot with 25 to 50 farmers this season, and mentorship on turning this prototype into something they keep using after harvest.\n" +
    "Thank you — happy to take questions, and happy to demo in Urdu.\n([35 s] End with the ask, not 'that's all'.)"
  );
}

/* ------------------------------------------------------------------ */

pptx.writeFile({ fileName: OUT }).then(() => {
  const size = fs.statSync(OUT).size;
  console.log(`written: ${OUT} (${(size / 1024).toFixed(0)} KB)`);
});
