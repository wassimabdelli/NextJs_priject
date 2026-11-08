import React from 'react';
import {
  Search,
  Bell,
  Building,
  Check,
  ChevronDown,
  Sparkles,
  RefreshCw,
  Plus,
  Sun,
  Moon,
} from 'lucide-react';
import { Residence, UserProfile } from '@/lib/redesign/condo';
import { canReportIncident } from '@/lib/permissions';
import { useRedesign } from '@/lib/redesign/store';

interface TopHeaderProps {
  currentUser: UserProfile;
  residences: Residence[];
  activeResidence: Residence;
  setActiveResidence: (res: Residence) => void;
  onOpenSearch: () => void;
  onOpenNewIncident: () => void;
  onRefresh: () => void;
  notificationsCount: number;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentUser,
  residences,
  activeResidence,
  setActiveResidence,
  onOpenSearch,
  onOpenNewIncident,
  onRefresh,
  notificationsCount,
  onOpenNotifications,
  onOpenProfile,
  theme,
  onToggleTheme,
}) => {
  const { apiRole } = useRedesign();
  const [residenceDropdownOpen, setResidenceDropdownOpen] = React.useState(false);
  const showSignaler = canReportIncident(apiRole);

  return (
    <header className="h-16 px-6 glass-nav sticky top-0 z-30 flex items-center justify-between gap-6 transition-colors duration-200">
      {/* Left: Greeting & Synchronized Status */}
      <div className="flex items-center gap-6">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
            Bonjour, {currentUser.name.split(' ')[0]} 👋
          </h2>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Tout est synchronisé</span>
          </div>
        </div>

        {/* Residence Dropdown Selector */}
        <div className="relative hidden md:block">
          <button
            onClick={() => setResidenceDropdownOpen(!residenceDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 dark:bg-white/[0.05] dark:hover:bg-white/[0.08] border border-slate-200/80 dark:border-white/[0.08] text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-xs"
          >
            <Building className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
            <span className="max-w-[160px] truncate">{activeResidence.name}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>


          {residenceDropdownOpen && (
            <div className="absolute top-10 left-0 w-64 glass-card rounded-2xl p-1.5 shadow-2xl z-50 animate-fadeIn">
              <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Changer de copropriété
              </p>
              {residences.map((res) => (
                <button
                  key={res.id}
                  onClick={() => {
                    setActiveResidence(res);
                    setResidenceDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs text-left transition-colors ${
                    activeResidence.id === res.id
                      ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400 font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.05]'
                  }`}
                >
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{res.name}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">{res.city} · {res.totalLots} lots</p>
                  </div>
                  {activeResidence.id === res.id && (
                    <Check className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Center/Right: Global Search & Actions */}
      <div className="flex items-center gap-2.5">
        {/* Search trigger button */}
        <button
          onClick={onOpenSearch}
          className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 dark:bg-white/[0.05] dark:hover:bg-white/[0.08] border border-slate-200/80 dark:border-white/[0.08] text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors w-44 md:w-64"
        >
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <span className="truncate">Rechercher un module...</span>
          <span className="hidden sm:inline-block ml-auto text-[10px] font-mono bg-white/60 dark:bg-white/[0.08] px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400 border border-black/5 dark:border-white/5">
            ⌘K
          </span>
        </button>

        {/* Theme Toggle Button (Light / Dark) */}
        <button
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Basculer en Mode Clair' : 'Basculer en Mode Sombre'}
          className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100/80 dark:bg-white/[0.05] hover:bg-slate-200/80 dark:hover:bg-white/[0.08] border border-slate-200/80 dark:border-white/[0.08] transition-all shadow-xs flex items-center justify-center group"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform duration-300" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-600 group-hover:-rotate-12 transition-transform duration-300" />
          )}
        </button>

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          title="Actualiser les données"
          className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Notifications button */}
        <button
          onClick={onOpenNotifications}
          title="Notifications & Rappels"
          className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors relative"
        >
          <Bell className="w-4 h-4" />
          {notificationsCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          )}
        </button>

        {showSignaler && (
          <button
            onClick={onOpenNewIncident}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Signaler</span>
          </button>
        )}

        {/* Profile Avatar */}
        <button
          onClick={onOpenProfile}
          title="Mon compte"
          className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-bold text-xs flex items-center justify-center hover:scale-105 transition-all shadow-xs"
        >
          {currentUser.name
            .split(' ')
            .map((n) => n[0])
            .slice(0, 2)
            .join('')}
        </button>
      </div>
    </header>
  );
};

