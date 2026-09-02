import { Skeleton } from "../ui/skeleton";
import { cn } from "../../lib/utils";

/**
 * Reusable loading state. Renders skeleton blocks matching common card /
 * list layouts so the UI never shows a blank space while data loads.
 */
export function LoadingState({
  rows = 3,
  title = "Loading…",
  className,
}: {
  rows?: number;
  title?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)} role="status" aria-label={title}>
      <span className="sr-only">{title}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-14" />
          </div>
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
      ))}
    </div>
  );
}