import { useEffect, useState, useCallback, useRef } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  ChevronDown,
  LogOut,
  Menu,
  Search,
  Settings,
  Sprout,
  User,
  X,
} from "lucide-react";
import { useFarm } from "../../context/FarmContext";
import { useI18n, usePreferences } from "../../context/PreferencesContext";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/utils";
import { LoadingState } from "./loading-state";
import { ErrorState } from "./error-state";
import { bottomNav, primaryNav, NavItem } from "./nav-items";
import { NavLinkItem } from "./nav-link-item";
import { LanguageToggle, ThemeToggle } from "./preference-controls";
import { LogoutButton } from "../auth/LogoutButton";
import { GlobalSearchDialog } from "./global-search";
import { NotificationBell } from "./notification-bell";
import { FarmSwitcher } from "./farm-switcher";

/** Farm-dependent routes redirect to /farm-setup when no farm exists. */
const FARM_DEPENDENT_PATHS = new Set([
  "/dashboard",
  "/crop-doctor",
  "/crop-recommendation",
  "/assistant",
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

/** Sidebar Settings button popover — contains Profile, Language, Theme, Logout. */
function SettingsPopover() {
  const { t } = useI18n();
  const { farm } = useFarm();
  const { language, setLanguage, theme, toggleTheme } = usePreferences();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    }
    function onPointerDown(e: PointerEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, close]);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut();
      navigate("/", { replace: true });
    } finally {
      setLoggingOut(false);
    }
  }

  const name = farm ? farm.farmerName : t("app.nav.noFarm");
  const location = farm?.location ?? "";
  const initial = (farm?.farmerName ?? "?").trim().charAt(0).toUpperCase() || "?";
  const isDark = theme === "dark";

  return (
    <div className="relative" ref={popoverRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-150 cursor-pointer",
          open
            ? "bg-sidebar-accent text-sidebar-foreground"
            : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
        )}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left">{t("app.nav.settings")}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Settings panel"
          className="absolute bottom-full left-0 z-50 mb-2 w-[200px] overflow-hidden rounded-xl border border-sidebar-border bg-sidebar shadow-pop animate-slide-in"
        >
          {/* Profile section */}
          <div className="border-b border-sidebar-border px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary ring-1 ring-inset ring-white/10">
                {initial}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-sidebar-foreground">{name}</p>
                {location ? (
                  <p className="truncate text-xs text-sidebar-muted">{location}</p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Language */}
          <div className="border-b border-sidebar-border px-3 py-2">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
              {t("common.language")}
            </p>
            <div className="flex rounded-lg border border-sidebar-border bg-sidebar-accent p-0.5">
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={cn(
                  "flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  language === "en"
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-muted hover:text-sidebar-foreground"
                )}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLanguage("ur")}
                className={cn(
                  "flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  language === "ur"
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-muted hover:text-sidebar-foreground"
                )}
              >
                اردو
              </button>
            </div>
          </div>

          {/* Theme */}
          <div className="border-b border-sidebar-border px-3 py-2">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
              Appearance
            </p>
            <div className="flex rounded-lg border border-sidebar-border bg-sidebar-accent p-0.5">
              <button
                type="button"
                onClick={() => {
                  if (isDark) toggleTheme();
                }}
                className={cn(
                  "flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  !isDark
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-muted hover:text-sidebar-foreground"
                )}
              >
                Light
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isDark) toggleTheme();
                }}
                className={cn(
                  "flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  isDark
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-muted hover:text-sidebar-foreground"
                )}
              >
                Dark
              </button>
            </div>
          </div>

          {/* Logout */}
          <div className="p-2">
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent px-3 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-[#3a4a33] disabled:opacity-60 cursor-pointer"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {loggingOut ? t("common.loading") : t("auth.logout")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
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

/** Desktop top-bar profile menu (avatar, name, location, dropdown). */
function ProfileMenu() {
  const { t } = useI18n();
  const { farm } = useFarm();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    }
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, close]);

  const name = farm ? farm.farmerName : t("app.nav.noFarm");
  const location = farm?.location ?? "";
  const initial = (farm?.farmerName ?? "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="relative" ref={menuRef}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account — ${name}`}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors duration-150 hover:bg-muted cursor-pointer"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary ring-1 ring-inset ring-primary/15">
          {initial}
        </span>
        <span className="hidden min-w-0 text-left md:block">
          <span className="block truncate text-sm font-semibold leading-tight text-foreground">
            {name}
          </span>
          {location ? (
            <span className="block truncate text-xs leading-tight text-muted-foreground">
              {location}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            "hidden h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 md:block",
            open && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-border bg-background p-1.5 shadow-pop animate-slide-in"
        >
          <div className="border-b border-border px-2.5 py-2.5">
            <p className="truncate text-sm font-semibold text-foreground">{name}</p>
            {location ? (
              <p className="truncate text-xs text-muted-foreground">{location}</p>
            ) : null}
          </div>
          <div className="p-1">
            <Link
              to="/farm-profile"
              role="menuitem"
              onClick={close}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-muted cursor-pointer"
            >
              <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Farm Profile
            </Link>
            <Link
              to="/settings"
              role="menuitem"
              onClick={close}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-muted cursor-pointer"
            >
              <Settings className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Settings
            </Link>
          </div>
          <div className="my-1 h-px bg-border" />
          <div className="p-1">
            <LogoutButton
              onLogout={close}
              className="w-full justify-start rounded-lg px-2.5 py-2 text-sm"
            />
          </div>
        </div>
      ) : null}
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
  const tools = primaryNav.filter((i) => TOOL_NAV_PATHS.has(i.to));
  const manage = primaryNav.filter((i) => !TOOL_NAV_PATHS.has(i.to));

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar — full-height flex layout, no scrolling needed. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[220px] flex-col border-r border-sidebar-border bg-sidebar px-3 py-3 lg:flex">
        {/* Logo / Brand */}
        <div className="flex shrink-0 items-center justify-between px-1.5 pb-2">
          <Brand />
        </div>

        {/* Navigation — takes available space, no overflow */}
        <nav className="flex flex-1 flex-col overflow-hidden" aria-label={t("nav.primary")}>
          <div className="flex flex-col gap-0.5">
            <p className="px-2.5 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
              {t("nav.aiTools")}
            </p>
            {tools.map((item) => (
              <NavLinkItem key={item.to} item={item} />
            ))}
          </div>

          <div className="my-1.5 h-px bg-sidebar-border" />

          <div className="flex flex-col gap-0.5">
            <p className="px-2.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
              {t("nav.manage")}
            </p>
            {manage.map((item) => (
              <NavLinkItem key={item.to} item={item} />
            ))}
          </div>
        </nav>

        {/* Settings button anchored at bottom */}
        <div className="mt-auto shrink-0 border-t border-sidebar-border pt-2">
          <SettingsPopover />
        </div>
      </aside>

      <div className="lg:pl-[220px]">
        {/* Desktop top bar — search, notifications, farmer profile (reference) */}
        <header className="sticky top-0 z-20 hidden border-b border-border bg-background/90 backdrop-blur lg:block">
          <div className="mx-auto flex h-16 w-full max-w-[1060px] items-center gap-3 px-6">
            <button
              type="button"
              onClick={openSearch}
              className="flex h-10 w-full max-w-sm items-center gap-2.5 rounded-xl border border-border bg-background px-3.5 text-sm text-muted-foreground transition-colors duration-150 hover:border-primary/40 hover:text-foreground cursor-pointer"
              aria-label={t("search.open")}
            >
              <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="flex-1 text-left">Search your farm…</span>
              <kbd className="hidden rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:inline">
                ⌘K
              </kbd>
            </button>
            <div className="ml-auto flex items-center gap-1.5">
              <FarmSwitcher />
              <NotificationBell />
              <div className="mx-1.5 h-6 w-px bg-border" aria-hidden="true" />
              <ProfileMenu />
            </div>
          </div>
        </header>

        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
          <Brand tone="light" />
          <div className="flex items-center gap-1">
            <FarmSwitcher className="mr-1" />
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
        <main className="px-4 pb-24 pt-6 sm:px-6 lg:px-6 lg:pb-10 lg:pt-6">
          <div className="mx-auto w-full max-w-[1060px]">
            <Outlet />
          </div>
        </main>
      </div>

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
