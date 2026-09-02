import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ring-1 ring-inset",
  {
    variants: {
      variant: {
        default: "bg-primary-soft text-primary ring-primary/15",
        success: "bg-success-soft text-success ring-success/15",
        warning: "bg-warning-soft text-warning ring-warning/20",
        danger: "bg-danger-soft text-danger ring-danger/15",
        neutral: "bg-muted text-muted-foreground ring-border",
        outline: "border border-input bg-card text-foreground ring-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };