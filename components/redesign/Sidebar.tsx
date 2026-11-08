import React from 'react';
import {
  Building2,
  LayoutDashboard,
  Receipt,
  AlertTriangle,
  Megaphone,
  MoreHorizontal,
  LogOut,
  CheckCircle2,
  FileText,
  Users,
  Vote,
  Wrench,
  Package,
  HardHat,
  CalendarClock,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { UserProfile } from '@/lib/redesign/condo';
import { clearOfflineSession } from '@/lib/offline/db';
import { canAccessTab } from '@/lib/permissions';
import { useRedesign } from '@/lib/redesign/store';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  currentUser: UserProfile;
  onSwitchUser: (user: UserProfile) => void;
  allUsers: UserProfile[];
  openIncidentsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  currentUser,
  openIncidentsCount,
}) => {
  const router = useRouter();
  const { apiRole } = useRedesign();
  const [loggingOut, setLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await clearOfflineSession();
      if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'LOGOUT' });
      }
      await signOut({ redirect: false });
      router.push('/login');
      router.refresh();
    } catch {
      window.location.href = '/login';
    } finally {
      setLoggingOut(false);
    }
  };

  const mainNavItems = [
    { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard },
    { id: 'charges', label: 'Charges', icon: Receipt },
    {
      id: 'incidents',
      label: 'Incidents',
      icon: AlertTriangle,
      badge: openIncidentsCount > 0 ? openIncidentsCount : undefined,
    },
    { id: 'announcements', label: 'Annonces', icon: Megaphone },
    { id: 'more', label: 'Plus', icon: MoreHorizontal },
  ].filter((item) => canAccessTab(apiRole, item.id));

  const shortcuts = [
    { id: 'residences', label: 'Résidences', icon: Building2 },
    { id: 'join-requests', label: 'Demandes rattachement', icon: Users },
    { id: 'expenses', label: 'Dépenses & Factures', icon: FileText },
    { id: 'meetings', label: 'Assemblées (AG)', icon: Users },
    { id: 'elections', label: 'Élections Conseil', icon: Vote },
    { id: 'wallet', label: 'Mon Portefeuille', icon: CheckCircle2 },
    { id: 'employees', label: 'Personnel', icon: HardHat },
    { id: 'shifts', label: 'Plannings', icon: CalendarClock },
    { id: 'leaves', label: 'Congés', icon: CalendarClock },
    { id: 'equipment', label: 'Équipements', icon: Wrench },
    { id: 'maintenance', label: 'Interventions', icon: Wrench },
    { id: 'stock', label: 'Stock', icon: Package },
    { id: 'users', label: 'Utilisateurs', icon: Users },
  ].filter((item) => canAccessTab(apiRole, item.id));

  return (
    <aside className="w-64 shrink-0 glass-nav border-r border-slate-200/80 dark:border-white/[0.08] flex flex-col justify-between select-none min-h-screen transition-colors duration-200">
      <div>
        <div className="p-5 flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 text-white">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">Syndic</span>
                <span className="font-extrabold text-base tracking-tight text-blue-600 dark:text-blue-400">Pro</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Copropriété Digitale</p>
            </div>
          </div>
        </div>

        <div className="px-3 py-4">
          <p className="px-3 text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase mb-2">
            Navigation
          </p>
          <nav className="space-y-1">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-blue-600/10 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/25 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-200 dark:bg-white/[0.1] text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {shortcuts.length > 0 && (
          <div className="px-3 py-2">
            <p className="px-3 text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase mb-2">
              Raccourcis
            </p>
            <div className="space-y-0.5">
              {shortcuts.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                      currentTab === item.id
                        ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-white/[0.04]'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-white/[0.02]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-slate-200/80 dark:border-white/[0.06] relative">
        <div className="p-2.5 rounded-2xl bg-white/60 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] flex items-center justify-between shadow-xs">
          <button
            type="button"
            onClick={() => setCurrentTab('profile')}
            className="flex items-center gap-2.5 min-w-0 text-left"
            title="Mon profil"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
              {currentUser.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{currentUser.name}</p>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                {currentUser.role}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            title="Se déconnecter"
            aria-label="Se déconnecter"
            className="p-2 min-h-11 min-w-11 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-white/[0.06] transition-colors disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
