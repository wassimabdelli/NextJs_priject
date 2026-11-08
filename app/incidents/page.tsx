"use client";

import { useCallback, useEffect, useState, useMemo, useRef, Suspense } from "react";
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
  ClipboardList,
  History,
  MessageCircle,
  Wrench,
  Sparkles,
  Droplets,
  Zap,
  Shield,
  Building2,
  ChevronDown,
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
import { IncidentHistory } from "@/components/incidents/IncidentHistory";
import { IncidentComments } from "@/components/incidents/IncidentComments";
import { IncidentWorkflowTimeline } from "@/components/incidents/IncidentWorkflowTimeline";
import { ResolutionReview } from "@/components/incidents/ResolutionReview";
import { ResolutionSubmissionForm } from "@/components/incidents/ResolutionSubmissionForm";
import { IncidentDashboard } from "@/components/incidents/dashboard/IncidentDashboard";
import { AIReportPanel } from "@/components/ai/AIReportPanel";
import AiTriagePanel, { type AiTriageSuggestion } from "@/components/ai/AiTriagePanel";
import { IncidentFormAssist } from "@/components/ai/IncidentFormAssist";
import type { PossibleDuplicate } from "@/components/ai/AIDuplicateWarning";
import { IncidentAIContext } from "@/components/ai/IncidentAIContext";

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

const CATEGORY_ICON: Record<IncidentCategory, typeof Wrench> = {
  PLUMBING: Droplets,
  ELECTRICITY: Zap,
  ELEVATOR: Building2,
  CLEANING: Sparkles,
  SECURITY: Shield,
  OTHER: Wrench,
};

const WORKFLOW_STEPS: Array<{ key: IncidentStatus; label: string }> = [
  { key: IncidentStatus.REPORTED, label: "Signalé" },
  { key: IncidentStatus.ASSIGNED, label: "Assigné" },
  { key: IncidentStatus.IN_PROGRESS, label: "En cours" },
  { key: IncidentStatus.RESOLVED, label: "Résolu" },
];

function getProp(obj: unknown, key: string): string | number | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const value = (obj as Record<string, unknown>)[key];
  return typeof value === "string" || typeof value === "number" ? value : undefined;
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

