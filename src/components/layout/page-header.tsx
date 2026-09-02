import * as React from "react";
import { cn } from "../../lib/utils";

/** Consistent page-level header: title, optional subtitle, optional action slot. */
export function PageHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2.5">
          <span className="h-1 w-5 rounded-full bg-accent" aria-hidden="true" />
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
        </div>
        {subtitle ? (
          <p className="max-w-2xl pl-7 text-sm leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

/** Consistent section-level header used inside pages. */
export function SectionHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2", className)}>
      <div className="space-y-0.5">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {subtitle ? (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}