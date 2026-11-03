"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import {
  Wrench,
  Plus,
  Search,
  Calendar,
  User,
  Phone,
  CheckCircle2,
  AlertTriangle,
  Play,
  XCircle,
  Trash2,
  ClipboardCheck,
  Euro,
  Building2,
  MapPin,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { AiDiagnosticButton } from "@/components/ai/AiDiagnosticButton";
import { fetchWithOffline } from "@/lib/offline/apiClient";
import {
  Role,
  MaintenanceType,
  MaintenanceStatus,
  EquipmentStatus,
} from "@/types/enums";

/* ============================================================ */
/* TYPES LOCAUX                                                 */
/* ============================================================ */
interface ResidenceItem {
  _id: string;
  name: string;
  city?: string;
}

interface EquipmentItem {
  _id: string;
  name: string;
  category: string;
  location?: string;
  status: string;
  nextMaintenanceDate?: string;
  residence?: ResidenceItem | string;
}

interface TechnicianItem {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
}

interface ChecklistItem {
  label: string;
  done: boolean;
}

interface MaintenanceTaskItem {
  _id: string;
  residence?: ResidenceItem | string;
  equipment?: EquipmentItem | string;
  type: "PREVENTIVE" | "CORRECTIVE" | string;
  status: "PLANNED" | "IN_PROGRESS" | "DONE" | "CANCELLED" | string;
  title: string;
  description?: string;
  scheduledDate: string;
  completedAt?: string;
  assignedTo?: TechnicianItem | string | null;
  cost?: number;
  notes?: string;
  checklist?: ChecklistItem[];
}

interface SessionUser {
  id: string;
  role: Role;
  name?: string;
}

