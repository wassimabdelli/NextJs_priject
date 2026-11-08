import type { IncidentCategory, IncidentStatus, Priority, Role } from "@/types/enums";

export interface IncidentDashboardData {
  role: Role;
  dateRange: { from: string; to: string };
  statistics: {
    total: number;
    reported: number;
    assigned: number;
    inProgress: number;
    resolved: number;
    urgent: number;
    high: number;
    overdue: number;
    averageResolutionHours: number;
    resolutionRate: number;
  };
  awaitingConfirmation: number;
  byStatus: Array<{ status: IncidentStatus; count: number }>;
  byCategory: Array<{ category: IncidentCategory; count: number }>;
  monthlyTrends: Array<{ month: string; reported: number; resolved: number }>;
  recentActivity: Array<{
    _id: string;
    incidentId: string;
    title: string;
    category: IncidentCategory;
    priority: Priority;
    status: IncidentStatus;
    action: string;
    description: string;
    createdAt: string;
  }>;
  technicianPerformance: Array<{
    technicianId: string;
    name: string;
    assigned: number;
    completed: number;
    inProgress: number;
    averageResolutionHours: number;
  }>;
  residenceComparison: Array<{ residenceId: string; name: string; incidents: number }>;
  residences: Array<{ id: string; name: string }>;
  technicians: Array<{ id: string; name: string }>;
  recentIncidents: {
    data: Array<{
      _id: string;
      title: string;
      category: IncidentCategory;
      priority: Priority;
      status: IncidentStatus;
      createdAt: string;
      residence: { id: string; name: string } | null;
    }>;
    meta: { page: number; limit: number; total: number };
  };
  priorityIncidents: Array<{
    _id: string;
    title: string;
    category: IncidentCategory;
    priority: Priority;
    status: IncidentStatus;
    residence: { id: string; name: string } | null;
  }>;
}

export interface IncidentDashboardFilters {
  from?: string;
  to?: string;
  residence?: string;
  technician?: string;
}
