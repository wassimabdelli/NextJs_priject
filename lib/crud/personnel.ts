import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAuth, getSyndicResidenceIds } from "@/lib/auth-guard";
import {
  Role,
  ContractType,
  EmployeePosition,
  LeaveType,
  ShiftStatus,
} from "@/types/enums";
import { Employee } from "@/models/Employee";
import { Shift } from "@/models/Shift";
import { LeaveRequest } from "@/models/LeaveRequest";
import { Residence } from "@/models/Residence";
import {
  employeeCreateSchema,
  shiftCreateSchema,
  leaveCreateSchema,
} from "@/lib/validations/personnel";

/**
 * Erreur HTTP typée pour le module RH & Personnel.
 */
export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Filtre de portée (scope) par résidence pour les ressources RH.
 */
export async function personnelResidenceScope(user: {
  id: string;
  role: Role;
}): Promise<Record<string, unknown>> {
  if (user.role === Role.ADMIN) {
    return {};
  }

  if (user.role === Role.SYNDIC) {
    const residenceIds = await getSyndicResidenceIds(user.id);
    return { residence: { $in: residenceIds } };
  }

  throw new HttpError(403, "Accès refusé");
}

/**
 * Vérifie que le syndic connecté gère bien la résidence cible.
 */
async function ensureResidenceAccess(
  user: { id: string; role: Role },
  residenceId: unknown
) {
  if (!residenceId) return;
  const residenceDoc = await Residence.findById(residenceId).lean();
  if (!residenceDoc) {
    throw new HttpError(404, "Résidence introuvable");
  }

  if (user.role === Role.SYNDIC) {
    const allowedIds = await getSyndicResidenceIds(user.id);
    const isAllowed = allowedIds.some(
      (id: any) => String(id) === String(residenceId)
    );
    if (!isAllowed) {
      throw new HttpError(403, "Vous ne gérez pas cette résidence");
    }
  }
}

const HR_ROLES: Role[] = [Role.ADMIN, Role.SYNDIC];

