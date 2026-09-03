import { useEffect, useState, useCallback } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Menu, Search, Sprout, X } from "lucide-react";
import { useFarm } from "../../context/FarmContext";
import { useI18n } from "../../context/PreferencesContext";
import { cn } from "../../lib/utils";
import { LoadingState } from "./loading-state";
import { ErrorState } from "./error-state";
import { bottomNav, primaryNav, NavItem } from "./nav-items";
import { NavLinkItem } from "./nav-link-item";
import { LanguageToggle, ThemeToggle } from "./preference-controls";
import { LogoutButton } from "../auth/LogoutButton";
import { GlobalSearchDialog } from "./global-search";
import { NotificationBell } from "./notification-bell";

/** Farm-dependent routes redirect to /farm-setup when no farm exists. */
const FARM_DEPENDENT_PATHS = new Set([
  "/dashboard",
  "/crop-doctor",
  "/crop-recommendation",
  "/assistant",
  "/voice",
  "/weather",
  "/irrigation",
  "/risks",
  "/yield",
  "/actions",
  "/diagnosis-history",
  "/chat-history",
  "/farm-profile",
  "/expenses",
  "/crop-calendar",
]);

/** Primary AI tools shown first in the sidebar (in order). */
const TOOL_NAV_PATHS = new Set([
  "/dashboard",
  "/crop-doctor",
  "/crop-recommendation",
  "/assistant",
  "/voice",
  "/weather",
  "/irrigation",
  "/risks",
  "/yield",
  "/actions",
]);

function Brand({ tone = "sidebar" }: { tone?: "sidebar" | "light" }) {
  const { t } = useI18n();
  return (
    <Link to="/" className="flex items-center gap-2.5 px-1 cursor-pointer" aria-label={t("brand.name")}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-deep text-primary-foreground shadow-soft ring-1 ring-inset ring-white/10">
        <Sprout className="h-5 w-5" aria-hidden="true" />
      </span>
      <span
        className={cn(
          "font-heading text-lg font-bold tracking-tight",
          tone === "sidebar" ? "text-sidebar-foreground" : "text-foreground"
        )}
      >
        {t("brand.name")}
      </span>
    </Link>
  );
}

function DrawerContent({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useI18n();
  const tools = primaryNav.filter((i) => TOOL_NAV_PATHS.has(i.to));
  const manage = primaryNav.filter((i) => !TOOL_NAV_PATHS.has(i.to));
  return (
    <div className="flex h-full flex-col gap-1">
      <p className="flex items-center gap-2 px-3 pb-0.5 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
        <span className="h-1 w-3 rounded-full bg-accent/70" aria-hidden="true" />
        {t("nav.aiTools")}
      </p>
      {tools.map((item) => (
        <NavLinkItem key={item.to} item={item} onNavigate={onNavigate} />
      ))}
      <div className="my-2 h-px bg-sidebar-border" />
      <p className="flex items-center gap-2 px-3 pb-0.5 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
        <span className="h-1 w-3 rounded-full bg-sidebar-muted/50" aria-hidden="true" />
        {t("nav.manage")}
      </p>
      {manage.map((item) => (
        <NavLinkItem key={item.to} item={item} onNavigate={onNavigate} />
      ))}
      <div className="my-2 h-px bg-sidebar-border" />
      <div className="flex flex-col gap-1.5 px-1 py-1">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      <div className="my-2 h-px bg-sidebar-border" />
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
  const [searchOpen, setSearchOpen] = useState(false);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

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

  // Global keyboard shortcut for search (Ctrl+K / ⌘K)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

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
      {/* Desktop sidebar — matches the reference: dark shell, logo, compact
          flat nav, profile + preferences + logout pinned at the bottom. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[212px] flex-col border-r border-sidebar-border bg-sidebar px-3 py-4 lg:flex">
        <div className="flex items-center justify-between px-1.5 pb-4">
          <Brand />
        </div>
        <nav
          className="flex-1 space-y-0.5 overflow-y-auto scrollbar-thin"
          aria-label={t("nav.primary")}
        >
          {primaryNav.map((item) => (
            <NavLinkItem key={item.to} item={item} />
          ))}
        </nav>
        <div className="mt-3 space-y-1.5 border-t border-sidebar-border pt-3">
          <div className="flex items-center gap-2.5 px-1.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary ring-1 ring-inset ring-white/10">
              {farm ? farm.farmerName.trim().charAt(0).toUpperCase() : "?"}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-sidebar-foreground">
                {farm ? farm.farmerName : t("app.nav.noFarm")}
              </p>
              {farm ? (
                <p className="truncate text-xs text-sidebar-muted">{farm.location}</p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-1.5 pt-0.5">
            <LanguageToggle className="min-w-0 flex-1" />
            <ThemeToggle className="w-9 shrink-0 justify-center px-0" />
          </div>
          <LogoutButton className="lg:-mx-1.5 lg:w-[calc(100%+0.75rem)]" />
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
        <Brand tone="light" />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={openSearch}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-foreground hover:bg-muted transition-colors cursor-pointer"
            aria-label={t("search.open")}
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </button>
          <NotificationBell />
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-foreground hover:bg-muted transition-colors cursor-pointer"
            aria-label={t("nav.openMenu")}
          >
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
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
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-sidebar p-4 shadow-pop animate-slide-in rtl:left-auto rtl:right-0">
            <div className="mb-6 flex items-center justify-between">
              <Brand />
              <button
                type="button"
                onClick={closeDrawer}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-sidebar-foreground hover:bg-sidebar-accent transition-colors cursor-pointer"
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
      <main className="px-4 pb-24 pt-6 sm:px-6 lg:ml-[212px] lg:px-6 lg:pb-10 lg:pt-6">
        <div className="mx-auto w-full max-w-[1060px]">
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

      {/* Global search dialog */}
      <GlobalSearchDialog open={searchOpen} onClose={closeSearch} />
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
