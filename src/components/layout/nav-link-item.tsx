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
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150 cursor-pointer",
          isActive
            ? "bg-primary-soft text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )
      }
    >
      <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span>{t(item.labelKey)}</span>
    </NavLink>
  );
}