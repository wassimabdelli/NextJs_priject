"use client";

import React from "react";
import type {
  Charge,
  Expense,
  Incident,
  Meeting,
  Resolution,
  Ballot,
  PaymentReceipt,
  ApartmentLot,
  UserProfile,
  DocumentContract,
  Announcement,
  AttachmentRequest,
  ElectionCandidate,
  IncidentStatus,
  Residence,
} from "@/lib/redesign/condo";
import { Role as ApiRole } from "@/types/enums";

function mapApiRoleToUi(role: string): UserProfile["role"] {
  switch (role) {
    case ApiRole.ADMIN:
    case ApiRole.SYNDIC:
      return "Syndic";
    case ApiRole.TENANT:
      return "Locataire";
    case ApiRole.TECHNICIAN:
      return "Technicien";
    default:
      return "Copropriétaire";
  }
}

const EMPTY_USER: UserProfile = {
  id: "",
  name: "…",
  email: "",
  phone: "",
  role: "Copropriétaire",
  residenceId: "",
  active: true,
  registeredDate: "",
};

const EMPTY_RESIDENCE: Residence = {
  id: "",
  name: "Chargement…",
  city: "",
  address: "",
  totalLots: 0,
  syndicName: "",
};

export const TAB_PATHS: Record<string, string> = {
  dashboard: "/dashboard",
  charges: "/charges",
  expenses: "/expenses",
  incidents: "/incidents",
  meetings: "/meetings",
  resolutions: "/resolutions",
  elections: "/elections",
  payments: "/payments",
  apartments: "/apartments",
  residents: "/residents",
  residences: "/residences",
  documents: "/documents",
  announcements: "/announcements",
  wallet: "/wallet",
  notifications: "/notifications",
  profile: "/profile",
  more: "/more",
  join: "/join",
  "join-requests": "/join-requests",
  users: "/users",
  votes: "/votes",
  employees: "/employees",
  shifts: "/shifts",
  leaves: "/leaves",
  equipment: "/equipment",
  maintenance: "/maintenance",
  stock: "/stock",
  "api-docs": "/api-docs",
};

export function pathToTab(pathname: string | null): string {
  if (!pathname) return "dashboard";
  const entry = Object.entries(TAB_PATHS).find(
    ([, path]) => pathname === path || pathname.startsWith(path + "/")
  );
  return entry?.[0] ?? "dashboard";
}

type RedesignStore = {
  /** Rôle Auth.js (ADMIN/SYNDIC/OWNER/…) pour filtrer la nav. */
  apiRole: ApiRole | null;
  currentUser: UserProfile;
  setCurrentUser: React.Dispatch<React.SetStateAction<UserProfile>>;
  allUsers: UserProfile[];
  setAllUsers: React.Dispatch<React.SetStateAction<UserProfile[]>>;
  residences: Residence[];
  activeResidence: Residence;
  setActiveResidence: React.Dispatch<React.SetStateAction<Residence>>;
  lots: ApartmentLot[];
  setLots: React.Dispatch<React.SetStateAction<ApartmentLot[]>>;
  charges: Charge[];
  setCharges: React.Dispatch<React.SetStateAction<Charge[]>>;
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  incidents: Incident[];
  setIncidents: React.Dispatch<React.SetStateAction<Incident[]>>;
  meetings: Meeting[];
  setMeetings: React.Dispatch<React.SetStateAction<Meeting[]>>;
  resolutions: Resolution[];
  ballots: Ballot[];
  setBallots: React.Dispatch<React.SetStateAction<Ballot[]>>;
  payments: PaymentReceipt[];
  setPayments: React.Dispatch<React.SetStateAction<PaymentReceipt[]>>;
  documents: DocumentContract[];
  setDocuments: React.Dispatch<React.SetStateAction<DocumentContract[]>>;
  announcements: Announcement[];
  setAnnouncements: React.Dispatch<React.SetStateAction<Announcement[]>>;
  attachmentRequests: AttachmentRequest[];
  setAttachmentRequests: React.Dispatch<React.SetStateAction<AttachmentRequest[]>>;
  candidates: ElectionCandidate[];
  setCandidates: React.Dispatch<React.SetStateAction<ElectionCandidate[]>>;
  theme: "light" | "dark";
  toggleTheme: () => void;
  isSearchOpen: boolean;
  setIsSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleApproveAttachment: (id: string) => void;
  handleRejectAttachment: (id: string) => void;
  handleAddCharge: (charge: Charge) => void;
  handleGenerateMonthlyCall: (period: string, totalBudget: number) => void;
  handleMarkPaid: (chargeId: string) => void;
  handleAddExpense: (expense: Expense) => void;
  handleUpdateIncidentStatus: (id: string, newStatus: IncidentStatus) => void;
  handleAddIncident: (incident: Incident) => void;
  handleUpdateMeetingAttendees: (meetingId: string, attendeeLots: string[]) => void;
  handleCastVote: (ballot: Ballot) => void;
  handleAddCandidate: (stmt: string) => void;
  handleVoteCandidate: (candidateId: string) => void;
  handleAddPayment: (p: PaymentReceipt) => void;
  handleAddLot: (lot: ApartmentLot) => void;
  handleAddUser: (user: UserProfile) => void;
  handleAddDocument: (doc: DocumentContract) => void;
  handleAddAnnouncement: (ann: Announcement) => void;
  handleUpdateProfile: (updated: Partial<UserProfile>) => void;
  openIncidentsCount: number;
};

