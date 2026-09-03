import { Link } from "react-router-dom";
import { Sprout, ScanSearch, CloudSun, Sparkles, Tractor } from "lucide-react";
import { usePreferences } from "../../context/PreferencesContext";

/**
 * Left-hand visual panel for the split-screen auth pages (login / signup).
 *
 * Reproduces the reference design: a full-height dark Kissan AI green panel
 * with the brand mark near the top, welcome messaging, a short list of feature
 * highlights with icons, and a farming landscape rendered inline (SVG) as an
 * integrated background with a soft overlay so text stays readable. Hidden
 * below the lg breakpoint, where the form takes over.
 *
 * The heading and subtitle come from i18n keys so the same panel serves both
 * the login page ("Welcome Back!") and the signup page ("Join Kissan AI").
 */
const FEATURES = [
  { key: "auth.featCropDiagnosis", Icon: ScanSearch },
  { key: "auth.featWeather", Icon: CloudSun },
  { key: "auth.featRecommendations", Icon: Sparkles },
  { key: "auth.featFarmManagement", Icon: Tractor },
] as const;

function FarmScene() {
  return (
    <svg
      viewBox="0 0 480 300"
      preserveAspectRatio="xMidYMax slice"
      className="h-full w-full"
      aria-hidden="true"
      focusable="false"
    >
      {/* Pale sun behind the hills */}
      <circle cx="356" cy="52" r="34" fill="#f3e8b0" opacity="0.35" />
      <circle cx="356" cy="52" r="20" fill="#f7efc4" opacity="0.5" />

      {/* Distant hills */}
      <path
        d="M0 150 C 60 118, 120 118, 170 138 C 230 162, 290 150, 340 128 C 390 106, 440 122, 480 96 L 480 300 L 0 300 Z"
        fill="#2c6b3a"
        opacity="0.85"
      />
      {/* Mid hills */}
      <path
        d="M0 176 C 90 146, 180 152, 260 176 C 340 200, 400 182, 480 158 L 480 300 L 0 300 Z"
        fill="#1c5a2d"
        opacity="0.9"
      />
      {/* Foreground field */}
      <path
        d="M0 216 C 120 188, 260 192, 480 204 L 480 300 L 0 300 Z"
        fill="#0e471f"
      />

      {/* Crop rows converging toward the horizon */}
      <g stroke="rgba(255,255,255,0.16)" strokeWidth="1.6" fill="none" strokeLinecap="round">
        <path d="M-10 234 C 120 216, 300 216, 490 222" />
        <path d="M-10 252 C 120 236, 300 236, 490 240" />
        <path d="M-10 270 C 120 256, 300 256, 490 258" />
        <path d="M-10 288 C 120 276, 300 276, 490 276" />
      </g>

      {/* A lone tree silhouette */}
      <g fill="#0a2f16" opacity="0.9">
        <rect x="104" y="150" width="5" height="26" rx="2" />
        <circle cx="106" cy="142" r="16" />
        <circle cx="96" cy="150" r="10" />
        <circle cx="118" cy="151" r="11" />
      </g>
    </svg>
  );
}

export function LoginVisualPanel({
  titleKey = "auth.welcomeBack",
  subtitleKey = "auth.visualSubtitle",
}: {
  /** i18n key for the panel heading (defaults to the login copy). */
  titleKey?: string;
  /** i18n key for the panel supporting text (defaults to the login copy). */
  subtitleKey?: string;
}) {
  const { t } = usePreferences();

  return (
    <aside
      className="relative hidden w-[44%] shrink-0 overflow-hidden lg:flex lg:flex-col"
      style={{
        background:
          "linear-gradient(165deg, #1d512c 0%, #0b441b 55%, #083312 100%)",
      }}
      aria-hidden="false"
    >
      {/* Subtle leaf-grid texture */}
      <div className="absolute inset-0 bg-leaf-grid opacity-25" aria-hidden="true" />

      {/* Soft lime glow accents */}
      <div
        className="pointer-events-none absolute -end-24 -top-24 h-80 w-80 rounded-full bg-accent/20 blur-3xl"
        aria-hidden="true"
      />

      {/* Brand mark — near the top of the panel */}
      <Link
        to="/"
        className="relative z-20 flex items-center gap-3 p-10 xl:p-12 cursor-pointer"
        aria-label={t("brand.name")}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-inset ring-white/20">
          <Sprout className="h-6 w-6" aria-hidden="true" />
        </span>
        <span className="font-heading text-xl font-bold tracking-tight text-white">
          {t("brand.name")}
        </span>
      </Link>

      {/* Welcome + feature list (vertically centred) */}
      <div className="relative z-20 flex flex-1 flex-col justify-center px-10 pb-44 xl:px-12">
        <h2 className="font-heading text-4xl font-bold leading-[1.1] tracking-tight text-white xl:text-5xl">
          {t(titleKey)}
        </h2>
        <p className="mt-4 max-w-sm text-base leading-relaxed text-white/80">
          {t(subtitleKey)}
        </p>

        <ul className="mt-10 space-y-5">
          {FEATURES.map(({ key, Icon }) => (
            <li key={key} className="flex items-center gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-inset ring-white/15">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-base font-semibold text-white">
                {t(key)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Integrated farming imagery with a bottom fade overlay */}
      <div className="absolute inset-x-0 bottom-0 z-10 h-[52%]">
        <FarmScene />
        <div
          className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#0b441b] to-transparent"
          aria-hidden="true"
        />
      </div>
    </aside>
  );
}
