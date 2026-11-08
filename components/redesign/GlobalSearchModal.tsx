"use client";

import React from "react";
import {
  Search,
  X,
  LayoutDashboard,
  Receipt,
  AlertTriangle,
  FileText,
  Users,
  Building,
  Vote,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { fetchWithOffline } from "@/lib/offline/apiClient";

/** Résultat aligné sur GET /api/search */
export interface SearchResultItem {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  href: string;
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
  /** Navigation explicite par URL (ex. router.push) ; sinon le modal utilise useRouter */
  onNavigateHref?: (href: string) => void;
}

const SEARCH_TYPE_LABEL: Record<string, string> = {
  incident: "Incident",
  announcement: "Annonce",
  charge: "Charge",
  apartment: "Lot",
  resident: "Résident",
  document: "Document",
  meeting: "Assemblée",
};

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onNavigateHref,
}) => {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [apiResults, setApiResults] = React.useState<SearchResultItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setApiResults([]);
      setSearchError(null);
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  React.useEffect(() => {
    if (!isOpen) return;

    const q = query.trim();
    if (q.length < 2) {
      setApiResults([]);
      setSearchError(null);
      setLoading(false);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      return;
    }

    setLoading(true);
    setSearchError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const run = async () => {
        try {
          const encoded = encodeURIComponent(q);
          const res = await fetchWithOffline<{ data: SearchResultItem[] }>(
            `/api/search?q=${encoded}`
          );
          setApiResults(res.data || []);
        } catch (e) {
          setSearchError(e instanceof Error ? e.message : "Recherche indisponible");
          setApiResults([]);
        } finally {
          setLoading(false);
        }
      };
      void run();
    }, 280);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, isOpen]);

  if (!isOpen) return null;

  const modules = [
    { id: "dashboard", title: "Tableau de bord", desc: "Indicateurs clés et pilotage financier", icon: LayoutDashboard },
    { id: "charges", title: "Charges & Cotisations", desc: "Appels de fonds, état de paiement des lots", icon: Receipt },
    { id: "expenses", title: "Dépenses & Factures", desc: "Suivi des prestataires STEG, SONEDE, ascenseur", icon: FileText },
    { id: "payments", title: "Paiements", desc: "Encaissements et reçus", icon: Receipt },
    { id: "incidents", title: "Incidents & Pannes", desc: "Déclarations, interventions et techniciens", icon: AlertTriangle },
    { id: "residences", title: "Résidences", desc: "Immeubles gérés par le syndic", icon: Building },
    { id: "residents", title: "Fiches Résidents", desc: "Annuaire des copropriétaires et locataires", icon: Users },
    { id: "apartments", title: "Lots & Tantièmes", desc: "Surfaces, millièmes et clés de répartition", icon: Building },
    { id: "users", title: "Utilisateurs", desc: "Rôles, comptes et accès", icon: Users },
    { id: "employees", title: "Personnel", desc: "Gardiens, agents et contrats", icon: Users },
    { id: "shifts", title: "Plannings", desc: "Créneaux horaires et gardes", icon: Users },
    { id: "leaves", title: "Congés", desc: "Absences et validations RH", icon: FileText },
    { id: "equipment", title: "Équipements", desc: "Parc technique et garanties", icon: Building },
    { id: "maintenance", title: "Interventions", desc: "Maintenance préventive et pannes", icon: AlertTriangle },
    { id: "stock", title: "Stock & Consommables", desc: "Inventaire, mouvements et alertes", icon: FileText },
    { id: "meetings", title: "Assemblées Générales (AG)", desc: "Ordre du jour, calcul du quorum et PV", icon: Users },
    { id: "resolutions", title: "Résolutions", desc: "Dépouillement et quorums", icon: Vote },
    { id: "votes", title: "Bulletins de vote", desc: "Suffrages par tantièmes", icon: Vote },
    { id: "elections", title: "Élections du Syndic", desc: "Scrutin démocratique, candidatures et votes", icon: Vote },
    { id: "documents", title: "Documents & Contrats", desc: "Règlements, polices d’assurance et archives", icon: FileText },
    { id: "announcements", title: "Annonces", desc: "Panneau d’affichage officiel", icon: FileText },
    { id: "wallet", title: "Portefeuille Résident", desc: "Paiement en ligne D17, Flip et quittances", icon: Receipt },
    { id: "join", title: "Rejoindre une résidence", desc: "Demande d’accès à un lot", icon: Building },
    { id: "more", title: "Plus / Centre opérationnel", desc: "Tous les modules et diagnostics PWA", icon: LayoutDashboard },
  ];

  const filteredModules =
    query.trim().length < 2
      ? modules
      : modules.filter(
          (m) =>
            m.title.toLowerCase().includes(query.toLowerCase()) ||
            m.desc.toLowerCase().includes(query.toLowerCase())
        );

  const goHref = (href: string) => {
    if (onNavigateHref) onNavigateHref(href);
    else router.push(href);
    onClose();
  };

  const showApiSearch = query.trim().length >= 2;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl glass-card rounded-3xl shadow-2xl overflow-hidden border border-white/80 dark:border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Rechercher un module, un lot, une facture..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full min-h-[44px] bg-transparent text-base text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none md:text-sm"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-2 min-w-[44px] min-h-[44px] rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06]"
          >
            <X className="w-4 h-4 mx-auto" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {showApiSearch ? (
            <>
              {loading && (
                <div className="flex items-center justify-center gap-2 p-8 text-xs text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Recherche…
                </div>
              )}
              {searchError && !loading && (
                <div className="p-4 rounded-2xl border border-rose-500/25 bg-rose-500/10 text-xs text-rose-700 dark:text-rose-200">
                  {searchError}
                </div>
              )}
              {!loading && !searchError && apiResults.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400">
                  Aucun résultat pour « {query.trim()} »
                </div>
              )}
              {!loading &&
                !searchError &&
                apiResults.map((item) => {
                  const typeLabel = SEARCH_TYPE_LABEL[item.type] || item.type;
                  return (
                    <button
                      key={`${item.type}-${item.id}`}
                      type="button"
                      onClick={() => goHref(item.href)}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-100/80 dark:hover:bg-white/[0.06] text-left transition-colors group"
                    >
                      <div className="w-9 h-9 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 group-hover:bg-indigo-600/20">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                          {item.title}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {[typeLabel, item.subtitle].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      {item.badge && (
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 shrink-0">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
            </>
          ) : filteredModules.length > 0 ? (
            filteredModules.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onNavigate(item.id);
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-100/80 dark:hover:bg-white/[0.06] text-left transition-colors group"
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:bg-blue-600/20">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {item.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{item.desc}</p>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="p-8 text-center text-xs text-slate-400">
              Aucun module pour « {query} »
            </div>
          )}
        </div>

        <div className="p-3 bg-slate-50/80 dark:bg-black/20 border-t border-slate-200/80 dark:border-white/[0.04] text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between px-4">
          <span>Appuyez sur Échap pour fermer</span>
          <span className="font-semibold text-blue-600 dark:text-blue-400">Navigation rapide SyndicPro</span>
        </div>
      </div>
    </div>
  );
};
