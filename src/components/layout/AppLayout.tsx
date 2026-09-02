import { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Menu, Sprout, X } from "lucide-react";
import { useFarm } from "../../context/FarmContext";
import { useI18n } from "../../context/PreferencesContext";
import { cn } from "../../lib/utils";
import { LoadingState } from "./loading-state";
import { ErrorState } from "./error-state";
import { bottomNav, primaryNav, NavItem } from "./nav-items";
import { NavLinkItem } from "./nav-link-item";
import { LanguageToggle, ThemeToggle } from "./preference-controls";
import { LogoutButton } from "../auth/LogoutButton";

/** Farm-dependent routes redirect to /farm-setup when no farm exists. */
const FARM_DEPENDENT_PATHS = new Set([
  "/dashboard",
  "/crop-doctor",
  "/crop-recommendation",
  "/assistant",
  "/voice",
  "/weather",
  "/risks",
  "/yield",
  "/actions",
  "/diagnosis-history",
  "/chat-history",
  "/farm-profile",
]);

function Brand() {
  const { t } = useI18n();
  return (
    <Link to="/" className="flex items-center gap-2.5 px-1 cursor-pointer">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Sprout className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="text-lg font-bold tracking-tight text-foreground">
        {t("brand.name")}
      </span>
    </Link>
  );
}

function DrawerContent({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="flex h-full flex-col gap-1">
      {primaryNav.map((item) => (
        <NavLinkItem key={item.to} item={item} onNavigate={onNavigate} />
      ))}
      <div className="my-3 h-px bg-border" />
      <div className="flex flex-col gap-2 px-1 py-1">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      <div className="my-3 h-px bg-border" />
      <div className="px-1 py-1">
        <LogoutButton onLogout={onNavigate} />
      </div>
    </div>
  );
}

export function AppLayout() {
  const { farm, status, error, retry } = useFarm();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const path = location.pathname;
  const isFarmDependent = FARM_DEPENDENT_PATHS.has(path);

  // No-farm redirect for farm-dependent routes. Runs in an effect (never during
  // render) once the farm status has settled, so React doesn't warn about a
  // component updating itself mid-render.
  useEffect(() => {
    if (status === "ready" && !farm && isFarmDependent) {
      navigate("/farm-setup", { replace: true });
    }
  }, [status, farm, isFarmDependent, navigate]);

  // While the active farm is being loaded from Supabase, show a loading state
  // instead of redirecting — avoids a flash of the "no farm" screen.
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <LoadingState rows={2} title={t("common.loadingFarm")} className="w-full max-w-md" />
      </div>
    );
  }

  // If the farm failed to load, give the user a clear, actionable error.
  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md">
          <ErrorState
            message={
              error ??
              "We couldn't load your farm. Please try again."
            }
            onRetry={retry}
          />
        </div>
      </div>
    );
  }

  // While the redirect effect above runs, render a placeholder instead of a
  // flash of the farm-dependent page.
  if (!farm && isFarmDependent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <LoadingState rows={2} title={t("common.loadingFarm")} className="w-full max-w-md" />
      </div>
    );
  }

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card px-4 py-6 lg:flex">
        <div className="mb-8">
          <Brand />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto" aria-label={t("nav.primary")}>
          {primaryNav.map((item) => (
            <NavLinkItem key={item.to} item={item} />
          ))}
        </nav>
        <div className="mt-6 space-y-3 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            {farm ? farm.farmerName : t("app.nav.noFarm")}
          </p>
          <div className="flex flex-col gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
          <LogoutButton className="lg:-mx-1 lg:w-[calc(100%+0.5rem)]" />
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-foreground hover:bg-muted transition-colors cursor-pointer"
          aria-label={t("nav.openMenu")}
        >
          <Menu className="h-6 w-6" aria-hidden="true" />
        </button>
      </header>

      {/* Mobile secondary drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={closeDrawer}
            aria-label={t("nav.closeMenu")}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-card p-4 shadow-pop animate-slide-in rtl:left-auto rtl:right-0">
            <div className="mb-6 flex items-center justify-between">
              <Brand />
              <button
                type="button"
                onClick={closeDrawer}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-foreground hover:bg-muted transition-colors cursor-pointer"
                aria-label={t("nav.closeMenu")}
              >
                <X className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto" aria-label={t("nav.main")}>
              <DrawerContent onNavigate={closeDrawer} />
            </nav>
          </div>
        </div>
      ) : null}

      {/* Main content */}
      <main className="px-4 pb-24 pt-6 sm:px-6 lg:ml-64 lg:px-10 lg:pb-10 lg:pt-8">
        <div className="mx-auto w-full max-w-5xl">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur lg:hidden"
        aria-label="Bottom"
      >
        <div className="mx-auto flex max-w-lg items-stretch">
          {bottomNav.map((item) => (
            <BottomTab key={item.to} item={item} />
          ))}
        </div>
      </nav>
    </div>
  );
}

function BottomTab({ item }: { item: NavItem }) {
  const { t } = useI18n();
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        cn(
          "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors cursor-pointer",
          isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
              isActive && "bg-primary-soft"
            )}
          >
            <item.icon className="h-5 w-5" aria-hidden="true" />
          </span>
          {t(item.labelKey)}
        </>
      )}
    </NavLink>
  );
}