import React from 'react';
import {
  TrendingUp,
  Wallet,
  AlertCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Check,
  X,
  FileSpreadsheet,
  AlertTriangle,
  Users,
  ChevronRight,
  RefreshCw,
  Plus,
  Building,
  CreditCard,
  Send,
  Download,
  Copy,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import {
  Charge,
  Expense,
  Incident,
  AttachmentRequest,
  Residence,
} from '@/lib/redesign/condo';
import { calculateFinancialSummary, formatCurrency } from '@/lib/redesign/condoLogic';

// Generated authentic visual assets
const glassOrbImg = '/redesign-assets/glass_financial_orb_1793994004948.jpg';
const condoHeroImg = '/redesign-assets/condo_building_hero_1793994004922.jpg';
const ayaAvatarImg = '/redesign-assets/avatar_resident_aya_1793994005253.jpg';

interface DashboardViewProps {
  charges: Charge[];
  expenses: Expense[];
  incidents: Incident[];
  attachmentRequests: AttachmentRequest[];
  onApproveAttachment: (id: string) => void;
  onRejectAttachment: (id: string) => void;
  onNavigate: (tab: string) => void;
  activeResidence: Residence;
  onOpenNewIncident: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  charges,
  expenses,
  incidents,
  attachmentRequests,
  onApproveAttachment,
  onRejectAttachment,
  onNavigate,
  activeResidence,
  onOpenNewIncident,
}) => {
  const financial = calculateFinancialSummary(charges, expenses);

  const pendingRequests = attachmentRequests.filter((r) => r.status === 'En attente');
  const openIncidents = incidents.filter((i) => i.status !== 'Résolu');

  // Active balance filter view ('general' | 'expenses' | 'income')
  const [balanceFilter, setBalanceFilter] = React.useState<'general' | 'expenses' | 'income'>('general');
  const [copiedRib, setCopiedRib] = React.useState(false);
  const [selectedQuickResident, setSelectedQuickResident] = React.useState<string | null>(null);

  const handleCopyRib = () => {
    navigator.clipboard?.writeText('TN59 1000 6035 1834 5678 9012');
    setCopiedRib(true);
    setTimeout(() => setCopiedRib(false), 2000);
  };

  // Monthly comparison
  const monthlyBars = [
    { label: 'Jan', val: 35, exp: 20 },
    { label: 'Fév', val: 55, exp: 35 },
    { label: 'Mar', val: 78, exp: 45 },
    { label: 'Avr', val: 62, exp: 38 },
    { label: 'Mai', val: 90, exp: 48 },
  ];

  // Expense distribution categories
  const expenseCategories = [
    { name: 'Ascenseur & Maintenance', amount: 850, color: '#3b82f6', percent: 34 },
    { name: 'Ménage & Hygiène', amount: 480, color: '#10b981', percent: 20 },
    { name: 'Électricité & Eau', amount: 420, color: '#f59e0b', percent: 17 },
    { name: 'Gardiennage & Sécurité', amount: 500, color: '#ec4899', percent: 21 },
    { name: 'Assurance & Divers', amount: 200, color: '#8b5cf6', percent: 8 },
  ];

  const quickContacts = [
    { name: 'Aya Trabelsi', role: 'Lot 12', avatar: ayaAvatarImg },
    { name: 'Karim Mansour', role: 'Lot 04', initials: 'KM', color: 'from-blue-500 to-indigo-600' },
    { name: 'Salma Ben Ali', role: 'Lot 08', initials: 'SB', color: 'from-purple-500 to-pink-600' },
    { name: 'Yassine Dridi', role: 'Lot 15', initials: 'YD', color: 'from-amber-500 to-rose-500' },
    { name: 'Mohamed Syndic', role: 'Syndic', initials: 'MS', color: 'from-emerald-500 to-teal-600' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Welcome & Quick Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Tableau de bord financier & opérationnel
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-0.5">
            Vue d’ensemble {activeResidence.name}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Gestion transparente, comptabilité en temps réel et suivi technique de votre copropriété
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onNavigate('charges')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/80 dark:bg-white/[0.05] hover:bg-slate-100 dark:hover:bg-white/[0.08] border border-slate-200/80 dark:border-white/[0.08] text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            <span>Actualiser</span>
          </button>
          <button
            onClick={onOpenNewIncident}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Signaler un incident</span>
          </button>
        </div>
      </div>

      {/* Attachment Request Banner (if any pending) */}
      {pendingRequests.length > 0 && (
        <div className="p-4 rounded-2xl glass-card border border-blue-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-blue-600 dark:text-blue-300">
                  Demande de rattachement en attente
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  {pendingRequests.length} demande(s)
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {pendingRequests[0].residentName}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-semibold">
                  {pendingRequests[0].role}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {pendingRequests[0].residenceName} — {pendingRequests[0].lotNumber}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onApproveAttachment(pendingRequests[0].id)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all min-h-11"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Approuver</span>
            </button>
            <button
              onClick={() => onRejectAttachment(pendingRequests[0].id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-white/[0.06] transition-colors min-h-11"
            >
              <X className="w-3.5 h-3.5" />
              <span>Refuser</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate("join-requests")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-white/[0.04] min-h-11"
            >
              Toutes
            </button>
          </div>
        </div>
      )}

      {/* Main Glassmorphic 3-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================= */}
        {/* LEFT COLUMN (Cols 1-4): Solde / Balance + Residence Card */}
        {/* ========================================================= */}
        <div className="lg:col-span-4 space-y-6">
          {/* Main Financial Balance Card with 3D Glass Orb */}
          <div className="glass-card rounded-3xl p-5 relative overflow-hidden transition-all duration-300">
            {/* 3D Glass Orb Artistic Visual */}
            <div className="relative w-full h-44 rounded-2xl overflow-hidden bg-gradient-to-b from-slate-100 to-slate-200/50 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center border border-white/60 dark:border-white/[0.08] shadow-inner">
              <img
                src={glassOrbImg}
                alt="3D Glass Financial Orb"
                className="w-full h-full object-cover mix-blend-multiply dark:mix-blend-lighten transform hover:scale-105 transition-transform duration-700 pointer-events-none"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-transparent to-transparent dark:from-[#0f172a]/90 pointer-events-none" />
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/80 dark:bg-black/40 backdrop-blur-md border border-white/80 dark:border-white/10 text-[10px] font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Trésorerie Active</span>
              </div>
            </div>

            {/* Segmented Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-100/90 dark:bg-white/[0.05] p-1 rounded-xl mt-4 border border-slate-200/80 dark:border-white/[0.06]">
              <button
                onClick={() => setBalanceFilter('general')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  balanceFilter === 'general'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Général
              </button>
              <button
                onClick={() => setBalanceFilter('expenses')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  balanceFilter === 'expenses'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Dépenses
              </button>
              <button
                onClick={() => setBalanceFilter('income')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  balanceFilter === 'income'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Recettes
              </button>
            </div>

            {/* Big Amount and Stats */}
            <div className="mt-5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Solde Net Disponible (Mai 2026)
              </span>
              <div className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-mono mt-1">
                {balanceFilter === 'expenses'
                  ? formatCurrency(financial.totalExpenses)
                  : balanceFilter === 'income'
                  ? formatCurrency(financial.totalCollected)
                  : formatCurrency(financial.netTreasury)}
              </div>

              {/* Sub-metrics */}
              <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-200/80 dark:border-white/[0.08]">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.04]">
                  <span className="text-[10px] font-semibold text-slate-400">Total Dépenses</span>
                  <p className="text-sm font-bold font-mono text-rose-500 mt-0.5">
                    {formatCurrency(financial.totalExpenses)}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.04]">
                  <span className="text-[10px] font-semibold text-slate-400">Total Recettes</span>
                  <p className="text-sm font-bold font-mono text-emerald-500 mt-0.5">
                    {formatCurrency(financial.totalCollected)}
                  </p>
                </div>
              </div>


              {/* Mini Bar Chart */}
              <div className="mt-5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-2">
                  <span>Historique mensuel</span>
                  <span className="text-emerald-500 font-bold">+18.4% ce mois</span>
                </div>
                <div className="flex items-end justify-between h-20 gap-2 pt-2 px-1">
                  {monthlyBars.map((b) => (
                    <div key={b.label} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                      <div className="w-full flex items-end justify-center gap-1 h-full">
                        <div
                          className="w-2.5 bg-rose-400/80 dark:bg-rose-500/70 rounded-full transition-all group-hover:bg-rose-500"
                          style={{ height: `${b.exp}%` }}
                          title={`Dépenses: ${b.exp * 20} €`}
                        />
                        <div
                          className="w-2.5 bg-blue-600 dark:bg-blue-400 rounded-full transition-all group-hover:scale-y-105"
                          style={{ height: `${b.val}%` }}
                          title={`Recettes: ${b.val * 20} €`}
                        />
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400 capitalize">
                        {b.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Residence Architectural Card */}
          <div className="glass-card rounded-3xl p-5 relative overflow-hidden group">
            <div className="relative h-36 rounded-2xl overflow-hidden mb-4 border border-white/40 dark:border-white/[0.08]">
              <img
                src={condoHeroImg}
                alt="Architecture de la Résidence"
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 text-white">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">
                  {activeResidence.city}
                </span>
                <h4 className="text-base font-extrabold leading-tight">
                  {activeResidence.name}
                </h4>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs mb-4">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.04]">
                <span className="text-[10px] text-slate-400 block font-semibold">Lots totaux</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm font-mono">
                  {activeResidence.totalLots} appartements
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.04]">
                <span className="text-[10px] text-slate-400 block font-semibold">Exercice</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm font-mono">
                  2026-2027
                </span>
              </div>
            </div>

            <button
              onClick={() => onNavigate('apartments')}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.08] text-xs font-bold text-slate-800 dark:text-slate-200 transition-colors flex items-center justify-center gap-1.5"
            >
              <Building className="w-3.5 h-3.5 text-blue-500" />
              <span>Consulter l’état des lots & copropriétaires</span>
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* CENTER COLUMN (Cols 5-8): Budget, Donut Chart, 4 Mini-KPIs */}
        {/* ========================================================= */}
        <div className="lg:col-span-4 space-y-6">
          {/* Monthly Budget Card with Dual Progress Capsule */}
          <div className="glass-card rounded-3xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Budget Prévisionnel Mensuel
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                  Consommation du budget
                </h3>
              </div>
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                Mai 2026
              </span>
            </div>

            <div className="flex items-baseline justify-between mt-4">
              <div>
                <span className="text-xs text-slate-400 font-medium">Engagé:</span>
                <p className="text-lg font-extrabold text-slate-900 dark:text-white font-mono">
                  {formatCurrency(financial.totalExpenses)}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 font-medium">Budget alloué:</span>
                <p className="text-lg font-extrabold text-slate-900 dark:text-white font-mono">
                  {formatCurrency(financial.totalCalled)}
                </p>
              </div>
            </div>

            {/* Dual color capsule progress bar */}
            <div className="w-full h-3 bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden mt-3 p-0.5 flex gap-1 border border-slate-200/80 dark:border-white/[0.04]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-700"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round((financial.totalExpenses / (financial.totalCalled || 1)) * 100)
                  )}%`,
                }}
              />
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 opacity-60 flex-1"
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 font-medium">
              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-blue-500" /> Dépensé (
                {Math.round((financial.totalExpenses / (financial.totalCalled || 1)) * 100)}%)
              </span>
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> Disponible restant
              </span>
            </div>
          </div>


          {/* Expenses Donut / Breakdown Card */}
          <div className="glass-card rounded-3xl p-5">
            <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.08] pb-3 mb-4">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Postes de Dépenses
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Répartition des charges
                </h3>
              </div>
              <button
                onClick={() => onNavigate('expenses')}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
              >
                Détails
              </button>
            </div>

            {/* Donut graphic and legend */}
            <div className="flex flex-col sm:flex-row items-center gap-5">
              {/* SVG Donut */}
              <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  {/* Background track */}
                  <path
                    className="text-slate-100 dark:text-white/[0.06]"
                    strokeWidth="3.8"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* Segment 1: Ascenseur (34%) */}
                  <path
                    className="text-blue-500"
                    strokeDasharray="34, 100"
                    strokeWidth="4"
                    stroke="currentColor"
                    fill="none"
                    strokeLinecap="round"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* Segment 2: Ménage (20%) */}
                  <path
                    className="text-emerald-500"
                    strokeDasharray="20, 100"
                    strokeDashoffset="-34"
                    strokeWidth="4"
                    stroke="currentColor"
                    fill="none"
                    strokeLinecap="round"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* Segment 3: Énergie (17%) */}
                  <path
                    className="text-amber-500"
                    strokeDasharray="17, 100"
                    strokeDashoffset="-54"
                    strokeWidth="4"
                    stroke="currentColor"
                    fill="none"
                    strokeLinecap="round"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* Segment 4: Sécurité (21%) */}
                  <path
                    className="text-pink-500"
                    strokeDasharray="21, 100"
                    strokeDashoffset="-71"
                    strokeWidth="4"
                    stroke="currentColor"
                    fill="none"
                    strokeLinecap="round"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] font-bold text-slate-400">Total</span>
                  <span className="text-xs font-extrabold font-mono text-slate-900 dark:text-white">
                    2 450 €
                  </span>
                </div>
              </div>

              {/* Legend List */}
              <div className="space-y-2 flex-1 w-full text-xs">
                {expenseCategories.slice(0, 4).map((cat) => (
                  <div key={cat.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="text-slate-600 dark:text-slate-300 font-medium truncate max-w-[120px]">
                        {cat.name}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {cat.amount} €
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 4 Mini Operational Metric Cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* Taux Recouvrement */}
            <div className="glass-card rounded-2xl p-4">
              <span className="text-[11px] font-semibold text-slate-400 block">Recouvrement</span>
              <div className="text-xl font-extrabold font-mono text-emerald-500 mt-1">
                {financial.collectionRate} %
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                {charges.filter((c) => c.status === 'Payé').length} lots en règle
              </span>
            </div>

            {/* Total Impayés */}
            <div className="glass-card rounded-2xl p-4">
              <span className="text-[11px] font-semibold text-slate-400 block">Total impayés</span>
              <div className="text-xl font-extrabold font-mono text-rose-500 mt-1">
                {formatCurrency(financial.totalUnpaid)}
              </div>
              <button
                onClick={() => onNavigate('charges')}
                className="text-[10px] text-rose-500 font-bold hover:underline mt-1 block"
              >
                Lancer relances →
              </button>
            </div>

            {/* Incidents en cours */}
            <div className="glass-card rounded-2xl p-4">
              <span className="text-[11px] font-semibold text-slate-400 block">Tickets pannes</span>
              <div className="text-xl font-extrabold font-mono text-amber-500 mt-1">
                {openIncidents.length} ouvert(s)
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                {incidents.filter((i) => i.priority === 'Haute').length} urgent(s)
              </span>
            </div>

            {/* Assemblée Quorum */}
            <div className="glass-card rounded-2xl p-4">
              <span className="text-[11px] font-semibold text-slate-400 block">Prochaine AG</span>
              <div className="text-base font-bold text-blue-600 dark:text-blue-400 mt-1">
                15 Déc 2026
              </div>
              <button
                onClick={() => onNavigate('meetings')}
                className="text-[10px] text-blue-500 font-bold hover:underline mt-1 block"
              >
                Ordre du jour →
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN (Cols 9-12): Virtual Copro Card, Quick Contacts, Recent Transactions */}
        {/* ========================================================= */}
        <div className="lg:col-span-4 space-y-6">
          {/* Stacked Virtual Copro Cards */}
          <div className="glass-card rounded-3xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Mes Comptes Copropriété
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Carte & Compte Bancaire
                </h3>
              </div>
              <button
                onClick={handleCopyRib}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline"
              >
                {copiedRib ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>RIB Copié</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copier RIB</span>
                  </>
                )}
              </button>
            </div>

            {/* Stacked Cards Presentation (Inspired by Reference 1) */}
            <div className="relative pt-2 pb-1">
              {/* Back card 2 (stack layer) */}
              <div className="absolute top-0 left-4 right-4 h-32 rounded-2xl bg-gradient-to-r from-purple-400 to-indigo-500 opacity-40 blur-xs transform -translate-y-1.5 scale-95 pointer-events-none" />

              {/* Main Virtual Card (Front) */}
              <div className="relative rounded-2xl p-5 text-white bg-gradient-to-br from-[#fca5a5] via-[#c084fc] to-[#60a5fa] shadow-xl shadow-purple-500/15 overflow-hidden border border-white/40">
                {/* Shiny gloss reflection */}
                <div className="absolute top-0 -left-12 w-48 h-full bg-white/20 transform skew-x-12 pointer-events-none" />

                <div className="flex items-start justify-between relative z-10">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-white/80">
                      Compte Courant Copro
                    </span>
                    <p className="text-2xl font-black font-mono tracking-tight text-white mt-1">
                      {formatCurrency(financial.netTreasury)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-lg italic tracking-wider text-white">VISA</span>
                    <span className="text-[9px] block text-white/80 font-mono">BUSINESS</span>
                  </div>
                </div>

                {/* Card Chip & Numbers */}
                <div className="mt-6 flex items-center justify-between relative z-10 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-6 rounded bg-amber-300/80 border border-amber-400 flex items-center justify-center text-[8px] font-bold text-amber-900">
                      CHIP
                    </div>
                    <span className="tracking-widest font-bold">•••• 5688</span>
                  </div>
                  <span className="text-[11px] font-bold text-white/90">09 / 29</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => onNavigate('wallet')}
              className="w-full mt-4 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-white/10 hover:border-blue-500 dark:hover:border-blue-400 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Gérer les comptes & moyens de paiement</span>
            </button>
          </div>

          {/* Quick Contacts / Avatar Row (Inspired by Reference 1) */}
          <div className="glass-card rounded-3xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Transactions Rapides
                </span>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Conseil syndical & Résidents
                </h4>
              </div>
              <button
                onClick={() => onNavigate('residents')}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
              >
                Voir tous
              </button>
            </div>

            {/* Circular Avatars Strip */}
            <div className="flex items-center gap-3 overflow-x-auto py-1">
              {/* Add / Action button */}
              <button
                onClick={() => onNavigate('residents')}
                className="w-11 h-11 rounded-full border-2 border-dashed border-slate-300 dark:border-white/20 hover:border-blue-500 text-slate-500 hover:text-blue-500 flex items-center justify-center shrink-0 transition-colors"
                title="Ajouter un copropriétaire"
              >
                <Plus className="w-4 h-4" />
              </button>

              {quickContacts.map((contact) => (
                <button
                  key={contact.name}
                  onClick={() => setSelectedQuickResident(contact.name)}
                  className={`flex flex-col items-center gap-1 shrink-0 group relative ${
                    selectedQuickResident === contact.name ? 'scale-105' : ''
                  }`}
                  title={`${contact.name} (${contact.role})`}
                >
                  <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white dark:border-slate-800 shadow-md group-hover:ring-2 group-hover:ring-blue-500 transition-all flex items-center justify-center bg-slate-100">
                    {contact.avatar ? (
                      <img src={contact.avatar} alt={contact.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-tr ${contact.color} text-white font-bold text-xs flex items-center justify-center`}>
                        {contact.initials}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 truncate max-w-[50px]">
                    {contact.name.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>

            {selectedQuickResident && (
              <div className="mt-3 p-3 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-500/20 text-xs flex items-center justify-between animate-fadeIn">
                <span className="text-slate-700 dark:text-slate-200 font-medium">
                  Contacter ou relancer <strong>{selectedQuickResident}</strong>
                </span>
                <button
                  onClick={() => {
                    alert(`Notification de rappel envoyée à ${selectedQuickResident}`);
                    setSelectedQuickResident(null);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] shadow-xs"
                >
                  Envoyer appel
                </button>
              </div>
            )}
          </div>

          {/* Recent Operations / Transactions */}
          <div className="glass-card rounded-3xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Flux récents
                </span>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Dernières opérations
                </h4>
              </div>
              <button
                onClick={() => onNavigate('payments')}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
              >
                Grand livre
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center font-bold text-xs">
                    <ArrowDownRight className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      Société Ascenseurs Otis
                    </p>
                    <span className="text-[10px] text-slate-400">Contrat mensuel · Hier</span>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-rose-500">- 450,00 €</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center font-bold text-xs">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      Cotisation Lot 04 (Mansour)
                    </p>
                    <span className="text-[10px] text-slate-400">Virement bancaire · 04 Mai</span>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-500">+ 180,00 €</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center font-bold text-xs">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      Cotisation Lot 12 (Trabelsi)
                    </p>
                    <span className="text-[10px] text-slate-400">Paiement par carte · 02 Mai</span>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-500">+ 180,00 €</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center font-bold text-xs">
                    <ArrowDownRight className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      Facture Électricité Parties Communes
                    </p>
                    <span className="text-[10px] text-slate-400">STEG / EDF · 28 Avr</span>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-rose-500">- 280,00 €</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
