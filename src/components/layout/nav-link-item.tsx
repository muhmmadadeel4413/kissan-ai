import { NavLink } from "react-router-dom";
import { cn } from "../../lib/utils";
import { useI18n } from "../../context/PreferencesContext";
import { NavItem } from "./nav-items";

export function NavLinkItem({
  item,
  onNavigate,
}: {
  item: NavItem;
  onNavigate?: () => void;
}) {
  const { t } = useI18n();

  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-3 rounded-xl px-3 py-1 text-sm font-medium transition-all duration-150 cursor-pointer",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-soft ring-1 ring-inset ring-white/5"
            : "text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* Active indicator bar */}
          <span
            className={cn(
              "absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-accent transition-all duration-200",
              isActive ? "opacity-100" : "opacity-0"
            )}
            aria-hidden="true"
          />
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-150",
              isActive
                ? "bg-accent/25 text-accent"
                : "bg-transparent text-sidebar-muted group-hover:bg-sidebar-accent group-hover:text-sidebar-accent-foreground"
            )}
          >
            <item.icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span>{t(item.labelKey)}</span>
        </>
      )}
    </NavLink>
  );
}