function compressedDataUrlToFile(dataUrl: string, fileName: string): File {
  const [metadata, encoded] = dataUrl.split(",");
  const mimeType = metadata.match(/^data:(.*?);base64$/)?.[1] ?? "image/jpeg";
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new File([bytes], fileName, { type: mimeType });
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
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [residenceFilter, setResidenceFilter] = useState<string>("ALL");
  const [technicianFilter, setTechnicianFilter] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalIncidents, setTotalIncidents] = useState(0);
  const pageSize = 20;

  // Modal de création
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<IncidentCategory>(IncidentCategory.PLUMBING);
  const [priority, setPriority] = useState<Priority>(Priority.MEDIUM);
  const [residenceId, setResidenceId] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [aiFiles, setAiFiles] = useState<File[]>([]);
  const [acceptedTriage, setAcceptedTriage] = useState<AiTriageSuggestion | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [strongDuplicateCount, setStrongDuplicateCount] = useState(0);
  const [duplicateDismissed, setDuplicateDismissed] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDuplicateMatchesChange = useCallback((matches: PossibleDuplicate[]) => {
    const strong = matches.filter((match) => match.similarity >= 80).length;
    setStrongDuplicateCount(strong);
    if (strong > 0) setDuplicateDismissed(false);
  }, []);

  // Modal d'assignation
  const [assigningIncident, setAssigningIncident] = useState<IncidentDTO | null>(null);
  const [selectedTechId, setSelectedTechId] = useState<string>("");
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);

  // Modal de détail d'incident & zoom photo
  const [selectedIncident, setSelectedIncident] = useState<IncidentDTO | null>(null);
  const [selectedIncidentTab, setSelectedIncidentTab] = useState<
    "overview" | "history" | "discussion" | "resolution" | "ai"
  >("overview");
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);

  // État local pour le déploiement des descriptions longues
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});
  const [collapsedIncidentGroups, setCollapsedIncidentGroups] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const submitLock = useRef(false);
  const clientIdRef = useRef<string | null>(null);

  const getClientId = () => {
    if (!clientIdRef.current) {
      clientIdRef.current =
        typeof globalThis.crypto?.randomUUID === "function"
          ? globalThis.crypto.randomUUID()
          : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
              const random = Math.floor(Math.random() * 16);
              const value = character === "x" ? random : (random & 0x3) | 0x8;
              return value.toString(16);
            });
    }
    return clientIdRef.current;
  };

  const resetClientId = () => {
    clientIdRef.current = null;
  };

  const openCreateModal = useCallback(() => {
    setStrongDuplicateCount(0);
    setDuplicateDismissed(false);
    setIsModalOpen(true);
  }, []);

  const toggleExpandDescription = (id: string) => {
    setExpandedDescriptions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      if (search.trim()) params.set("q", search.trim());
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (categoryFilter !== "ALL") params.set("category", categoryFilter);
      if (priorityFilter !== "ALL") params.set("priority", priorityFilter);
      if (residenceFilter !== "ALL") params.set("residence", residenceFilter);
      if (technicianFilter !== "ALL") params.set("assignedTo", technicianFilter);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const sortValues: Record<string, string> = {
        newest: "reportedAt:desc",
        oldest: "reportedAt:asc",
        priority: "priority:desc",
        status: "status:asc",
      };
      params.set("sort", sortValues[sortOrder] || sortValues.newest);
      const incRes = await fetchWithOffline<
        IncidentDTO[] | { data?: IncidentDTO[]; meta?: { total?: number } }
      >(`/api/incidents?${params}`);
      const incList = Array.isArray(incRes) ? incRes : incRes?.data || [];
      setIncidents(incList);
      setTotalIncidents(Array.isArray(incRes) ? incList.length : incRes.meta?.total || 0);
      const requestedIncidentId = searchParams.get("incident");
      if (requestedIncidentId) {
        let requestedIncident = incList.find((incident) => incident._id === requestedIncidentId);
        if (!requestedIncident) {
          const response = await fetchWithOffline<
            IncidentDTO | { data?: IncidentDTO | IncidentDTO[] }
          >(
            `/api/incidents/${encodeURIComponent(requestedIncidentId)}`
          );
          if (response && "_id" in response) {
            requestedIncident = response;
          } else if (response?.data && !Array.isArray(response.data)) {
            requestedIncident = response.data;
          }
        }
        if (requestedIncident) {
          setSelectedIncidentTab("overview");
          setSelectedIncident(requestedIncident);
        }
      }

      if (currentUser && currentUser.role !== Role.TECHNICIAN) {
        const resRes = await fetchWithOffline<
          ResidenceDTO[] | { data?: ResidenceDTO[] }
        >("/api/residences");
        const resList = Array.isArray(resRes) ? resRes : resRes?.data || [];
        setResidences(resList);
        if (resList.length > 0) {
          setResidenceId((current) => current || resList[0]._id);
        }
      } else {
        setResidences([]);
      }
    } catch (err) {
      console.error("[Incidents] Erreur chargement :", err);
      setErrorMessage(err instanceof Error ? err.message : "Impossible de charger les réclamations.");
    } finally {
      setLoading(false);
    }
  }, [
    categoryFilter,
    currentUser,
    dateFrom,
    dateTo,
    page,
    priorityFilter,
    residenceFilter,
    search,
    searchParams,
    sortOrder,
    statusFilter,
    technicianFilter,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
      if (searchParams.get("action") === "new" || searchParams.get("new") === "1") {
        openCreateModal();
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData, openCreateModal, searchParams]);

  useEffect(() => {
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
  }, []);

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

        const compressedFileName = `${file.name.replace(/\.[^.]+$/, "") || "incident-photo"}.jpg`;
        setPhotos((prev) => [...prev.slice(0, 2), compressedDataUrl]);
        setAiFiles((prev) => [
          ...prev.slice(0, 2),
          compressedDataUrlToFile(compressedDataUrl, compressedFileName),
        ]);
        setAcceptedTriage(null);
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
      const trimmedDescription = description.trim();
      const firstSentence = trimmedDescription.split(/[.!?\r\n]/, 1)[0].trim();
      const submittedTitle =
        title.trim() ||
        (firstSentence.length >= 3
          ? firstSentence.slice(0, 180)
          : trimmedDescription.slice(0, 180));
      const newIncident = await fetchWithOffline<IncidentDTO>("/api/incidents", {
        method: "POST",
        entity: "incident",
        body: JSON.stringify({
          residence: residenceId,
          title: submittedTitle,
          description: trimmedDescription,
          category,
          ...(residentWithoutPhoto ? {} : { priority }),
          photos,
          ...(acceptedTriage ? { aiTriage: acceptedTriage } : {}),
          clientId: getClientId(),
        }),
      });

      setIncidents((prev) => [newIncident, ...prev]);
      setTitle("");
      setDescription("");
      setPhotos([]);
      setAiFiles([]);
      setAcceptedTriage(null);
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

  const inspectIncident = async (incidentId: string) => {
    const cached = incidents.find((item) => item._id === incidentId);
    if (cached) {
      setSelectedIncident(cached);
      setSelectedIncidentTab("overview");
      return;
    }
    try {
      const response = await fetch(`/api/incidents/${incidentId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Incident inaccessible.");
      setSelectedIncident(data as IncidentDTO);
      setSelectedIncidentTab("overview");
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : "Impossible d’ouvrir l’incident.");
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
      setSelectedIncident((prev) => prev?._id === incidentId ? { ...prev, ...data } : prev);
      window.dispatchEvent(new Event("syndicpro:dashboard-refresh"));
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
      setSelectedIncident((prev) =>
        prev?._id === assigningIncident._id ? { ...prev, ...data } : prev
      );
      window.dispatchEvent(new Event("syndicpro:dashboard-refresh"));
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

  const filteredIncidents = useMemo(() => incidents, [incidents]);

  const canAssign =
    currentUser?.role === Role.ADMIN || currentUser?.role === Role.SYNDIC;
  const canCreateIncident =
    currentUser?.role === Role.ADMIN ||
    currentUser?.role === Role.SYNDIC ||
    currentUser?.role === Role.RESIDENT;
  const residentWithoutPhoto =
    currentUser?.role === Role.RESIDENT && photos.length === 0;

  const isFilterActive =
    statusFilter !== "ALL" ||
    categoryFilter !== "ALL" ||
    priorityFilter !== "ALL" ||
    residenceFilter !== "ALL" ||
    technicianFilter !== "ALL" ||
    Boolean(dateFrom || dateTo) ||
    search.trim() !== "";

  const clearFilters = () => {
    setPage(1);
    setStatusFilter("ALL");
    setCategoryFilter("ALL");
    setPriorityFilter("ALL");
    setResidenceFilter("ALL");
    setTechnicianFilter("ALL");
    setDateFrom("");
    setDateTo("");
    setSortOrder("newest");
    setSearch("");
  };

  const activeFilterChips = [
    ...(search.trim() ? [{ key: "search", label: `Recherche : ${search.trim()}`, clear: () => setSearch("") }] : []),
    ...(statusFilter !== "ALL" ? [{ key: "status", label: `Statut : ${STATUS_LABELS[statusFilter] ?? statusFilter}`, clear: () => setStatusFilter("ALL") }] : []),
    ...(categoryFilter !== "ALL" ? [{ key: "category", label: `Catégorie : ${CATEGORY_LABELS[categoryFilter] ?? categoryFilter}`, clear: () => setCategoryFilter("ALL") }] : []),
    ...(priorityFilter !== "ALL" ? [{ key: "priority", label: `Priorité : ${priorityFilter}`, clear: () => setPriorityFilter("ALL") }] : []),
    ...(residenceFilter !== "ALL" ? [{ key: "residence", label: `Résidence : ${residences.find((item) => item._id === residenceFilter)?.name ?? "Sélectionnée"}`, clear: () => setResidenceFilter("ALL") }] : []),
    ...(technicianFilter !== "ALL" ? [{ key: "technician", label: `Technicien : ${technicians.find((item) => item._id === technicianFilter)?.name ?? "Sélectionné"}`, clear: () => setTechnicianFilter("ALL") }] : []),
    ...(dateFrom ? [{ key: "dateFrom", label: `Du ${dateFrom}`, clear: () => setDateFrom("") }] : []),
    ...(dateTo ? [{ key: "dateTo", label: `Au ${dateTo}`, clear: () => setDateTo("") }] : []),
  ];
  const groupedIncidentRows = canAssign
    ? [
        {
          key: "unassigned",
          label: "À assigner",
          incidents: filteredIncidents.filter((incident) =>
            incident.status !== IncidentStatus.RESOLVED && !incident.assignedTo
          ),
        },
        {
          key: "in-progress",
          label: "En cours",
          incidents: filteredIncidents.filter((incident) =>
            incident.status !== IncidentStatus.RESOLVED && Boolean(incident.assignedTo)
          ),
        },
        {
          key: "resolved",
          label: "Résolues",
          incidents: filteredIncidents.filter((incident) => incident.status === IncidentStatus.RESOLVED),
        },
      ].flatMap((group) => [
        { kind: "group" as const, key: group.key, label: group.label, count: group.incidents.length },
        ...(!collapsedIncidentGroups[group.key]
          ? group.incidents.map((incident) => ({ kind: "incident" as const, incident }))
          : []),
      ])
    : filteredIncidents.map((incident) => ({ kind: "incident" as const, incident }));

  return (
    <AppLayout>
      <div className="space-y-6">
        <IncidentDashboard />
        {(currentUser?.role === Role.ADMIN || currentUser?.role === Role.SYNDIC) && (
          <AIReportPanel endpoint="/api/ai/reports/incidents" title="Générer le rapport IA des incidents" />
        )}
        {/* En-tête */}
        <div className="flex flex-col gap-4 rounded-3xl bg-gradient-to-r from-sky-600 via-sky-500 to-indigo-500 p-5 text-white shadow-lg shadow-sky-900/10 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950 dark:ring-1 dark:ring-white/10 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Incidents & Pannes
            </h1>
            <p className="mt-1 text-xs text-sky-50 sm:text-sm dark:text-slate-300">
              Déclarez et suivez la résolution des pannes même sans connexion internet
            </p>
          </div>
          {canCreateIncident && (
            <Button
              size="md"
              onClick={openCreateModal}
              className="self-start gap-2 min-h-[44px] bg-white text-sky-800 shadow-sm hover:bg-sky-50 dark:bg-white dark:text-sky-900 dark:hover:bg-sky-100 sm:self-auto"
            >
              <PlusCircle className="h-4 w-4" />
              Nouveau signalement
            </Button>
          )}
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
        <div className="sticky top-16 z-20 space-y-3 rounded-2xl border border-slate-200/90 bg-white/90 p-3 shadow-sm backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/90 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un incident (ex: fuite, ascenseur)..."
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-base sm:text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
            <Filter className="h-4 w-4 text-slate-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value);
              }}
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
              onChange={(e) => {
                setPage(1);
                setCategoryFilter(e.target.value);
              }}
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

            <select
              aria-label="Filtrer par priorité"
              value={priorityFilter}
              onChange={(e) => {
                setPage(1);
                setPriorityFilter(e.target.value);
              }}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base sm:text-sm font-medium text-slate-700 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="ALL">Toutes priorités</option>
              <option value="URGENT">Urgente</option>
              <option value="HIGH">Haute</option>
              <option value="MEDIUM">Moyenne</option>
              <option value="LOW">Basse</option>
            </select>

            {(currentUser?.role === Role.ADMIN || currentUser?.role === Role.SYNDIC) && (
              <>
                <select
                  aria-label="Filtrer par résidence"
                  value={residenceFilter}
                  onChange={(e) => {
                    setPage(1);
                    setResidenceFilter(e.target.value);
                  }}
                  className="min-h-[44px] max-w-56 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base sm:text-sm font-medium text-slate-700 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="ALL">Toutes résidences</option>
                  {residences.map((residence) => <option key={residence._id} value={residence._id}>{residence.name}</option>)}
                </select>
                <select
                  aria-label="Filtrer par technicien"
                  value={technicianFilter}
                  onChange={(e) => {
                    setPage(1);
                    setTechnicianFilter(e.target.value);
                  }}
                  className="min-h-[44px] max-w-56 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base sm:text-sm font-medium text-slate-700 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="ALL">Tous les techniciens</option>
                  {technicians.map((technician) => <option key={technician._id} value={technician._id}>{technician.name}</option>)}
                </select>
              </>
            )}

            <select
              aria-label="Trier les réclamations"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base sm:text-sm font-medium text-slate-700 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="newest">Plus récentes</option>
              <option value="oldest">Plus anciennes</option>
              <option value="priority">Priorité</option>
              <option value="status">Statut</option>
            </select>
          </div>

          </div>

          <div className="flex flex-nowrap items-end gap-2 overflow-x-auto border-t border-slate-100 pt-3 dark:border-slate-800 sm:flex-wrap sm:overflow-visible">
            <label className="flex shrink-0 flex-col gap-1 text-xs font-semibold text-slate-500">
              Du
              <input type="date" value={dateFrom} max={dateTo || new Date().toISOString().slice(0, 10)} onChange={(e) => { setPage(1); setDateFrom(e.target.value); }} className="min-h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" />
            </label>
            <label className="flex shrink-0 flex-col gap-1 text-xs font-semibold text-slate-500">
              Au
              <input type="date" value={dateTo} min={dateFrom || undefined} max={new Date().toISOString().slice(0, 10)} onChange={(e) => { setPage(1); setDateTo(e.target.value); }} className="min-h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" />
            </label>
            {isFilterActive && <Button type="button" size="sm" variant="ghost" className="shrink-0 min-h-[44px]" onClick={clearFilters}>Effacer les filtres</Button>}
          </div>
          {activeFilterChips.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto border-t border-slate-100 pt-3 dark:border-slate-800" aria-label="Filtres actifs">
              {activeFilterChips.map((filter) => (
                <button key={filter.key} type="button" onClick={() => { filter.clear(); setPage(1); }} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-sky-50 px-3 text-xs font-semibold text-sky-800 transition hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:bg-sky-950 dark:text-sky-200 dark:hover:bg-sky-900">
                  {filter.label}<X aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              ))}
              <button type="button" onClick={clearFilters} className="min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold text-slate-600 underline underline-offset-2 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-slate-300 dark:hover:text-white">Effacer les filtres</button>
            </div>
          )}
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
                : currentUser?.role === Role.TECHNICIAN
                ? "Aucune intervention ne vous est assignée pour le moment."
                : "Aucun incident enregistré."
            }
            action={
              canCreateIncident && !isFilterActive ? (
                <Button onClick={openCreateModal} className="min-h-[44px]">
                  Signaler une anomalie
                </Button>
              ) : isFilterActive ? (
                <Button variant="outline" onClick={clearFilters} className="min-h-[44px]">
                  Effacer les filtres
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {groupedIncidentRows.map((row) => {
              if (row.kind === "group") {
                const isCollapsed = Boolean(collapsedIncidentGroups[row.key]);
                return (
                  <button
                    key={`group-${row.key}`}
                    type="button"
                    aria-expanded={!isCollapsed}
                    onClick={() => setCollapsedIncidentGroups((current) => ({ ...current, [row.key]: !current[row.key] }))}
                    className="col-span-full flex min-h-[48px] items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-sky-800"
                  >
                    <span className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                      <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                      {row.label}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {row.count} <span className="font-normal">sur cette page</span>
                    </span>
                  </button>
                );
              }
              const inc = row.incident;
              const assignedToObj =
                typeof inc.assignedTo === "object" && inc.assignedTo ? inc.assignedTo : undefined;
              const assignedToId =
                assignedToObj?._id ?? (typeof inc.assignedTo === "string" ? inc.assignedTo : undefined);
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

              const reporterId =
                typeof inc.reportedBy === "object" && inc.reportedBy
                  ? inc.reportedBy._id
                  : inc.reportedBy;
              const isCurrentUserReporter = currentUser?.id && reporterId === currentUser.id;
              const reporterName = isCurrentUserReporter ? "Vous" : getProp(inc.reportedBy, "name") || "—";

              const categoryLabel = CATEGORY_LABELS[inc.category] || inc.category;
              const CategoryIcon = CATEGORY_ICON[inc.category] ?? Wrench;
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
                    setSelectedIncidentTab("overview");
                    setSelectedIncident(inc);
                  }}
                  className={`flex flex-col justify-between space-y-3 border-l-4 cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 ${priorityBorderClass}`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
                        <CategoryIcon aria-hidden="true" className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="line-clamp-2 font-bold text-slate-900 dark:text-white">
                            {inc.title}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {idShort && <span className="font-mono font-semibold">#{idShort}</span>}
                          {idShort && " · "}
                          <span title={fullDateStr}>{relativeTimeStr || fullDateStr}</span>
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge priority={inc.priority} />
                        {inc.pending || inc.createdOffline ? (
                          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-200">Hors ligne</span>
                        ) : null}
                      </div>
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
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
                          <span className="inline-flex items-center gap-2 text-xs font-semibold">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            Non assigné · à prendre en charge
                          </span>
                          {inc.status === IncidentStatus.REPORTED && (
                            <Button
                              type="button"
                              size="sm"
                              className="min-h-[44px] bg-amber-600 px-3 text-xs text-white hover:bg-amber-700"
                              onClick={() => {
                                setAssigningIncident(inc);
                                setSelectedTechId(technicians.length > 0 ? technicians[0]._id : "");
                              }}
                            >
                              <UserCheck aria-hidden="true" className="h-4 w-4" />
                              Assigner un technicien
                            </Button>
                          )}
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-2 pt-1">
                      <div className="grid grid-cols-4 gap-1">
                        {WORKFLOW_STEPS.map((step, idx) => {
                          const isPassed = idx <= currentStepIndex;
                          const isCurrent = idx === currentStepIndex;
                          return (
                            <div key={step.key} className="relative flex flex-col items-center gap-1.5 text-center">
                              {idx < WORKFLOW_STEPS.length - 1 && (
                                <span aria-hidden="true" className={`absolute left-1/2 top-[7px] h-0.5 w-full ${idx < currentStepIndex ? "bg-sky-500" : "bg-slate-200 dark:bg-slate-700"}`} />
                              )}
                              <span className={`relative z-10 h-4 w-4 rounded-full border-2 ${isCurrent ? (inc.status === IncidentStatus.RESOLVED ? "border-emerald-500 bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-950" : "border-sky-600 bg-sky-600 ring-2 ring-sky-200 dark:ring-sky-950") : isPassed ? "border-sky-500 bg-sky-500" : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"}`} />
                              <span className={`text-[9px] font-semibold leading-tight sm:text-[10px] ${isCurrent ? "text-sky-700 dark:text-sky-300" : "text-slate-500 dark:text-slate-400"}`}>{step.label}</span>
                            </div>
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

        {!loading && totalIncidents > pageSize && (
          <nav
            aria-label="Pagination des réclamations"
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Page {page} sur {Math.max(1, Math.ceil(totalIncidents / pageSize))} · {totalIncidents} réclamation(s)
            </p>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                Précédent
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={page >= Math.ceil(totalIncidents / pageSize)} onClick={() => setPage((value) => value + 1)}>
                Suivant
              </Button>
            </div>
          </nav>
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
        {canCreateIncident && (
          <BottomSheet
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title="Signaler un incident"
            description="Enregistrez une anomalie même hors ligne, avec jusqu'à 3 photos (1 Mo chacune)."
          >
          <form onSubmit={handleCreateIncident} className="space-y-5 pt-2">
            {errorMessage && (
              <div className="rounded-xl bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
                {errorMessage}
              </div>
            )}

            <section className="space-y-3">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Où ?</h3>
              {residences.length > 1 ? (
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
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {residences[0]
                    ? [residences[0].name, residences[0].city].filter(Boolean).join(" · ")
                    : "Aucune résidence disponible"}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Quoi ?</h3>
              <Input
                label="Titre de l'incident"
                placeholder="Facultatif — généré depuis la photo ou la description"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setAcceptedTriage(null);
                }}
              />

              <div className={`grid gap-3 ${residentWithoutPhoto ? "grid-cols-1" : "grid-cols-2"}`}>
                <Select
                  label="Type de problème"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value as IncidentCategory);
                    setAcceptedTriage(null);
                  }}
                >
                  <option value={IncidentCategory.PLUMBING}>Plomberie</option>
                  <option value={IncidentCategory.ELECTRICITY}>Électricité</option>
                  <option value={IncidentCategory.ELEVATOR}>Ascenseur</option>
                  <option value={IncidentCategory.CLEANING}>Nettoyage</option>
                  <option value={IncidentCategory.SECURITY}>Sécurité</option>
                  <option value={IncidentCategory.OTHER}>Autre</option>
                </Select>

                {!residentWithoutPhoto && (
                  <Select
                    label="Priorité"
                    value={priority}
                    onChange={(e) => {
                      setPriority(e.target.value as Priority);
                      setAcceptedTriage(null);
                    }}
                  >
                    <option value={Priority.LOW}>Basse</option>
                    <option value={Priority.MEDIUM}>Moyenne</option>
                    <option value={Priority.HIGH}>Haute</option>
                    <option value={Priority.URGENT}>Urgente</option>
                  </Select>
                )}
              </div>

              {residentWithoutPhoto && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Sans photo, vous n&apos;avez pas à choisir la priorité. Elle sera provisoirement enregistrée comme moyenne et pourra être réévaluée par le syndic.
                </p>
              )}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="incident-description" className="text-xs font-semibold tracking-wide text-slate-700 dark:text-slate-300">
                  Description détaillée
                </label>
                <textarea
                  id="incident-description"
                  rows={3}
                  placeholder="Indiquez l'emplacement précis et l'ampleur du problème..."
                  minLength={5}
                  maxLength={2000}
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setAcceptedTriage(null);
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  required
                />
              </div>

              {photos.length > 0 && (
                <AiTriagePanel
                  title={title}
                  description={description}
                  files={aiFiles}
                  onApply={(suggestion) => {
                    setTitle(suggestion.title);
                    setDescription(suggestion.description);
                    setCategory(suggestion.category as IncidentCategory);
                    setPriority(suggestion.priority as Priority);
                  }}
                  onSuggestionAccepted={setAcceptedTriage}
                />
              )}

              <IncidentFormAssist
                title={title}
                description={description}
                residenceId={residenceId}
                onMatchesChange={handleDuplicateMatchesChange}
                extraActions={(item) => (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <a
                      href={`/incidents?incident=${encodeURIComponent(item.incidentId)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-[40px] items-center rounded-lg border border-slate-300 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Ouvrir le dossier
                    </a>
                    <button
                      type="button"
                      onClick={() => setDuplicateDismissed(true)}
                      className="inline-flex min-h-[40px] items-center rounded-lg border border-amber-300 px-2.5 text-xs font-semibold text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950/40"
                    >
                      Ce n&apos;est pas un doublon
                    </button>
                  </div>
                )}
                onApply={(suggestion) => {
                  if (suggestion.title) setTitle(suggestion.title);
                  setCategory(suggestion.category as IncidentCategory);
                  if (!residentWithoutPhoto) setPriority(suggestion.priority as Priority);
                  setAcceptedTriage(null);
                }}
              />
            </section>

            {strongDuplicateCount > 0 && !duplicateDismissed && (
              <div
                role="alert"
                className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
              >
                {strongDuplicateCount} correspondance(s) forte(s) détectée(s).
                Vérifiez le dossier existant avant d&apos;envoyer, ou confirmez qu&apos;il
                ne s&apos;agit pas du même problème.
                  <button
                    type="button"
                    onClick={() => setDuplicateDismissed(true)}
                    className="mt-2 block min-h-[40px] rounded-lg border border-amber-400 px-3 text-xs font-semibold hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-950/60"
                  >
                    Confirmer : créer un nouveau signalement
                  </button>
              </div>
            )}

            <section className="space-y-3">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Preuves</h3>
              <label className="block text-xs text-slate-500 dark:text-slate-400">
                Photos du problème (compression &le; 1 Mo par photo, jusqu&apos;à 3; disponibles hors ligne)
              </label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={fileInputRef}
                onChange={handlePhotoUpload}
                className="hidden"
              />

              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 3 }, (_, slotIndex) => {
                  const photo = photos[slotIndex];
                  if (photo) {
                    return (
                      <div
                        key={slotIndex}
                        className="relative aspect-square min-h-20 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo} alt={`Photo du problème ${slotIndex + 1}`} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            setPhotos((previous) => previous.filter((_, index) => index !== slotIndex));
                            setAiFiles((previous) => previous.filter((_, index) => index !== slotIndex));
                            setAcceptedTriage(null);
                          }}
                          className="absolute right-1 top-1 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-slate-900/80 text-white hover:bg-rose-600"
                          aria-label={`Supprimer la photo ${slotIndex + 1}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  }
                  return (
                    <button
                      key={slotIndex}
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex aspect-square min-h-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-xs font-medium text-slate-600 transition-colors hover:border-sky-400 hover:bg-sky-50 active:scale-[0.98] dark:border-slate-700 dark:text-slate-300 dark:hover:border-sky-700 dark:hover:bg-slate-800"
                      aria-label={`Ajouter une photo, emplacement ${slotIndex + 1}`}
                    >
                      <Camera aria-hidden="true" className="h-5 w-5 text-sky-500" />
                      <span>Ajouter</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="sticky bottom-0 z-10 -mx-6 border-t border-slate-200 bg-white/95 px-6 pb-3 pt-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-1 sm:backdrop-blur-none">
              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting || (strongDuplicateCount > 0 && !duplicateDismissed)}
                isLoading={isSubmitting}
                className="w-full min-h-[44px]"
              >
                Envoyer le signalement (Offline supporté)
              </Button>
            </div>
          </form>
          </BottomSheet>
        )}

        {/* MODALE DÉTAIL DE L'INCIDENT (Bottom sheet sur mobile, modale centrée dès md:) */}
        {selectedIncident && (() => {
          const inc = selectedIncident;
          const assignedToObj =
            typeof inc.assignedTo === "object" && inc.assignedTo ? inc.assignedTo : undefined;
          const assignedToId =
            assignedToObj?._id ?? (typeof inc.assignedTo === "string" ? inc.assignedTo : undefined);
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
          const hasResolutionProof = Boolean(inc.resolutionSubmittedAt);
          const canSubmitResolution =
            inc.status === IncidentStatus.IN_PROGRESS && (isAssignedTech || canAssign);
          const showResolutionTab =
            currentUser?.role === Role.RESIDENT
              ? hasResolutionProof
              : Boolean(isAssignedTech || canAssign) &&
                (hasResolutionProof || inc.status === IncidentStatus.IN_PROGRESS);
          const tabs = [
            { id: "overview" as const, label: "Aperçu", icon: ClipboardList },
            { id: "history" as const, label: "Historique", icon: History },
            { id: "discussion" as const, label: "Discussion", icon: MessageCircle },
            ...(showResolutionTab
              ? [{ id: "resolution" as const, label: "Résolution", icon: Wrench }]
              : []),
            ...(canAssign
              ? [{ id: "ai" as const, label: "Contexte IA", icon: Sparkles }]
              : []),
          ];

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

                <div role="tablist" aria-label="Détails de la réclamation" className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 dark:border-slate-800">
                  {tabs.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={selectedIncidentTab === id}
                      onClick={() => setSelectedIncidentTab(id)}
                      className={`inline-flex min-h-[48px] shrink-0 items-center gap-2 border-b-2 px-3 text-xs font-semibold transition-colors sm:text-sm ${
                        selectedIncidentTab === id
                          ? "border-sky-600 text-sky-700 dark:border-sky-400 dark:text-sky-300"
                          : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Contenu déroulant */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                  {selectedIncidentTab === "overview" && (
                  <div className="space-y-4">
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">Progression</h3>
                    <IncidentWorkflowTimeline status={inc.status} />
                  </section>

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

                  </div>
                  )}
                  {selectedIncidentTab === "history" && <IncidentHistory incidentId={inc._id} />}
                  {selectedIncidentTab === "ai" && canAssign && (
                    <IncidentAIContext
                      incident={inc}
                      residenceId={String(getProp(inc.residence, "_id") || inc.residence)}
                      onInspect={(candidateId) => void inspectIncident(candidateId)}
                      onPriorityApplied={(suggestedPriority) => {
                        const updated = { ...inc, priority: suggestedPriority };
                        setSelectedIncident(updated);
                        setIncidents((items) => items.map((item) => item._id === inc._id ? updated : item));
                      }}
                      onResolutionCheckSaved={(check) => {
                        const updates: Partial<IncidentDTO> = { aiResolutionCheck: check };
                        setSelectedIncident((previous) =>
                          previous ? { ...previous, ...updates } : previous
                        );
                        setIncidents((previous) =>
                          previous.map((item) =>
                            item._id === inc._id ? { ...item, ...updates } : item
                          )
                        );
                      }}
                      canVerify={canAssign}
                      goToDiscussion={() => setSelectedIncidentTab("discussion")}
                    />
                  )}
                  {selectedIncidentTab === "discussion" && (
                    <IncidentComments incidentId={inc._id} currentUserId={currentUser?.id || ""} />
                  )}
                  {selectedIncidentTab === "resolution" && showResolutionTab && (
                    <div className="space-y-5">
                      {hasResolutionProof && (
                        <ResolutionReview
                          incidentId={inc._id}
                          resolution={inc}
                          canRespond={currentUser?.role === Role.RESIDENT}
                          onPhotoClick={setFullscreenPhoto}
                          onUpdated={(data) => {
                            const updates: Partial<IncidentDTO> = {
                              status: data.status,
                              resolvedAt: data.resolvedAt,
                              resolutionDescription: data.resolutionDescription,
                              resolutionPhotos: data.resolutionPhotos,
                              resolutionSubmittedAt: data.resolutionSubmittedAt,
                              resolutionConfirmedAt: data.resolutionConfirmedAt,
                              resolutionRejectedAt: data.resolutionRejectedAt,
                              resolutionFeedback: data.resolutionFeedback,
                            };
                            setSelectedIncident((previous) => previous ? { ...previous, ...updates } : previous);
                            setIncidents((previous) => previous.map((item) =>
                              item._id === inc._id ? { ...item, ...updates, status: updates.status ?? item.status } : item
                            ));
                          }}
                        />
                      )}
                      {canSubmitResolution && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                          <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
                            {hasResolutionProof ? "Mettre à jour la preuve" : "Soumettre une preuve de résolution"}
                          </h3>
                          <ResolutionSubmissionForm
                            incidentId={inc._id}
                            onSubmitted={(data) => {
                              const updates: Partial<IncidentDTO> = {
                                resolutionDescription: data.resolutionDescription,
                                resolutionPhotos: data.resolutionPhotos,
                                resolutionSubmittedAt: data.resolutionSubmittedAt,
                                resolutionConfirmedAt: data.resolutionConfirmedAt,
                                resolutionRejectedAt: data.resolutionRejectedAt,
                                resolutionFeedback: data.resolutionFeedback,
                              };
                              setSelectedIncident((previous) => previous ? { ...previous, ...updates } : previous);
                              setIncidents((previous) => previous.map((item) =>
                                item._id === inc._id ? { ...item, ...updates } : item
                              ));
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}
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
        <div aria-label="Chargement des incidents" aria-busy="true" className="min-h-screen space-y-6 p-4 sm:p-8">
          <div className="h-36 animate-pulse rounded-3xl bg-gradient-to-r from-slate-200 to-indigo-100 dark:from-slate-900 dark:to-indigo-950" />
          <div className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
          <div className="grid gap-4 sm:grid-cols-2">{[0, 1, 2, 3].map((item) => <div key={item} className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900" />)}</div>
        </div>
      }
    >
      <IncidentsContent />
    </Suspense>
  );
}
