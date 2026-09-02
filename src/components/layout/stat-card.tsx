import * as React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { cn } from "../../lib/utils";

/**
 * Premium KPI / metric card used across the dashboard and feature pages.
 *
 * Presents a real value with an icon, an optional trend/hint line, and an
 * optional deep-link. All values are rendered from real app data — this is a
 * pure presentation component and never invents numbers.
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  iconClassName,
  to,
  onClick,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
  /** Optional internal route to deep-link the whole card. */
  to?: string;
  onClick?: () => void;
  className?: string;
}) {
  const Icon = icon;

  const body = (
    <div
      className={cn(
        "group relative h-full overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-soft transition-all duration-200",
        "card-sheen",
        (to || onClick) && "hover:-translate-y-0.5 hover:shadow-lift hover:border-primary/25",
        className
      )}
    >
      {/* Accent glint in the top-right corner for depth */}
      <span
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-accent/10 blur-2xl transition-opacity duration-300 group-hover:bg-accent/20"
        aria-hidden="true"
      />
      <div className="relative flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary ring-1 ring-inset ring-primary/10 transition-colors duration-200",
            "group-hover:bg-primary group-hover:text-primary-foreground",
            iconClassName
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        {to ? (
          <ArrowUpRight
            className="h-4 w-4 text-muted-foreground/50 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
            aria-hidden="true"
          />
        ) : null}
      </div>

      <div className="relative mt-4">
        <p className="font-heading text-3xl font-bold tracking-tight text-foreground">
          {value}
        </p>
        <p className="mt-1 text-sm font-medium text-muted-foreground">{label}</p>
        {hint ? (
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground/80">{hint}</p>
        ) : null}
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="block h-full cursor-pointer" onClick={onClick}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="block h-full w-full cursor-pointer text-left"
      >
        {body}
      </button>
    );
  }
  return body;
}
