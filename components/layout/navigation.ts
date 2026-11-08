import {
  Activity,
  AlertTriangle,
  Bell,
  BrainCircuit,
  Building2,
  FileText,
  LayoutDashboard,
  Megaphone,
  MoreHorizontal,
  Receipt,
  Search,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Role } from "@/types/enums";

export interface NavigationItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: Role[];
  mobilePrimary?: boolean;
}

const allRoles = [Role.ADMIN, Role.SYNDIC, Role.RESIDENT, Role.TECHNICIAN];
const managementRoles = [Role.ADMIN, Role.SYNDIC];

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: allRoles, mobilePrimary: true },
  { label: "AI Intelligence", href: "/ai-intelligence", icon: BrainCircuit, roles: managementRoles },
  { label: "Poser une question", href: "/ask", icon: Search, roles: allRoles },
  { label: "Résidences", href: "/residences", icon: Building2, roles: managementRoles },
  { label: "Résidents", href: "/residents", icon: Users, roles: managementRoles },
  { label: "Utilisateurs", href: "/users", icon: Users, roles: [Role.ADMIN, Role.SYNDIC] },
  { label: "Charges", href: "/charges", icon: Receipt, roles: [Role.ADMIN, Role.SYNDIC, Role.RESIDENT] },
  { label: "Dépenses", href: "/expenses", icon: Wallet, roles: managementRoles },
  { label: "Réclamations", href: "/incidents", icon: AlertTriangle, roles: allRoles, mobilePrimary: true },
  { label: "Annonces", href: "/announcements", icon: Megaphone, roles: allRoles, mobilePrimary: true },
  { label: "Notifications", href: "/notifications", icon: Bell, roles: allRoles, mobilePrimary: true },
  { label: "Activité", href: "/activity", icon: Activity, roles: allRoles },
  { label: "Documents", href: "/documents", icon: FileText, roles: [Role.ADMIN, Role.SYNDIC, Role.RESIDENT] },
  { label: "Plus", href: "/more", icon: MoreHorizontal, roles: allRoles },
];
