import { useState, type FormEvent } from "react";
import { CheckCircle2, Mail, MapPin, Phone } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { useI18n } from "../../context/PreferencesContext";

export function LandingContact() {
  const { t } = useI18n();
  const [submitted, setSubmitted] = useState(false);

  const CONTACT_DETAILS = [
    {
      icon: Mail,
      label: t("contact.email"),
      value: "salaam@kissanai.app",
      href: "mailto:salaam@kissanai.app",
    },
    {
      icon: Phone,
      label: t("contact.phone"),
      value: "+92 300 000 0000",
      href: "tel:+923000000000",
    },
    {
      icon: MapPin,
      label: t("contact.basedIn"),
      value: t("contact.basedInValue"),
    },
  ];

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <section id="contact" className="scroll-mt-24 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              {t("contact.eyebrow")}
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              {t("contact.title")}
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              {t("contact.subtitle")}
            </p>

            <ul className="mt-8 space-y-4">
              {CONTACT_DETAILS.map((item) => (
                <li key={item.label} className="flex items-center gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {item.label}
                    </p>
                    {item.href ? (
                      <a
                        href={item.href}
                        className="text-sm font-medium text-foreground transition-colors hover:text-primary cursor-pointer"
                      >
                        {item.value}
                      </a>
                    ) : (
                      <p className="text-sm font-medium text-foreground">
                        {item.value}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-lift">
            {submitted ? (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center text-center">
                <CheckCircle2
                  className="h-12 w-12 text-success"
                  aria-hidden="true"
                />
                <h3 className="mt-4 text-xl font-bold text-foreground">
                  {t("contact.successTitle")}
                </h3>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  {t("contact.successText")}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">
                  {t("contact.formTitle")}
                </h3>
                <div className="space-y-1.5">
                  <Label htmlFor="contact-name">{t("contact.name")}</Label>
                  <Input
                    id="contact-name"
                    name="name"
                    autoComplete="name"
                    required
                    placeholder={t("contact.namePlaceholder")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact-email">{t("contact.emailPhone")}</Label>
                  <Input
                    id="contact-email"
                    name="contact"
                    autoComplete="email"
                    required
                    placeholder={t("contact.emailPhonePlaceholder")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact-message">{t("contact.message")}</Label>
                  <Textarea
                    id="contact-message"
                    name="message"
                    required
                    placeholder={t("contact.messagePlaceholder")}
                  />
                </div>
                <Button type="submit" size="lg" className="w-full">
                  {t("contact.send")}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  {t("contact.replyNote")}
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}