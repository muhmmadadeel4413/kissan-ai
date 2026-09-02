import {
  LayoutDashboard,
  ScanLine,
  MessageCircle,
  Mic,
  CloudSun,
  Droplets,
  ListChecks,
  User,
  AlertTriangle,
  TrendingUp,
  Leaf,
  History,
  MessagesSquare,
  Wallet,
  CalendarDays,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  /** i18n key resolved through useI18n().t(). */
  labelKey: string;
  to: string;
  icon: LucideIcon;
}

/** Primary destinations — shown in the sidebar and in the mobile bottom bar (max 5) + drawer. */
export const primaryNav: NavItem[] = [
  { labelKey: "app.nav.dashboard", to: "/dashboard", icon: LayoutDashboard },
  { labelKey: "app.nav.cropDoctor", to: "/crop-doctor", icon: ScanLine },
  { labelKey: "app.nav.assistant", to: "/assistant", icon: MessageCircle },
  { labelKey: "app.nav.voice", to: "/voice", icon: Mic },
  { labelKey: "app.nav.weather", to: "/weather", icon: CloudSun },
  { labelKey: "app.nav.irrigation", to: "/irrigation", icon: Droplets },
  { labelKey: "app.nav.todayActions", to: "/actions", icon: ListChecks },
  { labelKey: "app.nav.farmProfile", to: "/farm-profile", icon: User },
  { labelKey: "app.nav.cropRecommendation", to: "/crop-recommendation", icon: Leaf },
  { labelKey: "app.nav.risksAlerts", to: "/risks", icon: AlertTriangle },
  { labelKey: "app.nav.yieldPrediction", to: "/yield", icon: TrendingUp },
  { labelKey: "app.nav.diagnosisHistory", to: "/diagnosis-history", icon: History },
  { labelKey: "app.nav.chatHistory", to: "/chat-history", icon: MessagesSquare },
  { labelKey: "app.nav.expenses", to: "/expenses", icon: Wallet },
  { labelKey: "app.nav.cropCalendar", to: "/crop-calendar", icon: CalendarDays },
  { labelKey: "app.nav.settings", to: "/settings", icon: Settings },
];


/** 5 primary items shown in the mobile bottom bar. */
export const bottomNav: NavItem[] = primaryNav.slice(0, 5);