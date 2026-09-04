import {
  LayoutDashboard,
  ScanLine,
  MessageCircle,
  CloudSun,
  Droplets,
  User,
  AlertTriangle,
  TrendingUp,
  Leaf,
  Wallet,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  /** i18n key resolved through useI18n().t(). */
  labelKey: string;
  to: string;
  icon: LucideIcon;
}

/**
 * Primary destinations — shown in the sidebar and in the mobile bottom bar
 * (max 5) + drawer.
 *
 * Order matches the reference dashboard sidebar: Dashboard → farm profile →
 * the AI tools → management pages. Every item keeps its existing route.
 */
export const primaryNav: NavItem[] = [
  { labelKey: "app.nav.dashboard", to: "/dashboard", icon: LayoutDashboard },
  { labelKey: "app.nav.farmProfile", to: "/farm-profile", icon: User },
  { labelKey: "app.nav.cropDoctor", to: "/crop-doctor", icon: ScanLine },
  { labelKey: "app.nav.assistant", to: "/assistant", icon: MessageCircle },
  { labelKey: "app.nav.weather", to: "/weather", icon: CloudSun },
  { labelKey: "app.nav.cropRecommendation", to: "/crop-recommendation", icon: Leaf },
  { labelKey: "app.nav.irrigation", to: "/irrigation", icon: Droplets },
  { labelKey: "app.nav.risksAlerts", to: "/risks", icon: AlertTriangle },
  { labelKey: "app.nav.yieldPrediction", to: "/yield", icon: TrendingUp },
  { labelKey: "app.nav.expenses", to: "/expenses", icon: Wallet },
  { labelKey: "app.nav.cropCalendar", to: "/crop-calendar", icon: CalendarDays },
];

/** 5 primary items shown in the mobile bottom bar. */
export const bottomNav: NavItem[] = primaryNav.slice(0, 5);