const RedesignContext = React.createContext<RedesignStore | null>(null);

export function RedesignProvider({ children }: { children: React.ReactNode }) {
  const [apiRole, setApiRole] = React.useState<ApiRole | null>(null);
  const [currentUser, setCurrentUser] = React.useState<UserProfile>(EMPTY_USER);
  const [allUsers, setAllUsers] = React.useState<UserProfile[]>([]);
  const [residences, setResidencesState] = React.useState<Residence[]>([]);
  const [activeResidence, setActiveResidence] = React.useState<Residence>(EMPTY_RESIDENCE);

  const setActiveResidencePersisted: React.Dispatch<
    React.SetStateAction<Residence>
  > = React.useCallback((value) => {
    setActiveResidence((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      if (typeof window !== "undefined" && next?.id) {
        localStorage.setItem("syndicpro_selected_residence", next.id);
      }
      return next;
    });
  }, []);
  const [lots, setLots] = React.useState<ApartmentLot[]>([]);
  const [charges, setCharges] = React.useState<Charge[]>([]);
  const [expenses, setExpenses] = React.useState<Expense[]>([]);
  const [incidents, setIncidents] = React.useState<Incident[]>([]);
  const [meetings, setMeetings] = React.useState<Meeting[]>([]);
  const [resolutions] = React.useState<Resolution[]>([]);
  const [ballots, setBallots] = React.useState<Ballot[]>([]);
  const [payments, setPayments] = React.useState<PaymentReceipt[]>([]);
  const [documents, setDocuments] = React.useState<DocumentContract[]>([]);
  const [announcements, setAnnouncements] = React.useState<Announcement[]>([]);
  const [attachmentRequests, setAttachmentRequests] = React.useState<AttachmentRequest[]>([]);
  const [candidates, setCandidates] = React.useState<ElectionCandidate[]>([]);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [theme, setTheme] = React.useState<"light" | "dark">("light");

  React.useEffect(() => {
    const saved = localStorage.getItem("syndic_theme");
    if (saved === "dark" || saved === "light") setTheme(saved);
  }, []);

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("syndic_theme", theme);
  }, [theme]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Session réelle + résidences (pas de mock INITIAL_*)
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await fetch("/api/auth/session").then((r) =>
          r.ok ? r.json() : null
        );
        if (!cancelled && session?.user) {
          const role = (session.user.role as ApiRole) || ApiRole.OWNER;
          setApiRole(role);
          setCurrentUser((prev) => ({
            ...prev,
            id: session.user.id || prev.id,
            name: session.user.name || prev.name,
            email: session.user.email || prev.email,
            role: mapApiRoleToUi(role),
          }));
        }
      } catch {
        /* ignore */
      }

      try {
        const res = await fetch("/api/residences/mine");
        if (!res.ok) return;
        const body = await res.json();
        const list = (body?.data || []) as Array<{
          _id: string;
          name: string;
          city: string;
          address?: string;
          totalApartments?: number;
        }>;
        if (cancelled || list.length === 0) return;
        const mapped = list.map((r) => ({
          id: r._id,
          name: r.name,
          city: r.city,
          address: r.address || "",
          totalLots: r.totalApartments || 0,
          syndicName: "",
        }));
        setResidencesState(mapped);
        setActiveResidence((prev) => {
          const saved =
            typeof window !== "undefined"
              ? localStorage.getItem("syndicpro_selected_residence")
              : null;
          const found = mapped.find((r) => r.id === saved) || mapped[0];
          return found || prev;
        });
      } catch {
        /* liste vide jusqu'à hydrate */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleTheme = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  const handleApproveAttachment = (id: string) => {
    setAttachmentRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "Approuvée" as const } : r))
    );
  };

  const handleRejectAttachment = (id: string) => {
    setAttachmentRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "Refusée" as const } : r))
    );
  };

  const handleAddCharge = (charge: Charge) => setCharges((prev) => [charge, ...prev]);

  const handleGenerateMonthlyCall = (period: string, totalBudget: number) => {
    const newCharges: Charge[] = lots.map((lot) => {
      const share = Math.round((lot.tantiemes / 1000) * totalBudget * 100) / 100;
      return {
        id: `ch-${Date.now()}-${lot.id}`,
        lotNumber: `Lot ${lot.lotNumber}`,
        period,
        calledAmount: share,
        paidAmount: 0,
        status: "En retard",
        dueDate: `25/${period.split("-")[1]}/2026`,
        residenceId: lot.residenceId,
      };
    });
    setCharges((prev) => [...newCharges, ...prev]);
  };

  const handleMarkPaid = (chargeId: string) => {
    setCharges((prev) =>
      prev.map((c) =>
        c.id === chargeId
          ? { ...c, paidAmount: c.calledAmount, status: "Payé" as const }
          : c
      )
    );
  };

  const handleAddExpense = (expense: Expense) => setExpenses((prev) => [expense, ...prev]);

  const handleUpdateIncidentStatus = (id: string, newStatus: IncidentStatus) => {
    setIncidents((prev) => prev.map((i) => (i.id === id ? { ...i, status: newStatus } : i)));
  };

  const handleAddIncident = (incident: Incident) => setIncidents((prev) => [incident, ...prev]);

  const handleUpdateMeetingAttendees = (meetingId: string, attendeeLots: string[]) => {
    setMeetings((prev) =>
      prev.map((m) => (m.id === meetingId ? { ...m, attendeeLotIds: attendeeLots } : m))
    );
  };

  const handleCastVote = (ballot: Ballot) => setBallots((prev) => [ballot, ...prev]);

  const handleAddCandidate = (stmt: string) => {
    const newCand: ElectionCandidate = {
      id: `cand-${Date.now()}`,
      name: currentUser.name,
      lotNumber: currentUser.lotId ? `Lot ${currentUser.lotId}` : "Lot A101",
      registeredDate: "06/11/2026",
      statement: stmt,
      votesCount: 0,
    };
    setCandidates((prev) => [...prev, newCand]);
  };

  const handleVoteCandidate = (candidateId: string) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === candidateId ? { ...c, votesCount: c.votesCount + 1 } : c))
    );
  };

  const handleAddPayment = (p: PaymentReceipt) => setPayments((prev) => [p, ...prev]);
  const handleAddLot = (lot: ApartmentLot) => setLots((prev) => [...prev, lot]);
  const handleAddUser = (user: UserProfile) => setAllUsers((prev) => [...prev, user]);
  const handleAddDocument = (doc: DocumentContract) => setDocuments((prev) => [doc, ...prev]);
  const handleAddAnnouncement = (ann: Announcement) =>
    setAnnouncements((prev) => [ann, ...prev]);
  const handleUpdateProfile = (updated: Partial<UserProfile>) => {
    setCurrentUser((prev) => ({ ...prev, ...updated }));
  };

  const openIncidentsCount = incidents.filter((i) => i.status !== "Résolu").length;

  const value: RedesignStore = {
    apiRole,
    currentUser,
    setCurrentUser,
    allUsers,
    setAllUsers,
    residences,
    activeResidence,
    setActiveResidence: setActiveResidencePersisted,
    lots,
    setLots,
    charges,
    setCharges,
    expenses,
    setExpenses,
    incidents,
    setIncidents,
    meetings,
    setMeetings,
    resolutions,
    ballots,
    setBallots,
    payments,
    setPayments,
    documents,
    setDocuments,
    announcements,
    setAnnouncements,
    attachmentRequests,
    setAttachmentRequests,
    candidates,
    setCandidates,
    theme,
    toggleTheme,
    isSearchOpen,
    setIsSearchOpen,
    handleApproveAttachment,
    handleRejectAttachment,
    handleAddCharge,
    handleGenerateMonthlyCall,
    handleMarkPaid,
    handleAddExpense,
    handleUpdateIncidentStatus,
    handleAddIncident,
    handleUpdateMeetingAttendees,
    handleCastVote,
    handleAddCandidate,
    handleVoteCandidate,
    handleAddPayment,
    handleAddLot,
    handleAddUser,
    handleAddDocument,
    handleAddAnnouncement,
    handleUpdateProfile,
    openIncidentsCount,
  };

  return <RedesignContext.Provider value={value}>{children}</RedesignContext.Provider>;
}

export function useRedesign() {
  const ctx = React.useContext(RedesignContext);
  if (!ctx) throw new Error("useRedesign must be used within RedesignProvider");
  return ctx;
}
