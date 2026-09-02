import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";
import { usePreferences } from "../../context/PreferencesContext";

/**
 * Password input with an accessible show/hide toggle (button has aria-label
 * and aria-pressed). Renders the maintain `type` switching between `password`
 * and `text`.
 */
export const PasswordField = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
    showLabelKey?: string;
    hideLabelKey?: string;
  }
>(({ id, className, showLabelKey = "auth.showPassword", hideLabelKey = "auth.hidePassword", ...props }, ref) => {
  const [visible, setVisible] = React.useState(false);
  const { t } = usePreferences();
  const label = visible ? t(hideLabelKey) : t(showLabelKey);

  return (
    <div className="relative">
      <Input
        ref={ref}
        id={id}
        type={visible ? "text" : "password"}
        className={cn("pr-12", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute end-1.5 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
        aria-label={label}
        aria-pressed={visible}
        tabIndex={-1}
      >
        {visible ? (
          <EyeOff className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Eye className="h-5 w-5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
});
PasswordField.displayName = "PasswordField";