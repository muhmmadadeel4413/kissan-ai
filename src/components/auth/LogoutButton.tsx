import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { usePreferences } from "../../context/PreferencesContext";
import { cn } from "../../lib/utils";

/**
 * Sign-out button. Calls Supabase signOut (which clears the auth state), then
 * returns to the public landing page. Farm state is cleared automatically by
 * the FarmProvider when it observes the session end.
 */
export function LogoutButton({
  className,
  onLogout,
}: {
  className?: string;
  onLogout?: () => void;
}) {
  const { t } = usePreferences();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    try {
      await signOut();
      onLogout?.();
      navigate("/", { replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={busy}
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-muted disabled:opacity-60 cursor-pointer",
        className
      )}
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
      {busy ? t("common.loading") : t("auth.logout")}
    </button>
  );
}