/* ============================================================ */
/* 1. CRUD EMPLOYÉS (employeeCrudRoutes)                        */
/* ============================================================ */
export const employeeCrudRoutes = {
  async GET(req: NextRequest) {
    try {
      const session = await requireAuth();
      if (!HR_ROLES.includes(session.role)) {
        throw new HttpError(403, "Accès refusé");
      }

      const scope = await personnelResidenceScope(session);
      const { searchParams } = new URL(req.url);
      const page = Math.max(1, Number(searchParams.get("page") || 1));
      const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
      const search = (searchParams.get("search") || "").trim();
      const position = searchParams.get("position") || searchParams.get("role") || "";
      const residence = searchParams.get("residence") || "";
      const isActive = searchParams.get("isActive");

      const query: Record<string, unknown> = { ...scope };
      if (residence) query.residence = residence;
      if (position) query.position = position;
      if (isActive === "true" || isActive === "false") {
        query.isActive = isActive === "true";
      }
      if (search) {
        query.$or = [
          { fullName: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ];
      }

      const [data, total] = await Promise.all([
        Employee.find(query)
          .populate("residence", "name city")
          .populate("user", "name email phone")
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Employee.countDocuments(query),
      ]);

      return NextResponse.json({
        data,
        meta: { page, limit, total },
      });
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      const message = err instanceof Error ? err.message : "Erreur serveur";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  },

  async POST(req: NextRequest) {
    try {
      const session = await requireAuth();
      if (!HR_ROLES.includes(session.role)) {
        throw new HttpError(403, "Accès refusé");
      }

      const rawBody = await req.json();

      // Si un compte user est associé, charger ses informations pour renseigner fullName/email/phone si absents
      let userDoc: any = null;
      if (rawBody.user && String(rawBody.user).trim() !== "") {
        const UserModel = mongoose.models.User;
        if (UserModel) {
          userDoc = await UserModel.findById(rawBody.user).lean();
        }
      }

      const validPositions = Object.values(EmployeePosition).map(String);
      const validContracts = Object.values(ContractType).map(String);

      const rawPosition =
        rawBody.position ||
        rawBody.role ||
        rawBody.jobTitle ||
        (userDoc?.role === Role.TECHNICIAN ? "TECHNICIAN" : undefined);
      const resolvedPosition =
        rawPosition && validPositions.includes(String(rawPosition))
          ? String(rawPosition)
          : validPositions[0];

      const rawContract = rawBody.contractType;
      const resolvedContract =
        rawContract && validContracts.includes(String(rawContract))
          ? String(rawContract)
          : validContracts[0];

      const resolvedFullName = (
        rawBody.fullName ||
        rawBody.name ||
        userDoc?.name ||
        (resolvedPosition === "TECHNICIAN" ? "Technicien" : "Employé")
      )
        .toString()
        .trim();

      const resolvedPhone = (rawBody.phone || userDoc?.phone || "").toString().trim();
      const resolvedEmail = (rawBody.email || userDoc?.email || "").toString().trim();

      const bodyToValidate: Record<string, unknown> = {
        ...rawBody,
        fullName: resolvedFullName,
        position: resolvedPosition,
        contractType: resolvedContract,
        monthlySalary:
          rawBody.monthlySalary !== undefined && rawBody.monthlySalary !== ""
            ? Number(rawBody.monthlySalary)
            : rawBody.salary !== undefined && rawBody.salary !== ""
            ? Number(rawBody.salary)
            : 0,
        hireDate: rawBody.hireDate || new Date().toISOString(),
        user:
          rawBody.user && String(rawBody.user).trim() !== ""
            ? String(rawBody.user).trim()
            : undefined,
        endDate:
          rawBody.endDate && String(rawBody.endDate).trim() !== ""
            ? rawBody.endDate
            : undefined,
        phone: resolvedPhone.length >= 6 ? resolvedPhone : undefined,
        email: resolvedEmail.includes("@") ? resolvedEmail : undefined,
        notes:
          rawBody.notes && String(rawBody.notes).trim() !== ""
            ? String(rawBody.notes).trim()
            : undefined,
      };

      const parsed = employeeCreateSchema.safeParse(bodyToValidate);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || "Données employé invalides" },
          { status: 400 }
        );
      }

      const validData = parsed.data as Record<string, any>;
      await ensureResidenceAccess(session, validData.residence);

      const created = await Employee.create({
        ...validData,
        isActive: validData.isActive ?? true,
      } as any);

      const populated = await Employee.findById((created as any)._id)
        .populate("residence", "name city")
        .populate("user", "name email phone")
        .lean();

      return NextResponse.json({ data: populated }, { status: 201 });
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      const message =
        err instanceof Error ? err.message : "Erreur lors de la création de l'employé";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  },

  async PATCH(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) {
    try {
      const session = await requireAuth();
      if (!HR_ROLES.includes(session.role)) {
        throw new HttpError(403, "Accès refusé");
      }

      const { id } = await context.params;
      const body = await req.json();

      const existing = await Employee.findById(id);
      if (!existing) {
        throw new HttpError(404, "Employé introuvable");
      }

      await ensureResidenceAccess(session, (existing as any).residence);

      const updatePayload: Record<string, unknown> = { ...body };
      if (!updatePayload.position && body.role) {
        updatePayload.position = body.role;
      }
      if (updatePayload.monthlySalary === undefined && body.salary !== undefined) {
        updatePayload.monthlySalary = Number(body.salary);
      }
      if (updatePayload.user === "") delete updatePayload.user;
      if (updatePayload.endDate === "") delete updatePayload.endDate;
      if (updatePayload.phone === "") delete updatePayload.phone;
      if (updatePayload.email === "") delete updatePayload.email;

      const updated = await Employee.findByIdAndUpdate(
        id,
        { $set: updatePayload },
        { new: true, runValidators: true }
      )
        .populate("residence", "name city")
        .populate("user", "name email phone")
        .lean();

      return NextResponse.json({ data: updated });
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      const message =
        err instanceof Error ? err.message : "Erreur lors de la mise à jour de l'employé";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  },

  async DELETE(
    _req: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) {
    try {
      const session = await requireAuth();
      if (!HR_ROLES.includes(session.role)) {
        throw new HttpError(403, "Accès refusé");
      }

      const { id } = await context.params;
      const existing = await Employee.findById(id);
      if (!existing) {
        throw new HttpError(404, "Créneau ou employé introuvable");
      }

      await ensureResidenceAccess(session, (existing as any).residence);
      await Employee.findByIdAndDelete(id);

      return NextResponse.json({ data: { deleted: true } });
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      const message =
        err instanceof Error ? err.message : "Erreur lors de la suppression de l'employé";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  },
};

/* ============================================================ */
/* 2. CRUD PLANNINGS / SHIFTS (shiftCrudRoutes)                 */
/* ============================================================ */
export const shiftCrudRoutes = {
  async GET(req: NextRequest) {
    try {
      const session = await requireAuth();
      if (!HR_ROLES.includes(session.role)) {
        throw new HttpError(403, "Accès refusé");
      }

      const scope = await personnelResidenceScope(session);
      const { searchParams } = new URL(req.url);
      const page = Math.max(1, Number(searchParams.get("page") || 1));
      const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
      const employee = searchParams.get("employee") || "";
      const residence = searchParams.get("residence") || "";

      const query: Record<string, unknown> = { ...scope };
      if (employee) query.employee = employee;
      if (residence) query.residence = residence;

      const [data, total] = await Promise.all([
        Shift.find(query)
          .populate("employee")
          .populate("residence", "name city")
          .sort({ startAt: -1, startTime: -1, createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Shift.countDocuments(query),
      ]);

      return NextResponse.json({
        data,
        meta: { page, limit, total },
      });
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      const message = err instanceof Error ? err.message : "Erreur serveur";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  },

  async POST(req: NextRequest) {
    try {
      const session = await requireAuth();
      if (!HR_ROLES.includes(session.role)) {
        throw new HttpError(403, "Accès refusé");
      }

      const rawBody = await req.json();

      let empDoc: any = null;
      if (rawBody.employee) {
        empDoc = await Employee.findById(rawBody.employee).lean();
        if (!empDoc) {
          throw new HttpError(404, "Employé introuvable");
        }
      }

      const rawStart = rawBody.startAt || rawBody.startTime || rawBody.date;
      const rawEnd = rawBody.endAt || rawBody.endTime || rawStart;

      let resolvedStart = rawStart ? new Date(rawStart) : undefined;
      let resolvedEnd = rawEnd ? new Date(rawEnd) : undefined;

      // Si seule une date (ex: YYYY-MM-DD) a été fournie avec début === fin, ajouter 8h pour respecter endAt > startAt
      if (
        resolvedStart &&
        resolvedEnd &&
        !isNaN(resolvedStart.getTime()) &&
        !isNaN(resolvedEnd.getTime()) &&
        resolvedEnd.getTime() === resolvedStart.getTime()
      ) {
        resolvedEnd = new Date(resolvedStart.getTime() + 8 * 60 * 60 * 1000);
      }

      const validShiftStatuses = Object.values(ShiftStatus).map(String);
      const resolvedStatus =
        rawBody.status && validShiftStatuses.includes(String(rawBody.status))
          ? String(rawBody.status)
          : undefined;

      const bodyToValidate: Record<string, unknown> = {
        ...rawBody,
        residence: rawBody.residence || (empDoc ? String(empDoc.residence) : undefined),
        startAt: resolvedStart ? resolvedStart.toISOString() : rawStart,
        endAt: resolvedEnd ? resolvedEnd.toISOString() : rawEnd,
        mission:
          rawBody.mission && String(rawBody.mission).trim() !== ""
            ? String(rawBody.mission).trim()
            : rawBody.type && String(rawBody.type).trim() !== ""
            ? String(rawBody.type).trim()
            : undefined,
        status: resolvedStatus,
        notes:
          rawBody.notes && String(rawBody.notes).trim() !== ""
            ? String(rawBody.notes).trim()
            : undefined,
      };

      const parsed = shiftCreateSchema.safeParse(bodyToValidate);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || "Données de planning invalides" },
          { status: 400 }
        );
      }

      const validData = parsed.data as Record<string, any>;
      const { employee, residence, startAt, endAt } = validData;

      if (!empDoc) {
        empDoc = await Employee.findById(employee).lean();
        if (!empDoc) {
          throw new HttpError(404, "Employé introuvable");
        }
      }

      const targetResidence = residence || empDoc.residence;
      await ensureResidenceAccess(session, targetResidence);

      // Règle métier critique : vérifier l'absence de chevauchement de créneau pour le même employé
      const conflictingShift = await Shift.findOne({
        employee,
        startAt: { $lt: endAt },
        endAt: { $gt: startAt },
      }).lean();

      if (conflictingShift) {
        throw new HttpError(
          409,
          "Conflit de planning : un créneau existe déjà pour cet employé sur cette période"
        );
      }

      const created = await Shift.create({
        ...validData,
        residence: targetResidence,
      } as any);

      const populated = await Shift.findById((created as any)._id)
        .populate("employee")
        .populate("residence", "name city")
        .lean();

      return NextResponse.json({ data: populated }, { status: 201 });
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      const message =
        err instanceof Error ? err.message : "Erreur lors de la création du planning";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  },

  async PATCH(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) {
    try {
      const session = await requireAuth();
      if (!HR_ROLES.includes(session.role)) {
        throw new HttpError(403, "Accès refusé");
      }

      const { id } = await context.params;
      const body = await req.json();

      const existing = await Shift.findById(id);
      if (!existing) {
        throw new HttpError(404, "Créneau de planning introuvable");
      }

      await ensureResidenceAccess(session, (existing as any).residence);

      const updated = await Shift.findByIdAndUpdate(
        id,
        { $set: body },
        { new: true, runValidators: true }
      )
        .populate("employee")
        .populate("residence", "name city")
        .lean();

      return NextResponse.json({ data: updated });
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      const message =
        err instanceof Error ? err.message : "Erreur lors de la modification du planning";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  },

  async DELETE(
    _req: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) {
    try {
      const session = await requireAuth();
      if (!HR_ROLES.includes(session.role)) {
        throw new HttpError(403, "Accès refusé");
      }

      const { id } = await context.params;
      const existing = await Shift.findById(id);
      if (!existing) {
        throw new HttpError(404, "Créneau de planning introuvable");
      }

      await ensureResidenceAccess(session, (existing as any).residence);
      await Shift.findByIdAndDelete(id);

      return NextResponse.json({ data: { deleted: true } });
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      const message =
        err instanceof Error ? err.message : "Erreur lors de la suppression du planning";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  },
};

/* ============================================================ */
/* 3. CRUD CONGÉS (leaveRequestCrudRoutes)                      */
/* ============================================================ */
export const leaveRequestCrudRoutes = {
  async GET(req: NextRequest) {
    try {
      const session = await requireAuth();
      if (!HR_ROLES.includes(session.role)) {
        throw new HttpError(403, "Accès refusé");
      }

      const scope = await personnelResidenceScope(session);
      const { searchParams } = new URL(req.url);
      const page = Math.max(1, Number(searchParams.get("page") || 1));
      const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
      const status = searchParams.get("status") || "";
      const employee = searchParams.get("employee") || "";
      const residence = searchParams.get("residence") || "";

      const query: Record<string, unknown> = { ...scope };
      if (status) query.status = status;
      if (employee) query.employee = employee;
      if (residence) query.residence = residence;

      const [data, total] = await Promise.all([
        LeaveRequest.find(query)
          .populate("employee")
          .populate("residence", "name city")
          .sort({ startDate: -1, createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        LeaveRequest.countDocuments(query),
      ]);

      return NextResponse.json({
        data,
        meta: { page, limit, total },
      });
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      const message = err instanceof Error ? err.message : "Erreur serveur";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  },

  async POST(req: NextRequest) {
    try {
      const session = await requireAuth();
      if (!HR_ROLES.includes(session.role)) {
        throw new HttpError(403, "Accès refusé");
      }

      const rawBody = await req.json();

      let empDoc: any = null;
      if (rawBody.employee) {
        empDoc = await Employee.findById(rawBody.employee).lean();
        if (!empDoc) {
          throw new HttpError(404, "Employé introuvable");
        }
      }

      const validLeaveTypes = Object.values(LeaveType).map(String);
      const resolvedLeaveType =
        rawBody.type && validLeaveTypes.includes(String(rawBody.type))
          ? String(rawBody.type)
          : validLeaveTypes[0];

      const bodyToValidate: Record<string, unknown> = {
        ...rawBody,
        residence: rawBody.residence || (empDoc ? String(empDoc.residence) : undefined),
        type: resolvedLeaveType,
        reason:
          rawBody.reason && String(rawBody.reason).trim() !== ""
            ? String(rawBody.reason).trim()
            : undefined,
      };

      const parsed = leaveCreateSchema.safeParse(bodyToValidate);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || "Données de congé invalides" },
          { status: 400 }
        );
      }

      const validData = parsed.data as Record<string, any>;
      const { employee, residence, startDate, endDate } = validData;

      if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
        throw new HttpError(
          400,
          "La date de fin de congé doit être postérieure ou égale à la date de début"
        );
      }

      if (!empDoc) {
        empDoc = await Employee.findById(employee).lean();
        if (!empDoc) {
          throw new HttpError(404, "Employé introuvable");
        }
      }

      const targetResidence = residence || empDoc.residence;
      await ensureResidenceAccess(session, targetResidence);

      const created = await LeaveRequest.create({
        ...validData,
        residence: targetResidence,
        status: rawBody.status || "PENDING",
      } as any);

      const populated = await LeaveRequest.findById((created as any)._id)
        .populate("employee")
        .populate("residence", "name city")
        .lean();

      return NextResponse.json({ data: populated }, { status: 201 });
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      const message =
        err instanceof Error ? err.message : "Erreur lors de la création de la demande de congé";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  },

  async PATCH(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) {
    try {
      // Validation / approbation par SYNDIC ou ADMIN
      const session = await requireAuth();
      if (!HR_ROLES.includes(session.role)) {
        throw new HttpError(403, "Seuls le syndic et l'administrateur peuvent valider les congés");
      }

      const { id } = await context.params;
      const body = await req.json();

      const existing = await LeaveRequest.findById(id);
      if (!existing) {
        throw new HttpError(404, "Demande de congé introuvable");
      }

      await ensureResidenceAccess(session, (existing as any).residence);

      const updateFields: Record<string, unknown> = { ...body };
      if (body.status === "APPROVED" || body.status === "REJECTED") {
        updateFields.approvedBy = session.id;
        updateFields.reviewedAt = new Date();
      }

      const updated = await LeaveRequest.findByIdAndUpdate(
        id,
        { $set: updateFields },
        { new: true, runValidators: true }
      )
        .populate("employee")
        .populate("residence", "name city")
        .lean();

      return NextResponse.json({ data: updated });
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      const message =
        err instanceof Error ? err.message : "Erreur lors de la validation du congé";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  },

  async DELETE(
    _req: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) {
    try {
      const session = await requireAuth();
      if (!HR_ROLES.includes(session.role)) {
        throw new HttpError(403, "Accès refusé");
      }

      const { id } = await context.params;
      const existing = await LeaveRequest.findById(id);
      if (!existing) {
        throw new HttpError(404, "Demande de congé introuvable");
      }

      await ensureResidenceAccess(session, (existing as any).residence);
      await LeaveRequest.findByIdAndDelete(id);

      return NextResponse.json({ data: { deleted: true } });
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      const message =
        err instanceof Error ? err.message : "Erreur lors de la suppression de la demande de congé";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  },
};