/* ============================================================ */
/* CONSTANTES D'AFFICHAGE                                       */
/* ============================================================ */
const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  [MaintenanceStatus.PLANNED]: {
    label: "Planifiée",
    cls: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  [MaintenanceStatus.IN_PROGRESS]: {
    label: "En cours",
    cls: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  },
  [MaintenanceStatus.DONE]: {
    label: "Terminée",
    cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  [MaintenanceStatus.CANCELLED]: {
    label: "Annulée",
    cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  },
};

const TYPE_BADGES: Record<string, { label: string; cls: string }> = {
  [MaintenanceType.CORRECTIVE]: {
    label: "Corrective",
    cls: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  },
  [MaintenanceType.PREVENTIVE]: {
    label: "Préventive",
    cls: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
};

const EQUIPMENT_STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  [EquipmentStatus.OPERATIONAL]: {
    label: "Opérationnel",
    cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  [EquipmentStatus.BROKEN]: {
    label: "En panne",
    cls: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  },
  [EquipmentStatus.UNDER_MAINTENANCE]: {
    label: "En maintenance",
    cls: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  [EquipmentStatus.OUT_OF_SERVICE]: {
    label: "Hors service",
    cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  },
};

/* ============================================================ */
/* CONTENU PRINCIPAL DE LA PAGE INTERVENTIONS                   */
/* ============================================================ */
function MaintenanceContent() {
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [tasks, setTasks] = useState<MaintenanceTaskItem[]>([]);
  const [equipmentList, setEquipmentList] = useState<EquipmentItem[]>([]);
  const [residences, setResidences] = useState<ResidenceItem[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filtres et recherche
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  // BottomSheet 1 : Création d'une nouvelle intervention
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [createResidence, setCreateResidence] = useState("");
  const [createEquipment, setCreateEquipment] = useState("");
  const [createType, setCreateType] = useState<string>(MaintenanceType.PREVENTIVE);
  const [createTitle, setCreateTitle] = useState("");
  const [createScheduledDate, setCreateScheduledDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [createAssignedTo, setCreateAssignedTo] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createChecklistText, setCreateChecklistText] = useState("");

  // BottomSheet 2 : Clôture d'une intervention
  const [closingTask, setClosingTask] = useState<MaintenanceTaskItem | null>(null);
  const [closingChecklist, setClosingChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistLabel, setNewChecklistLabel] = useState("");
  const [closingCost, setClosingCost] = useState<string>("0");
  const [closingNotes, setClosingNotes] = useState<string>("");
  const [isSubmittingClose, setIsSubmittingClose] = useState(false);

  const isManager =
    currentUser?.role === Role.ADMIN || currentUser?.role === Role.SYNDIC;

  const showSuccess = (msg: string) => {
    setFeedbackMsg(msg);
    setErrorMsg(null);
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 5000);
  };

  // Extraction sécurisée d'une liste depuis la réponse fetchWithOffline
  const extractList = <T,>(res: unknown): T[] => {
    const r = res as { data?: T[] | { data?: T[] } } | null | undefined;
    if (!r || !r.data) return [];
    if (Array.isArray(r.data)) return r.data;
    if (Array.isArray(r.data.data)) return r.data.data;
    return [];
  };

  // Extraction sécurisée du statut et du message d'erreur d'une réponse
  const isResSuccess = (res: unknown): boolean => {
    const r = res as { ok?: boolean; queued?: boolean; error?: string } | null | undefined;
    return Boolean(r && (r.ok || r.queued || !r.error));
  };

  const getResError = (res: unknown, fallback: string): string => {
    const r = res as { error?: string } | null | undefined;
    return r?.error || fallback;
  };

  // Chargement des données
  const loadData = async (roleOverride?: Role) => {
    setIsLoading(true);
    try {
      const effectiveRole = roleOverride ?? currentUser?.role;
      const [maintRes, equipRes, resRes] = await Promise.all([
        fetchWithOffline("/api/maintenance?limit=50"),
        fetchWithOffline("/api/equipment?limit=50"),
        fetchWithOffline("/api/residences"),
      ]);

      const loadedTasks = extractList<MaintenanceTaskItem>(maintRes);
      const loadedEquipment = extractList<EquipmentItem>(equipRes);
      const loadedResidences = extractList<ResidenceItem>(resRes);

      setTasks(loadedTasks);
      setEquipmentList(loadedEquipment);
      setResidences(loadedResidences);

      if (!createResidence && loadedResidences.length > 0) {
        setCreateResidence(loadedResidences[0]._id);
      }

      if (effectiveRole === Role.ADMIN || effectiveRole === Role.SYNDIC) {
        const techRes = await fetchWithOffline("/api/users?role=TECHNICIAN&limit=50");
        setTechnicians(extractList<TechnicianItem>(techRes));
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Impossible de charger les interventions.";
      showError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch("/api/auth/session");
        const session = await res.json();
        const user: SessionUser | null = session?.user ?? null;
        setCurrentUser(user);
        await loadData(user?.role);
      } catch {
        await loadData();
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compteurs du parc d'équipements
  const equipmentStats = useMemo(() => {
    const counts = {
      operational: 0,
      broken: 0,
      underMaintenance: 0,
      outOfService: 0,
    };
    for (const eq of equipmentList) {
      if (eq.status === EquipmentStatus.OPERATIONAL) counts.operational++;
      else if (eq.status === EquipmentStatus.BROKEN) counts.broken++;
      else if (eq.status === EquipmentStatus.UNDER_MAINTENANCE) counts.underMaintenance++;
      else if (eq.status === EquipmentStatus.OUT_OF_SERVICE) counts.outOfService++;
    }
    return counts;
  }, [equipmentList]);

  // Équipements filtrés par résidence pour le formulaire de création
  const filteredEquipmentForCreate = useMemo(() => {
    if (!createResidence) return equipmentList;
    return equipmentList.filter((eq) => {
      const resId =
        typeof eq.residence === "object" && eq.residence !== null
          ? eq.residence._id
          : eq.residence;
      return resId === createResidence;
    });
  }, [equipmentList, createResidence]);

  // Synchroniser l'équipement par défaut quand la résidence change
  useEffect(() => {
    if (filteredEquipmentForCreate.length > 0) {
      const exists = filteredEquipmentForCreate.some((e) => e._id === createEquipment);
      if (!exists) {
        setCreateEquipment(filteredEquipmentForCreate[0]._id);
      }
    } else {
      setCreateEquipment("");
    }
  }, [filteredEquipmentForCreate, createEquipment]);

  // Filtrage des interventions
  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (statusFilter !== "ALL" && task.status !== statusFilter) return false;
      if (typeFilter !== "ALL" && task.type !== typeFilter) return false;
      if (q) {
        const eqName =
          typeof task.equipment === "object" && task.equipment !== null
            ? task.equipment.name.toLowerCase()
            : "";
        const inTitle = task.title?.toLowerCase().includes(q);
        const inDesc = task.description?.toLowerCase().includes(q);
        const inEq = eqName.includes(q);
        if (!inTitle && !inDesc && !inEq) return false;
      }
      return true;
    });
  }, [tasks, search, statusFilter, typeFilter]);

  // Actions sur une intervention
  const handleStatusChange = async (
    taskId: string,
    newStatus: "IN_PROGRESS" | "CANCELLED"
  ) => {
    try {
      const res = await fetchWithOffline(`/api/maintenance/${taskId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (isResSuccess(res)) {
        showSuccess(
          newStatus === "IN_PROGRESS"
            ? "Intervention démarrée."
            : "Intervention annulée."
        );
        await loadData();
      } else {
        showError(getResError(res, "Erreur lors du changement de statut."));
      }
    } catch (err: unknown) {
      showError(
        err instanceof Error ? err.message : "Erreur lors du changement de statut."
      );
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm("Confirmer la suppression de cette intervention ?")) return;
    try {
      const res = await fetchWithOffline(`/api/maintenance/${taskId}`, {
        method: "DELETE",
      });

      if (isResSuccess(res)) {
        showSuccess("Intervention supprimée.");
        await loadData();
      } else {
        showError(getResError(res, "Impossible de supprimer cette intervention."));
      }
    } catch (err: unknown) {
      showError(
        err instanceof Error
          ? err.message
          : "Impossible de supprimer cette intervention."
      );
    }
  };

  // Soumission de la création
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createResidence || !createEquipment || !createTitle.trim() || !createScheduledDate) {
      showError("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    setIsSubmittingCreate(true);
    try {
      const checklist: ChecklistItem[] = createChecklistText
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((label) => ({ label, done: false }));

      const clientId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `maint-${Date.now()}`;

      const payload: Record<string, unknown> = {
        residence: createResidence,
        equipment: createEquipment,
        type: createType,
        title: createTitle.trim(),
        description: createDescription.trim() || undefined,
        scheduledDate: createScheduledDate,
        assignedTo: createAssignedTo || undefined,
        checklist,
        clientId,
      };

      const res = await fetchWithOffline("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (isResSuccess(res)) {
        setIsCreateOpen(false);
        setCreateTitle("");
        setCreateDescription("");
        setCreateChecklistText("");
        setCreateAssignedTo("");
        showSuccess("Intervention créée avec succès.");
        await loadData();
      } else {
        showError(
          getResError(res, "Erreur lors de la création de l'intervention.")
        );
      }
    } catch (err: unknown) {
      showError(
        err instanceof Error
          ? err.message
          : "Erreur lors de la création de l'intervention."
      );
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Ouverture du BottomSheet de clôture
  const openCloseModal = (task: MaintenanceTaskItem) => {
    setClosingTask(task);
    setClosingChecklist(
      (task.checklist || []).map((item) => ({
        label: item.label,
        done: Boolean(item.done),
      }))
    );
    setNewChecklistLabel("");
    setClosingCost(String(task.cost ?? 0));
    setClosingNotes(task.notes ?? "");
  };

  const handleToggleChecklistItem = (index: number) => {
    setClosingChecklist((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, done: !item.done } : item))
    );
  };

  const handleAddChecklistItem = () => {
    const trimmed = newChecklistLabel.trim();
    if (!trimmed) return;
    setClosingChecklist((prev) => [...prev, { label: trimmed, done: true }]);
    setNewChecklistLabel("");
  };

  // Soumission de la clôture
  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closingTask) return;

    setIsSubmittingClose(true);
    try {
      const parsedCost = parseFloat(closingCost);
      const cost = Number.isNaN(parsedCost) || parsedCost < 0 ? 0 : parsedCost;

      const res = await fetchWithOffline(
        `/api/maintenance/${closingTask._id}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cost,
            notes: closingNotes.trim(),
            checklist: closingChecklist,
          }),
        }
      );

      if (isResSuccess(res)) {
        setClosingTask(null);
        showSuccess(
          cost > 0
            ? "Intervention clôturée et dépense de copropriété générée."
            : "Intervention clôturée avec succès."
        );
        await loadData();
      } else {
        showError(
          getResError(res, "Erreur lors de la clôture de l'intervention.")
        );
      }
    } catch (err: unknown) {
      showError(
        err instanceof Error
          ? err.message
          : "Erreur lors de la clôture de l'intervention."
      );
    } finally {
      setIsSubmittingClose(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* En-tête */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
              Interventions & Maintenance
            </h1>
            <p className="text-xs text-slate-500 sm:text-sm dark:text-slate-400">
              Suivi des entretiens préventifs, dépannages et remise en service du parc
            </p>
          </div>
          {isManager && (
            <Button
              variant="primary"
              onClick={() => setIsCreateOpen(true)}
              className="min-h-[44px] gap-2 self-start sm:self-auto"
            >
              <Plus className="h-4 w-4" />
              Nouvelle intervention
            </Button>
          )}
        </div>

        {/* Messages de retour */}
        {feedbackMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* A) Bandeau "État du parc d'équipements" */}
        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            État du parc d&apos;équipements
          </h2>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
              <div>
                <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  Opérationnels
                </p>
                <p className="text-xl font-bold text-emerald-800 dark:text-emerald-200">
                  {equipmentStats.operational}
                </p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50/60 p-3 dark:border-rose-900/50 dark:bg-rose-950/30">
              <div>
                <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                  En panne
                </p>
                <p className="text-xl font-bold text-rose-800 dark:text-rose-200">
                  {equipmentStats.broken}
                </p>
              </div>
              <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
              <div>
                <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                  En maintenance
                </p>
                <p className="text-xl font-bold text-amber-800 dark:text-amber-200">
                  {equipmentStats.underMaintenance}
                </p>
              </div>
              <Wrench className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
              <div>
                <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Hors service
                </p>
                <p className="text-xl font-bold text-slate-800 dark:text-slate-200">
                  {equipmentStats.outOfService}
                </p>
              </div>
              <XCircle className="h-5 w-5 text-slate-500 dark:text-slate-400" />
            </div>
          </div>
        </div>

        {/* B) Barre de recherche & Filtres */}
        <Card className="p-3.5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher titre, description, équipement..."
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: "ALL", label: "Tous les statuts" },
                { value: MaintenanceStatus.PLANNED, label: "Planifiée" },
                { value: MaintenanceStatus.IN_PROGRESS, label: "En cours" },
                { value: MaintenanceStatus.DONE, label: "Terminée" },
                { value: MaintenanceStatus.CANCELLED, label: "Annulée" },
              ]}
            />

            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={[
                { value: "ALL", label: "Tous les types" },
                { value: MaintenanceType.PREVENTIVE, label: "Préventive" },
                { value: MaintenanceType.CORRECTIVE, label: "Corrective / Panne" },
              ]}
            />
          </div>
        </Card>

        {/* C) Liste des cartes d'intervention */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((n) => (
              <Skeleton key={n} className="h-60 w-full rounded-2xl" />
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <EmptyState
            title="Aucune intervention trouvée"
            description="Aucune tâche de maintenance ne correspond à vos critères actuels."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {filteredTasks.map((task) => {
              const isCorrective = task.type === MaintenanceType.CORRECTIVE;
              const borderClass = isCorrective
                ? "border-l-4 border-l-rose-500"
                : "border-l-4 border-l-sky-500";

              const typeBadge = TYPE_BADGES[task.type] || {
                label: task.type,
                cls: "bg-slate-100 text-slate-700",
              };
              const statusBadge = STATUS_BADGES[task.status] || {
                label: task.status,
                cls: "bg-slate-100 text-slate-700",
              };

              const eqObj =
                typeof task.equipment === "object" && task.equipment !== null
                  ? task.equipment
                  : null;
              const eqStatusBadge = eqObj
                ? EQUIPMENT_STATUS_BADGES[eqObj.status] || {
                    label: eqObj.status,
                    cls: "bg-slate-100 text-slate-600",
                  }
                : null;

              const resObj =
                typeof task.residence === "object" && task.residence !== null
                  ? task.residence
                  : null;

              const techObj =
                typeof task.assignedTo === "object" && task.assignedTo !== null
                  ? task.assignedTo
                  : null;

              const isOpenStatus =
                task.status === MaintenanceStatus.PLANNED ||
                task.status === MaintenanceStatus.IN_PROGRESS;
              const isOverdue =
                isOpenStatus &&
                Boolean(task.scheduledDate) &&
                new Date(task.scheduledDate).getTime() < Date.now() - 86400000;

              const checklistTotal = task.checklist?.length ?? 0;
              const checklistDone =
                task.checklist?.filter((c) => c.done).length ?? 0;

              return (
                <Card
                  key={task._id}
                  className={`flex flex-col justify-between p-4 ${borderClass}`}
                >
                  <div className="space-y-3">
                    {/* En-tête de carte */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {task.title}
                      </h3>
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${typeBadge.cls}`}
                        >
                          {typeBadge.label}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusBadge.cls}`}
                        >
                          {statusBadge.label}
                        </span>
                      </div>
                    </div>

                    {task.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {task.description}
                      </p>
                    )}

                    {/* Bloc Équipement concerné */}
                    <div className="rounded-xl bg-slate-50 p-2.5 text-xs dark:bg-slate-800/60">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                          <Wrench className="h-3.5 w-3.5 text-sky-500" />
                          <span>{eqObj?.name || "Équipement"}</span>
                          {eqObj?.location && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] font-normal text-slate-500">
                              • <MapPin className="h-3 w-3" /> {eqObj.location}
                            </span>
                          )}
                        </div>
                        {eqStatusBadge && (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${eqStatusBadge.cls}`}
                          >
                            {eqStatusBadge.label}
                          </span>
                        )}
                      </div>
                      {resObj && (
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                          <Building2 className="h-3 w-3" />
                          <span>{resObj.name}</span>
                        </div>
                      )}
                    </div>

                    {/* Infos clés */}
                    <div className="grid grid-cols-1 gap-1.5 text-xs text-slate-600 sm:grid-cols-2 dark:text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span>
                          Prévue :{" "}
                          <strong>
                            {task.scheduledDate
                              ? new Date(task.scheduledDate).toLocaleDateString("fr-FR")
                              : "—"}
                          </strong>
                        </span>
                        {isOverdue && (
                          <span className="font-bold text-rose-600 dark:text-rose-400">
                            (En retard)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        {techObj ? (
                          <span className="flex items-center gap-1.5">
                            <strong>{techObj.name}</strong>
                            {techObj.phone && (
                              <a
                                href={`tel:${techObj.phone}`}
                                className="inline-flex items-center gap-0.5 text-sky-600 underline hover:text-sky-700 dark:text-sky-400"
                              >
                                <Phone className="h-3 w-3" />
                                {techObj.phone}
                              </a>
                            )}
                          </span>
                        ) : (
                          <span className="italic text-slate-400">Non assigné</span>
                        )}
                      </div>

                      {typeof task.cost === "number" && task.cost > 0 && (
                        <div className="flex items-center gap-1.5">
                          <Euro className="h-3.5 w-3.5 text-slate-400" />
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {task.cost.toFixed(2)} €
                          </span>
                          {task.status === MaintenanceStatus.DONE && (
                            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                              Dépense générée
                            </span>
                          )}
                        </div>
                      )}

                      {checklistTotal > 0 && (
                        <div className="flex items-center gap-1.5">
                          <ClipboardCheck className="h-3.5 w-3.5 text-slate-400" />
                          <span>
                            {checklistDone}/{checklistTotal} points validés
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Boutons d'action */}
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    {task.status === MaintenanceStatus.PLANNED && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleStatusChange(task._id, MaintenanceStatus.IN_PROGRESS)
                        }
                        className="min-h-[44px] gap-1.5 text-xs"
                      >
                        <Play className="h-3.5 w-3.5" />
                        Démarrer l&apos;intervention
                      </Button>
                    )}

                    {(task.status === MaintenanceStatus.PLANNED ||
                      task.status === MaintenanceStatus.IN_PROGRESS) && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => openCloseModal(task)}
                        className="min-h-[44px] gap-1.5 text-xs"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Clôturer
                      </Button>
                    )}

                    {isManager &&
                      (task.status === MaintenanceStatus.PLANNED ||
                        task.status === MaintenanceStatus.IN_PROGRESS) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleStatusChange(task._id, MaintenanceStatus.CANCELLED)
                          }
                          className="min-h-[44px] gap-1.5 text-xs text-amber-600 hover:text-amber-700"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Annuler
                        </Button>
                      )}

                    {isManager &&
                      (task.status === MaintenanceStatus.PLANNED ||
                        task.status === MaintenanceStatus.CANCELLED) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(task._id)}
                          className="min-h-[44px] gap-1.5 text-xs text-rose-600 hover:text-rose-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Supprimer
                        </Button>
                      )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* D) BottomSheet 1 — Nouvelle intervention */}
        <BottomSheet
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Nouvelle intervention"
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <Select
              label="Résidence *"
              required
              value={createResidence}
              onChange={(e) => setCreateResidence(e.target.value)}
              options={[
                { value: "", label: "Sélectionner une résidence..." },
                ...residences.map((r) => ({ value: r._id, label: r.name })),
              ]}
            />

            <Select
              label="Équipement *"
              required
              value={createEquipment}
              onChange={(e) => setCreateEquipment(e.target.value)}
              options={[
                { value: "", label: "Sélectionner un équipement..." },
                ...filteredEquipmentForCreate.map((eq) => ({
                  value: eq._id,
                  label: eq.location ? `${eq.name} (${eq.location})` : eq.name,
                })),
              ]}
            />

            <Select
              label="Type d'intervention *"
              required
              value={createType}
              onChange={(e) => setCreateType(e.target.value)}
              options={[
                {
                  value: MaintenanceType.PREVENTIVE,
                  label: "Préventive (entretien périodique)",
                },
                {
                  value: MaintenanceType.CORRECTIVE,
                  label: "Corrective (panne — passe l'équipement en panne)",
                },
              ]}
            />

            <Input
              label="Titre de l'intervention *"
              required
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              placeholder="Ex : Révision trimestrielle ascenseur"
            />

            <Input
              label="Date prévue *"
              type="date"
              required
              value={createScheduledDate}
              onChange={(e) => setCreateScheduledDate(e.target.value)}
            />

            <Select
              label="Technicien assigné"
              value={createAssignedTo}
              onChange={(e) => setCreateAssignedTo(e.target.value)}
              options={[
                { value: "", label: "Non assigné" },
                ...technicians.map((t) => ({ value: t._id, label: t.name })),
              ]}
            />

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Description / consignes
              </label>
              <textarea
                rows={3}
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                placeholder="Détails ou instructions pour le technicien..."
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-base text-slate-900 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <AiDiagnosticButton
              mode="maintenance"
              title={createTitle}
              description={createDescription}
              onResult={(ai) => {
                if (
                  ai.maintenanceType === MaintenanceType.PREVENTIVE ||
                  ai.maintenanceType === MaintenanceType.CORRECTIVE
                ) {
                  setCreateType(ai.maintenanceType);
                }
                if (ai.technicalAdvice) {
                  setCreateDescription((prev) => {
                    const trimmed = prev.trim();
                    if (!trimmed) return `💡 Diagnostic IA : ${ai.technicalAdvice}`;
                    if (trimmed.includes(ai.technicalAdvice)) return prev;
                    return `${trimmed}\n\n💡 Diagnostic IA : ${ai.technicalAdvice}`;
                  });
                }
                if (Array.isArray(ai.checklist) && ai.checklist.length > 0) {
                  setCreateChecklistText(ai.checklist.join("\n"));
                }
              }}
            />

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Checklist initiale (points séparés par une virgule ou un retour à la ligne)
              </label>
              <textarea
                rows={3}
                value={createChecklistText}
                onChange={(e) => setCreateChecklistText(e.target.value)}
                placeholder="Ex : Vérifier câbles, Tester frein d'urgence, Graissage paliers"
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-base text-slate-900 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="min-h-[44px]"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmittingCreate}
                className="min-h-[44px]"
              >
                Créer l&apos;intervention
              </Button>
            </div>
          </form>
        </BottomSheet>

        {/* E) BottomSheet 2 — Clôturer l'intervention */}
        <BottomSheet
          isOpen={Boolean(closingTask)}
          onClose={() => setClosingTask(null)}
          title="Clôturer l'intervention"
        >
          {closingTask && (
            <form onSubmit={handleCompleteSubmit} className="space-y-4">
              {/* Rappel du titre et de l'équipement */}
              <div className="rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/60">
                <p className="font-bold text-slate-900 dark:text-white">
                  {closingTask.title}
                </p>
                <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                  Équipement :{" "}
                  {typeof closingTask.equipment === "object" &&
                  closingTask.equipment !== null
                    ? closingTask.equipment.name
                    : "Équipement"}
                </p>
              </div>

              {/* Checklist interactive */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Points de contrôle (Checklist)
                </label>
                {closingChecklist.length === 0 ? (
                  <p className="text-xs italic text-slate-400">
                    Aucun point de contrôle défini.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {closingChecklist.map((item, idx) => (
                      <label
                        key={idx}
                        className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => handleToggleChecklistItem(idx)}
                          className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        />
                        <span
                          className={
                            item.done
                              ? "line-through text-slate-400"
                              : "text-slate-800 dark:text-slate-200"
                          }
                        >
                          {item.label}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                {/* Ajout d'un point à la volée */}
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newChecklistLabel}
                    onChange={(e) => setNewChecklistLabel(e.target.value)}
                    placeholder="Ajouter un point vérifié..."
                    className="min-h-[44px] flex-1 rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-900 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddChecklistItem}
                    className="min-h-[44px]"
                  >
                    Ajouter
                  </Button>
                </div>
              </div>

              {/* Coût de l'intervention */}
              <div className="space-y-1">
                <Input
                  label="Coût de l'intervention (€)"
                  type="number"
                  step="0.01"
                  min="0"
                  value={closingCost}
                  onChange={(e) => setClosingCost(e.target.value)}
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Si &gt; 0, une dépense de copropriété sera créée automatiquement
                </p>
              </div>

              {/* Rapport / Notes de clôture */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Rapport / Notes de clôture
                </label>
                <textarea
                  rows={3}
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="Compte-rendu des travaux effectués, pièces remplacées..."
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-base text-slate-900 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setClosingTask(null)}
                  className="min-h-[44px]"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmittingClose}
                  className="min-h-[44px]"
                >
                  Valider la clôture
                </Button>
              </div>
            </form>
          )}
        </BottomSheet>
      </div>
    </AppLayout>
  );
}

export default function MaintenancePage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="space-y-4">
            <Skeleton className="h-10 w-64 rounded-xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        </AppLayout>
      }
    >
      <MaintenanceContent />
    </Suspense>
  );
}
