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
          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 cursor-pointer",
          isActive
            ? "bg-primary-soft text-primary shadow-soft"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-150",
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-transparent group-hover:bg-card"
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