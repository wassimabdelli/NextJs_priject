"use client";

import { useEffect, useState, useMemo, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  PlusCircle,
  Camera,
  X,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  UserCheck,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { fetchWithOffline } from "@/lib/offline/apiClient";
import type { IncidentDTO, ResidenceDTO } from "@/types/api";
import { IncidentCategory, Priority, IncidentStatus, Role } from "@/types/enums";

// Libellés français
const CATEGORY_LABELS: Record<string, string> = {
  [IncidentCategory.PLUMBING]: "Plomberie",
  [IncidentCategory.ELECTRICITY]: "Électricité",
  [IncidentCategory.ELEVATOR]: "Ascenseur",
  [IncidentCategory.CLEANING]: "Nettoyage",
  [IncidentCategory.SECURITY]: "Sécurité",
  [IncidentCategory.OTHER]: "Autre",
};

const STATUS_LABELS: Record<string, string> = {
  [IncidentStatus.REPORTED]: "Signalé",
  [IncidentStatus.ASSIGNED]: "Assigné",
  [IncidentStatus.IN_PROGRESS]: "En cours",
  [IncidentStatus.RESOLVED]: "Résolu",
};

const PRIORITY_BORDER_CLASSES: Record<Priority, string> = {
  [Priority.URGENT]: "border-l-rose-500",
  [Priority.HIGH]: "border-l-amber-500",
  [Priority.MEDIUM]: "border-l-yellow-500",
  [Priority.LOW]: "border-l-slate-400 dark:border-l-slate-600",
};

const WORKFLOW_STEPS: Array<{ key: IncidentStatus; label: string }> = [
  { key: IncidentStatus.REPORTED, label: "Signalé" },
  { key: IncidentStatus.ASSIGNED, label: "Assigné" },
  { key: IncidentStatus.IN_PROGRESS, label: "En cours" },
  { key: IncidentStatus.RESOLVED, label: "Résolu" },
];

function getProp(obj: any, key: string): any {
  if (!obj) return undefined;
  if (typeof obj === "object") return obj[key];
  return undefined;
}

function formatFullDate(dateVal?: string | Date): string {
  if (!dateVal) return "—";
  try {
    const d = new Date(dateVal);
    const datePart = d.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const timePart = d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${datePart} à ${timePart}`;
  } catch {
    return "—";
  }
}

function formatRelativeTime(dateVal?: string | Date): string {
  if (!dateVal) return "";
  try {
    const diffMs = Date.now() - new Date(dateVal).getTime();
    if (diffMs < 0) return "à l'instant";
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return "à l'instant";
    if (minutes < 60) return `il y a ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `il y a ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `il y a ${days} j`;
    const months = Math.floor(days / 30);
    if (months < 12) return `il y a ${months} mois`;
    const years = Math.floor(months / 12);
    return `il y a ${years} an${years > 1 ? "s" : ""}`;
  } catch {
    return "";
  }
}

function IncidentsContent() {
  const searchParams = useSearchParams();
  const [incidents, setIncidents] = useState<IncidentDTO[]>([]);
  const [residences, setResidences] = useState<ResidenceDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ id: string; role: Role } | null>(null);
  const [technicians, setTechnicians] = useState<Array<{ _id: string; name: string; email: string }>>([]);

  // Filtres
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  // Modal de création
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<IncidentCategory>(IncidentCategory.PLUMBING);
  const [priority, setPriority] = useState<Priority>(Priority.MEDIUM);
  const [residenceId, setResidenceId] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal d'assignation
  const [assigningIncident, setAssigningIncident] = useState<IncidentDTO | null>(null);
  const [selectedTechId, setSelectedTechId] = useState<string>("");
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);

  // Modal de détail d'incident & zoom photo
  const [selectedIncident, setSelectedIncident] = useState<IncidentDTO | null>(null);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);

  // État local pour le déploiement des descriptions longues
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const submitLock = useRef(false);
  const clientIdRef = useRef<string>(
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
  );

  const resetClientId = () => {
    clientIdRef.current =
      typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  };

  const toggleExpandDescription = (id: string) => {
    setExpandedDescriptions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [incRes, resRes] = await Promise.all([
        fetchWithOffline<any>("/api/incidents"),
        fetchWithOffline<any>("/api/residences"),
      ]);
      const incList = Array.isArray(incRes) ? incRes : incRes?.data || [];
      const resList = Array.isArray(resRes) ? resRes : resRes?.data || [];
      setIncidents(incList);
      setResidences(resList);
      if (resList.length > 0) {
        setResidenceId(resList[0]._id);
      }
    } catch (err) {
      console.error("[Incidents] Erreur chargement :", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    if (searchParams.get("action") === "new" || searchParams.get("new") === "1") {
      setIsModalOpen(true);
    }

    // Récupérer la session utilisateur courante
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setCurrentUser({ id: data.user.id, role: data.user.role as Role });
          if (data.user.role === Role.ADMIN || data.user.role === Role.SYNDIC) {
            fetch("/api/users?role=TECHNICIAN&limit=50")
              .then((r) => (r.ok ? r.json() : null))
              .then((techs) => {
                const list = Array.isArray(techs) ? techs : techs?.data || [];
                setTechnicians(list);
              })
              .catch(() => {});
          }
        }
      })
      .catch(() => {});
  }, [searchParams]);

  // Compression photo côté client via canvas (strictement <= 1 Mo)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 800;
        let width = img.width;
        let height = img.height;

        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        // Compression adaptative assurant taille <= 1 Mo
        let quality = 0.75;
        let compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
        while (compressedDataUrl.length > 1_000_000 && quality > 0.25) {
          quality -= 0.15;
          compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
        }

        setPhotos((prev) => [...prev.slice(0, 2), compressedDataUrl]);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;

    if (!residenceId) {
      setErrorMessage("Veuillez sélectionner une résidence.");
      submitLock.current = false;
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const newIncident = await fetchWithOffline<IncidentDTO>("/api/incidents", {
        method: "POST",
        entity: "incident",
        body: JSON.stringify({
          residence: residenceId,
          title,
          description,
          category,
          priority,
          photos,
          clientId: clientIdRef.current,
        }),
      });

      setIncidents((prev) => [newIncident, ...prev]);
      setTitle("");
      setDescription("");
      setPhotos([]);
      resetClientId();
      setIsModalOpen(false);

      setSuccessMessage(
        newIncident.createdOffline || newIncident.pending
          ? "Incident enregistré HORS LIGNE avec succès ! Il sera synchronisé dès le retour du réseau."
          : "Incident signalé et transmis au syndic avec succès !"
      );
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors du signalement";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
      submitLock.current = false;
    }
  };

  // Progression de statut stricte : REPORTED -> ASSIGNED -> IN_PROGRESS -> RESOLVED
  const handleAdvanceStatus = async (incidentId: string, nextStatus: IncidentStatus) => {
    setIsActionLoading(incidentId);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/incidents/${incidentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors du changement de statut");
      }
      setIncidents((prev) =>
        prev.map((inc) => (inc._id === incidentId ? { ...inc, ...data } : inc))
      );
      setSuccessMessage(`Statut de l'incident passé à : ${STATUS_LABELS[nextStatus] || nextStatus}`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Erreur lors du changement de statut");
    } finally {
      setIsActionLoading(null);
    }
  };

  // Assignation d'un technicien par ADMIN / SYNDIC
  const handleAssignTechnician = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningIncident || !selectedTechId) return;

    setIsActionLoading(assigningIncident._id);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/incidents/${assigningIncident._id}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTo: selectedTechId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de l'assignation");
      }
      setIncidents((prev) =>
        prev.map((inc) => (inc._id === assigningIncident._id ? { ...inc, ...data } : inc))
      );
      setAssigningIncident(null);
      setSelectedTechId("");
      setSuccessMessage("Technicien assigné avec succès ! Statut passé à ASSIGNED.");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Erreur lors de l'assignation");
    } finally {
      setIsActionLoading(null);
    }
  };

  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      const matchStatus =
        statusFilter === "ALL" || inc.status === statusFilter;
      const matchCat =
        categoryFilter === "ALL" || inc.category === categoryFilter;
      const matchSearch =
        !search ||
        inc.title?.toLowerCase().includes(search.toLowerCase()) ||
        inc.description?.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchCat && matchSearch;
    });
  }, [incidents, statusFilter, categoryFilter, search]);

  const canAssign =
    currentUser?.role === Role.ADMIN || currentUser?.role === Role.SYNDIC;

  const isFilterActive = statusFilter !== "ALL" || categoryFilter !== "ALL" || search.trim() !== "";

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* En-tête */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
              Incidents & Pannes
            </h1>
            <p className="text-xs text-slate-500 sm:text-sm dark:text-slate-400">
              Déclarez et suivez la résolution des pannes même sans connexion internet
            </p>
          </div>
          <Button
            size="md"
            onClick={() => setIsModalOpen(true)}
            className="self-start sm:self-auto gap-2 min-h-[44px]"
          >
            <PlusCircle className="h-4 w-4" />
            Nouveau signalement
          </Button>
        </div>

        {/* Message de succès */}
        {successMessage && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3.5 text-sm font-semibold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Message d'erreur */}
        {errorMessage && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 p-3.5 text-sm font-semibold text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Filtres et recherche */}
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un incident (ex: fuite, ascenseur)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-base sm:text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base sm:text-sm font-medium text-slate-700 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="ALL">Tous les statuts</option>
              <option value="REPORTED">Signalé</option>
              <option value="ASSIGNED">Assigné</option>
              <option value="IN_PROGRESS">En cours</option>
              <option value="RESOLVED">Résolu</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base sm:text-sm font-medium text-slate-700 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="ALL">Toutes catégories</option>
              <option value="PLUMBING">Plomberie</option>
              <option value="ELECTRICITY">Électricité</option>
              <option value="ELEVATOR">Ascenseur</option>
              <option value="CLEANING">Nettoyage</option>
              <option value="SECURITY">Sécurité</option>
              <option value="OTHER">Autre</option>
            </select>
          </div>
        </div>

        {/* LISTE DES INCIDENTS */}
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : filteredIncidents.length === 0 ? (
          <EmptyState
            icon={<AlertTriangle className="h-6 w-6" />}
            title="Aucun incident à afficher"
            description={
              isFilterActive
                ? "Aucune panne ou anomalie ne correspond à votre filtre actuel."
                : currentUser?.role === Role.RESIDENT
                ? "Vous n'avez signalé aucun incident pour le moment."
                : "Aucun incident enregistré."
            }
            action={
              <Button onClick={() => setIsModalOpen(true)} className="min-h-[44px]">
                Signaler une anomalie
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {filteredIncidents.map((inc) => {
              const assignedToObj = inc.assignedTo as any;
              const assignedToId =
                typeof inc.assignedTo === "object" ? assignedToObj?._id : inc.assignedTo;
              const isAssignedTech =
                currentUser?.role === Role.TECHNICIAN &&
                Boolean(assignedToId) &&
                assignedToId === currentUser.id;

              const canAdvanceInProgress =
                inc.status === IncidentStatus.ASSIGNED &&
                (isAssignedTech || canAssign);

              const canAdvanceResolved =
                inc.status === IncidentStatus.IN_PROGRESS &&
                (isAssignedTech || canAssign);

              const priorityBorderClass = PRIORITY_BORDER_CLASSES[inc.priority] || "border-l-slate-300 dark:border-l-slate-700";

              const idShort = inc._id ? inc._id.slice(-6).toUpperCase() : "";
              const fullDateStr = formatFullDate(inc.reportedAt);
              const relativeTimeStr = formatRelativeTime(inc.reportedAt);

              const resName = getProp(inc.residence, "name");
              const resCity = getProp(inc.residence, "city");
              const residenceLabel = [resName, resCity].filter(Boolean).join(", ") || "—";

              const aptNumber = getProp(inc.apartment, "number");
              const aptFloor = getProp(inc.apartment, "floor");
              let aptLabel = "—";
              if (aptNumber) {
                aptLabel = `Lot ${aptNumber}${aptFloor !== undefined && aptFloor !== null && aptFloor !== "" ? ` (Étage ${aptFloor})` : ""}`;
              }

              const reporterId = typeof inc.reportedBy === "object" ? (inc.reportedBy as any)?._id : inc.reportedBy;
              const isCurrentUserReporter = currentUser?.id && reporterId === currentUser.id;
              const reporterName = isCurrentUserReporter ? "Vous" : getProp(inc.reportedBy, "name") || "—";

              const categoryLabel = CATEGORY_LABELS[inc.category] || inc.category;
              const isExpanded = !!expandedDescriptions[inc._id];
              const desc = inc.description || "";

              const techName = typeof inc.assignedTo === "object" ? (assignedToObj?.name || assignedToObj?.email) : (inc.assignedTo ? "Technicien" : null);
              const techPhone = typeof inc.assignedTo === "object" ? assignedToObj?.phone : null;

              const stepIdx = WORKFLOW_STEPS.findIndex((s) => s.key === inc.status);
              const currentStepIndex = stepIdx >= 0 ? stepIdx : 0;

              return (
                <Card
                  key={inc._id}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest("button, a, input, select, textarea")) return;
                    setSelectedIncident(inc);
                  }}
                  className={`flex flex-col justify-between space-y-3 border-l-4 cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 ${priorityBorderClass}`}
                >
                  <div className="space-y-3">
                    {/* En-tête : Titre + Badge de priorité */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {inc.title}
                          </span>
                          {(inc.pending || inc.createdOffline) && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                              <Clock className="h-3 w-3" />
                              En attente de synchro
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {idShort && <span className="font-mono font-semibold">#{idShort}</span>}
                          {idShort && " • "}
                          {fullDateStr}
                          {relativeTimeStr && ` (${relativeTimeStr})`}
                        </p>
                      </div>
                      <Badge priority={inc.priority} />
                    </div>

                    {/* Grille d'infos (2 colonnes dès sm:) */}
                    <div className="grid grid-cols-1 gap-2 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600 sm:grid-cols-2 dark:bg-slate-900/60 dark:text-slate-300">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400">Résidence</span>
                        <p className="truncate font-medium text-slate-800 dark:text-slate-200">{residenceLabel}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400">Lot</span>
                        <p className="truncate font-medium text-slate-800 dark:text-slate-200">{aptLabel}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400">Signalé par</span>
                        <p className="truncate font-medium text-slate-800 dark:text-slate-200">
                          {reporterName}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400">Catégorie</span>
                        <p className="font-medium text-slate-800 dark:text-slate-200">
                          <span className="inline-block rounded-md bg-sky-100 px-1.5 py-0.5 text-[11px] font-semibold text-sky-800 dark:bg-sky-900/50 dark:text-sky-300">
                            {categoryLabel}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Description limitée à 3 lignes avec voir plus/moins */}
                    <div>
                      <p
                        className={`text-xs leading-relaxed text-slate-600 dark:text-slate-300 ${
                          !isExpanded ? "line-clamp-3" : ""
                        }`}
                      >
                        {desc}
                      </p>
                      {desc.length > 120 && (
                        <button
                          type="button"
                          onClick={() => toggleExpandDescription(inc._id)}
                          className="mt-1 text-[11px] font-semibold text-sky-600 hover:underline dark:text-sky-400"
                        >
                          {isExpanded ? "Voir moins" : "Voir plus"}
                        </button>
                      )}
                    </div>

                    {/* Photos avec miniatures et compteur */}
                    {inc.photos && inc.photos.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium text-slate-500">
                            {inc.photos.length} photo{inc.photos.length > 1 ? "s" : ""} :
                          </span>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {inc.photos.map((photoUrl, idx) => (
                            <div
                              key={idx}
                              className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={photoUrl}
                                alt={`Photo incident ${idx + 1}`}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Technicien assigné */}
                    <div className="text-xs">
                      {techName ? (
                        <div className="flex flex-wrap items-center gap-1.5 text-slate-600 dark:text-slate-300">
                          <UserCheck className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                          <span>
                            Technicien : <strong>{techName}</strong>
                          </span>
                          {techPhone && (
                            <a
                              href={`tel:${techPhone}`}
                              className="inline-flex items-center gap-1 text-sky-600 font-semibold underline hover:text-sky-700 dark:text-sky-400"
                            >
                              ({techPhone})
                            </a>
                          )}
                        </div>
                      ) : canAssign ? (
                        <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span>Non assigné</span>
                        </div>
                      ) : null}
                    </div>

                    {/* Mini barre de progression en 4 étapes */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                        {WORKFLOW_STEPS.map((step, idx) => {
                          const isPassed = idx <= currentStepIndex;
                          const isCurrent = idx === currentStepIndex;
                          return (
                            <span
                              key={step.key}
                              className={
                                isCurrent
                                  ? "text-sky-600 dark:text-sky-400 font-bold"
                                  : isPassed
                                  ? "text-slate-700 dark:text-slate-300"
                                  : "text-slate-400 dark:text-slate-600"
                              }
                            >
                              {step.label}
                            </span>
                          );
                        })}
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {WORKFLOW_STEPS.map((step, idx) => {
                          const isPassed = idx <= currentStepIndex;
                          const isCurrent = idx === currentStepIndex;
                          let barColor = "bg-slate-200 dark:bg-slate-800";
                          if (isCurrent) {
                            barColor =
                              inc.status === IncidentStatus.RESOLVED
                                ? "bg-emerald-500"
                                : "bg-sky-600 ring-2 ring-sky-300 dark:ring-sky-900";
                          } else if (isPassed) {
                            barColor = "bg-sky-500";
                          }
                          return (
                            <div
                              key={step.key}
                              className={`h-1.5 rounded-full transition-all ${barColor}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Statut du workflow */}
                  <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Statut :</span>
                      <Badge incidentStatus={inc.status} />
                    </div>

                    {/* Actions de workflow strict */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {inc.status === IncidentStatus.REPORTED && canAssign && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="w-full text-xs min-h-[44px] gap-1"
                          onClick={() => {
                            setAssigningIncident(inc);
                            setSelectedTechId(
                              technicians.length > 0 ? technicians[0]._id : ""
                            );
                          }}
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          Assigner un technicien
                        </Button>
                      )}

                      {canAdvanceInProgress && (
                        <Button
                          size="sm"
                          variant="primary"
                          className="w-full text-xs min-h-[44px] gap-1 bg-indigo-600 hover:bg-indigo-700"
                          isLoading={isActionLoading === inc._id}
                          onClick={() =>
                            handleAdvanceStatus(inc._id, IncidentStatus.IN_PROGRESS)
                          }
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                          Prendre en charge (En cours)
                        </Button>
                      )}

                      {canAdvanceResolved && (
                        <Button
                          size="sm"
                          variant="primary"
                          className="w-full text-xs min-h-[44px] gap-1 bg-emerald-600 hover:bg-emerald-700"
                          isLoading={isActionLoading === inc._id}
                          onClick={() =>
                            handleAdvanceStatus(inc._id, IncidentStatus.RESOLVED)
                          }
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Marquer comme résolu
                        </Button>
                      )}

                      {inc.status === IncidentStatus.RESOLVED && inc.resolvedAt && (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          Résolu le {formatFullDate(inc.resolvedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Modal d'assignation de technicien */}
        <BottomSheet
          isOpen={!!assigningIncident}
          onClose={() => setAssigningIncident(null)}
          title="Assigner un technicien"
          description="Sélectionnez le technicien pour intervenir sur cet incident. Le statut passera à ASSIGNÉ."
        >
          <form onSubmit={handleAssignTechnician} className="space-y-4 pt-2">
            {technicians.length === 0 ? (
              <p className="text-sm text-slate-500">
                Aucun compte avec le rôle TECHNICIEN trouvé. Veuillez d&apos;abord en créer un dans la gestion des utilisateurs.
              </p>
            ) : (
              <Select
                label="Technicien qualifié"
                value={selectedTechId}
                onChange={(e) => setSelectedTechId(e.target.value)}
                required
              >
                {technicians.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name || t.email} ({t.email})
                  </option>
                ))}
              </Select>
            )}

            <div className="pt-2">
              <Button
                type="submit"
                size="lg"
                disabled={technicians.length === 0}
                isLoading={isActionLoading === assigningIncident?._id}
                className="w-full min-h-[44px]"
              >
                Confirmer l&apos;assignation (Statut ASSIGNED)
              </Button>
            </div>
          </form>
        </BottomSheet>

        {/* BOTTOM SHEET : FORMULAIRE NOUVEL INCIDENT (OFFLINE READY) */}
        <BottomSheet
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Signaler un incident"
          description="Enregistrez une anomalie même sans connexion, avec photo jointe (max 1 Mo)."
        >
          <form onSubmit={handleCreateIncident} className="space-y-4 pt-2">
            {errorMessage && (
              <div className="rounded-xl bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
                {errorMessage}
              </div>
            )}

            {residences.length > 1 && (
              <Select
                label="Résidence concernée"
                value={residenceId}
                onChange={(e) => setResidenceId(e.target.value)}
                required
              >
                {residences.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.name} ({r.city})
                  </option>
                ))}
              </Select>
            )}

            <Input
              label="Titre de l'incident"
              placeholder="Ex: Fuite d'eau au 2ème étage, panne ascenseur..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Catégorie"
                value={category}
                onChange={(e) => setCategory(e.target.value as IncidentCategory)}
              >
                <option value={IncidentCategory.PLUMBING}>Plomberie</option>
                <option value={IncidentCategory.ELECTRICITY}>Électricité</option>
                <option value={IncidentCategory.ELEVATOR}>Ascenseur</option>
                <option value={IncidentCategory.CLEANING}>Nettoyage</option>
                <option value={IncidentCategory.SECURITY}>Sécurité</option>
                <option value={IncidentCategory.OTHER}>Autre</option>
              </Select>

              <Select
                label="Priorité"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                <option value={Priority.LOW}>Basse</option>
                <option value={Priority.MEDIUM}>Moyenne</option>
                <option value={Priority.HIGH}>Haute</option>
                <option value={Priority.URGENT}>Urgente</option>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold tracking-wide text-slate-700 dark:text-slate-300">
                Description détaillée
              </label>
              <textarea
                rows={3}
                placeholder="Indiquez l'emplacement précis et l'ampleur du problème..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                required
              />
            </div>

            {/* Ajout de photo (Appareil photo mobile ou fichier, max 1 Mo) */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Photo du problème (compression canvas &le; 1 Mo, hors ligne)
              </label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={fileInputRef}
                onChange={handlePhotoUpload}
                className="hidden"
              />

              <div className="flex flex-wrap items-center gap-2">
                {photos.map((photo, i) => (
                  <div
                    key={i}
                    className="relative h-20 w-20 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo}
                      alt="Capture"
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setPhotos((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="absolute top-1 right-1 rounded-full bg-slate-900/80 p-1 text-white hover:bg-rose-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
                      aria-label="Supprimer la photo"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                {photos.length < 3 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 min-h-[44px]"
                  >
                    <Camera className="h-5 w-5 text-sky-500" />
                    <span>Ajouter</span>
                  </button>
                )}
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                size="lg"
                isLoading={isSubmitting}
                className="w-full min-h-[44px]"
              >
                Envoyer le signalement (Offline supporté)
              </Button>
            </div>
          </form>
        </BottomSheet>

        {/* MODALE DÉTAIL DE L'INCIDENT (Bottom sheet sur mobile, modale centrée dès md:) */}
        {selectedIncident && (() => {
          const inc = selectedIncident;
          const assignedToObj = inc.assignedTo as any;
          const assignedToId =
            typeof inc.assignedTo === "object" ? assignedToObj?._id : inc.assignedTo;
          const isAssignedTech =
            currentUser?.role === Role.TECHNICIAN &&
            Boolean(assignedToId) &&
            assignedToId === currentUser.id;

          const canAdvanceInProgress =
            inc.status === IncidentStatus.ASSIGNED && (isAssignedTech || canAssign);
          const canAdvanceResolved =
            inc.status === IncidentStatus.IN_PROGRESS && (isAssignedTech || canAssign);

          const idShort = inc._id ? inc._id.slice(-6).toUpperCase() : "";
          const resName = getProp(inc.residence, "name");
          const resCity = getProp(inc.residence, "city");
          const residenceLabel = [resName, resCity].filter(Boolean).join(", ") || "—";

          const aptNumber = getProp(inc.apartment, "number");
          const aptFloor = getProp(inc.apartment, "floor");
          let aptLabel = "—";
          if (aptNumber) {
            aptLabel = `Lot ${aptNumber}${aptFloor !== undefined && aptFloor !== null && aptFloor !== "" ? ` (Étage ${aptFloor})` : ""}`;
          }

          const reporterName = getProp(inc.reportedBy, "name") || "—";
          const reporterEmail = getProp(inc.reportedBy, "email");

          const techName = typeof inc.assignedTo === "object" ? (assignedToObj?.name || assignedToObj?.email) : (inc.assignedTo ? "Technicien" : null);
          const techEmail = typeof inc.assignedTo === "object" ? assignedToObj?.email : null;
          const techPhone = typeof inc.assignedTo === "object" ? assignedToObj?.phone : null;

          const categoryLabel = CATEGORY_LABELS[inc.category] || inc.category;

          return (
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm transition-opacity md:items-center p-0 md:p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) setSelectedIncident(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setSelectedIncident(null);
              }}
              tabIndex={-1}
            >
              <div
                role="dialog"
                aria-modal="true"
                className="flex max-h-[90vh] w-full flex-col rounded-t-3xl md:rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all md:max-w-2xl dark:border-slate-800 dark:bg-slate-900"
              >
                {/* Header */}
                <div className="flex items-start justify-between border-b border-slate-100 p-4 sm:p-5 dark:border-slate-800">
                  <div className="space-y-1 pr-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900 sm:text-xl dark:text-white">
                        {inc.title}
                      </h2>
                      {(inc.pending || inc.createdOffline) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                          <Clock className="h-3 w-3" />
                          En attente de synchro
                        </span>
                      )}
                    </div>
                    {idShort && (
                      <p className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400">
                        Incident #{idShort}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedIncident(null)}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 active:scale-95 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    aria-label="Fermer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5 sm:px-5 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                  <Badge priority={inc.priority} />
                  <Badge incidentStatus={inc.status} />
                  <span className="inline-block rounded-md bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-900/50 dark:text-sky-300">
                    {categoryLabel}
                  </span>
                </div>

                {/* Contenu déroulant */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                  {/* Description complète */}
                  <div className="space-y-1.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Description complète
                    </h3>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                      {inc.description || "Aucune description fournie."}
                    </p>
                  </div>

                  {/* Informations de localisation et signalement */}
                  <div className="grid grid-cols-1 gap-3 rounded-2xl bg-slate-50 p-3 sm:grid-cols-2 dark:bg-slate-800/40 text-xs">
                    <div>
                      <span className="font-semibold text-slate-400">Résidence :</span>{" "}
                      <strong className="text-slate-800 dark:text-slate-200">{residenceLabel}</strong>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-400">Lot / Appartement :</span>{" "}
                      <strong className="text-slate-800 dark:text-slate-200">{aptLabel}</strong>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-400">Signalé par :</span>{" "}
                      <strong className="text-slate-800 dark:text-slate-200">{reporterName}</strong>
                      {reporterEmail && (
                        <span className="block text-[11px] text-slate-500">
                          {reporterEmail}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-400">Signalé le :</span>{" "}
                      <strong className="text-slate-800 dark:text-slate-200">
                        {formatFullDate(inc.reportedAt)}
                      </strong>
                    </div>
                    {inc.resolvedAt && (
                      <div className="sm:col-span-2">
                        <span className="font-semibold text-slate-400">Résolu le :</span>{" "}
                        <strong className="text-emerald-600 dark:text-emerald-400">
                          {formatFullDate(inc.resolvedAt)}
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* Technicien assigné */}
                  <div className="space-y-1.5 rounded-2xl border border-slate-100 p-3 dark:border-slate-800">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Technicien assigné
                    </h3>
                    {techName ? (
                      <div className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                        <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <UserCheck className="h-4 w-4 text-sky-500" />
                          {techName}
                        </p>
                        <div className="flex flex-wrap gap-3 pt-1">
                          {techEmail && (
                            <a
                              href={`mailto:${techEmail}`}
                              className="text-sky-600 underline hover:text-sky-700 dark:text-sky-400"
                            >
                              {techEmail}
                            </a>
                          )}
                          {techPhone && (
                            <a
                              href={`tel:${techPhone}`}
                              className="text-sky-600 font-semibold underline hover:text-sky-700 dark:text-sky-400"
                            >
                              Tél : {techPhone}
                            </a>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        Aucun technicien assigné pour le moment.
                      </p>
                    )}
                  </div>

                  {/* Photos en grand format */}
                  {inc.photos && inc.photos.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Photos jointes ({inc.photos.length})
                      </h3>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {inc.photos.map((photoUrl, idx) => (
                          <div
                            key={idx}
                            onClick={() => setFullscreenPhoto(photoUrl)}
                            className="group relative aspect-video cursor-pointer overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photoUrl}
                              alt={`Photo ${idx + 1}`}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium">
                              Agrandir
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Historique en liste verticale */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Historique du traitement
                    </h3>
                    <div className="space-y-2 border-l-2 border-slate-200 pl-3 dark:border-slate-800 text-xs">
                      {inc.reportedAt && (
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-200">
                            Signalé le {formatFullDate(inc.reportedAt)}
                          </p>
                          <p className="text-[11px] text-slate-500">Par {reporterName}</p>
                        </div>
                      )}
                      {techName && (
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-200">
                            Assigné à {techName}
                          </p>
                        </div>
                      )}
                      {inc.resolvedAt && (
                        <div>
                          <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                            Résolu le {formatFullDate(inc.resolvedAt)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer avec boutons d'actions */}
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 p-4 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                  {inc.status === IncidentStatus.REPORTED && canAssign && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="min-h-[44px] gap-1"
                      onClick={() => {
                        setAssigningIncident(inc);
                        setSelectedTechId(technicians.length > 0 ? technicians[0]._id : "");
                      }}
                    >
                      <UserCheck className="h-4 w-4" />
                      Assigner un technicien
                    </Button>
                  )}

                  {canAdvanceInProgress && (
                    <Button
                      size="sm"
                      variant="primary"
                      className="min-h-[44px] gap-1 bg-indigo-600 hover:bg-indigo-700"
                      isLoading={isActionLoading === inc._id}
                      onClick={async () => {
                        await handleAdvanceStatus(inc._id, IncidentStatus.IN_PROGRESS);
                        setSelectedIncident((prev) =>
                          prev && prev._id === inc._id ? { ...prev, status: IncidentStatus.IN_PROGRESS } : prev
                        );
                      }}
                    >
                      <ArrowRight className="h-4 w-4" />
                      Prendre en charge (En cours)
                    </Button>
                  )}

                  {canAdvanceResolved && (
                    <Button
                      size="sm"
                      variant="primary"
                      className="min-h-[44px] gap-1 bg-emerald-600 hover:bg-emerald-700"
                      isLoading={isActionLoading === inc._id}
                      onClick={async () => {
                        await handleAdvanceStatus(inc._id, IncidentStatus.RESOLVED);
                        setSelectedIncident((prev) =>
                          prev && prev._id === inc._id
                            ? { ...prev, status: IncidentStatus.RESOLVED, resolvedAt: new Date().toISOString() }
                            : prev
                        );
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Marquer comme résolu
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-[44px]"
                    onClick={() => setSelectedIncident(null)}
                  >
                    Fermer
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Visionneuse photo plein écran */}
        {fullscreenPhoto && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
            onClick={() => setFullscreenPhoto(null)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setFullscreenPhoto(null);
            }}
            tabIndex={-1}
          >
            <button
              type="button"
              onClick={() => setFullscreenPhoto(null)}
              className="absolute top-4 right-4 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
              aria-label="Fermer l'image"
            >
              <X className="h-6 w-6" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fullscreenPhoto}
              alt="Photo plein écran"
              className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function IncidentsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
        </div>
      }
    >
      <IncidentsContent />
    </Suspense>
  );
}

