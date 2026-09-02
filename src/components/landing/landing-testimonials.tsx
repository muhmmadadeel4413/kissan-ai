import { Quote, Star } from "lucide-react";
import { useI18n } from "../../context/PreferencesContext";

export function LandingTestimonials() {
  const { t } = useI18n();

  const TESTIMONIALS = [
    { quote: t("testimonials.q1"), name: t("testimonials.n1"), role: t("testimonials.r1") },
    { quote: t("testimonials.q2"), name: t("testimonials.n2"), role: t("testimonials.r2") },
    { quote: t("testimonials.q3"), name: t("testimonials.n3"), role: t("testimonials.r3") },
  ];

  return (
    <section id="testimonials" className="scroll-mt-24 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            {t("testimonials.eyebrow")}
          </p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            {t("testimonials.title")}
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            {t("testimonials.subtitle")}
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((item) => (
            <figure
              key={item.name}
              className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-soft"
            >
              <Quote className="h-6 w-6 text-primary/40" aria-hidden="true" />
              <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-foreground">
                “{item.quote}”
              </blockquote>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <figcaption>
                  <p className="text-sm font-semibold text-foreground">
                    {item.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.role}</p>
                </figcaption>
                <div
                  className="flex items-center gap-0.5 text-accent"
                  aria-label={t("testimonials.stars")}
                >
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4 fill-current"
                      aria-hidden="true"
                    />
                  ))}
                </div>
              </div>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}