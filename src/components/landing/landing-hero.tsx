import { Link } from "react-router-dom";
import {
  ArrowRight,
  LayoutDashboard,
  MessageCircle,
  ScanLine,
  Sprout,
} from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { useI18n } from "../../context/PreferencesContext";

export function LandingHero() {
  const { t } = useI18n();

  const HIGHLIGHTS = [
    { icon: Sprout, title: t("hero.h1"), text: t("hero.h1Text") },
    { icon: ScanLine, title: t("hero.h2"), text: t("hero.h2Text") },
    { icon: MessageCircle, title: t("hero.h3"), text: t("hero.h3Text") },
  ];

  return (
    <section
      id="home"
      className="relative overflow-hidden bg-leaf-grid pt-24 sm:pt-28"
    >
      {/* Layered atmosphere: soft radial depth over the leaf-grid texture */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, color-mix(in oklch, var(--color-primary) 14%, transparent), transparent)",
        }}
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary-soft px-4 py-1.5 text-sm font-medium text-primary">
            <Sprout className="h-4 w-4" aria-hidden="true" />
            {t("hero.badge")}
          </p>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-foreground sm:text-5xl">
            {t("hero.titleA")}{" "}
            <span className="text-primary">{t("hero.titleB")}</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            {t("hero.subtitle")}
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to="/signup">
                {t("hero.cta")}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="w-full sm:w-auto"
            >
              <Link to="/dashboard">
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                {t("hero.explore")}
              </Link>
            </Button>
          </div>

          <div className="mt-12 grid gap-4 text-left sm:grid-cols-3">
            {HIGHLIGHTS.map((item) => (
              <Card key={item.title} className="p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-3 text-sm font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">{item.text}</p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}