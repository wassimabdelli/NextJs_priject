import type { HydratedDocument, Types } from "mongoose";
import { HttpError, isValidObjectId } from "@/lib/api";
import {
  type AuthUser,
  getResidentResidenceIds,
  getSyndicResidenceIds,
} from "@/lib/auth-guard";
import type { MaintenanceCompleteInput } from "@/lib/validations/maintenance";
import { Employee } from "@/models/Employee";
import { Equipment } from "@/models/Equipment";
import { Expense } from "@/models/Expense";
import { Incident } from "@/models/Incident";
import { type IMaintenanceTask, MaintenanceTask } from "@/models/MaintenanceTask";
import { User } from "@/models/User";
import {
  EquipmentStatus,
  ExpenseCategory,
  MaintenanceStatus,
  MaintenanceType,
  Role,
} from "@/types/enums";
import {
  canTransitionMaintenance,
  computeNextMaintenanceDate,
  OPEN_MAINTENANCE_STATUSES,
} from "./workflow";

/**
 * Renvoie la liste dédoublonnée des résidences auxquelles un technicien est rattaché
 * (fiche employé active, interventions de maintenance assignées ou incidents assignés).
 */
export async function getTechnicianResourceResidenceIds(
  userId: string
): Promise<string[]> {
  const [empRes, taskRes, incRes] = await Promise.all([
    Employee.find({ user: userId, isActive: true }).distinct("residence"),
    MaintenanceTask.find({ assignedTo: userId }).distinct("residence"),
    Incident.find({ assignedTo: userId }).distinct("residence"),
  ]);

  const ids = new Set<string>();
  for (const id of [...empRes, ...taskRes, ...incRes]) {
    if (id) ids.add(String(id));
  }
  return Array.from(ids);
}

/**
 * Filtre de périmètre des équipements selon le rôle de l'utilisateur.
 */
export async function equipmentScope(
  user: AuthUser
): Promise<Record<string, unknown>> {
  if (user.role === Role.ADMIN) return {};
  if (user.role === Role.SYNDIC) {
    return { residence: { $in: await getSyndicResidenceIds(user.id) } };
  }
  if (user.role === Role.TECHNICIAN) {
    return { residence: { $in: await getTechnicianResourceResidenceIds(user.id) } };
  }
  if (user.role === Role.RESIDENT) {
    return { residence: { $in: await getResidentResidenceIds(user.id) } };
  }
  return { _id: null };
}

/**
 * Règle 4 : synchronise automatiquement le statut d'un équipement selon ses pannes correctives ouvertes.
 * Le statut OUT_OF_SERVICE n'est jamais modifié automatiquement.
 */
export async function syncEquipmentStatus(
  equipmentId: string | Types.ObjectId
): Promise<void> {
  const eq = await Equipment.findById(equipmentId).lean();
  if (!eq) return;

  const open = await MaintenanceTask.countDocuments({
    equipment: eq._id,
    type: MaintenanceType.CORRECTIVE,
    status: { $in: OPEN_MAINTENANCE_STATUSES },
  });

  let nextStatus: EquipmentStatus | null = null;
  if (
    open > 0 &&
    (eq.status === EquipmentStatus.OPERATIONAL ||
      eq.status === EquipmentStatus.UNDER_MAINTENANCE)
  ) {
    nextStatus = EquipmentStatus.BROKEN;
  } else if (open === 0 && eq.status === EquipmentStatus.BROKEN) {
    nextStatus = EquipmentStatus.OPERATIONAL;
  }

  if (nextStatus && nextStatus !== eq.status) {
    await Equipment.updateOne({ _id: eq._id }, { $set: { status: nextStatus } });
  }
}

export const MAINTENANCE_POPULATE = [
  { path: "equipment", select: "name category location status" },
  { path: "assignedTo", select: "name phone" },
  { path: "residence", select: "name city" },
];

/**
 * Filtre de périmètre des interventions de maintenance selon le rôle de l'utilisateur.
 */
export async function maintenanceScope(
  user: AuthUser
): Promise<Record<string, unknown>> {
  if (user.role === Role.ADMIN) return {};
  if (user.role === Role.SYNDIC) {
    return { residence: { $in: await getSyndicResidenceIds(user.id) } };
  }
  if (user.role === Role.TECHNICIAN) {
    return { assignedTo: user.id };
  }
  return { _id: null };
}

/**
 * Vérifie que l'identifiant correspond bien à un technicien actif.
 */
export async function assertAssignableTechnician(userId: string): Promise<void> {
  const u = await User.findById(userId).select("role isActive").lean();
  if (!u) {
    throw new HttpError(404, "Technicien introuvable");
  }
  if (u.role !== Role.TECHNICIAN || !u.isActive) {
    throw new HttpError(400, "L'utilisateur assigné doit être un technicien actif");
  }
}

/**
 * Charge une intervention et vérifie les droits d'accès de l'acteur.
 */
export async function loadTaskForActor(
  id: string | null | undefined,
  user: AuthUser
): Promise<HydratedDocument<IMaintenanceTask>> {
  if (!isValidObjectId(id)) {
    throw new HttpError(400, "Identifiant invalide");
  }

  const task = await MaintenanceTask.findById(id);
  if (!task) {
    throw new HttpError(404, "Intervention introuvable");
  }

  if (
    user.role === Role.TECHNICIAN &&
    String(task.assignedTo) !== String(user.id)
  ) {
    throw new HttpError(403, "Cette intervention ne vous est pas assignée");
  }

  if (user.role === Role.SYNDIC) {
    const ids = await getSyndicResidenceIds(user.id);
    if (!ids.includes(String(task.residence))) {
      throw new HttpError(403, "Vous n'administrez pas cette résidence");
    }
  }

  return task;
}

/**
 * Fait évoluer le statut d'une intervention (démarrage ou annulation).
 */
export async function changeTaskStatus(
  task: HydratedDocument<IMaintenanceTask>,
  target: typeof MaintenanceStatus.IN_PROGRESS | typeof MaintenanceStatus.CANCELLED
): Promise<void> {
  if (!canTransitionMaintenance(task.status, target)) {
    throw new HttpError(
      409,
      `Transition invalide : de "${task.status}" vers "${target}".`
    );
  }

  task.status = target;
  await task.save();

  if (
    task.type === MaintenanceType.CORRECTIVE &&
    target === MaintenanceStatus.CANCELLED
  ) {
    await syncEquipmentStatus(task.equipment);
  }
}

/**
 * Clôture une intervention de maintenance (Règles 3, 4 et 7).
 */
export async function completeTask(
  task: HydratedDocument<IMaintenanceTask>,
  data: MaintenanceCompleteInput
): Promise<void> {
  // 1. Idempotence hors ligne et garde statut
  if (task.status === MaintenanceStatus.DONE) return;
  if (task.status === MaintenanceStatus.CANCELLED) {
    throw new HttpError(409, "Intervention annulée : clôture impossible");
  }

  // 2. Consolidation des champs de clôture
  const originalStatus = task.status;
  const completedAt = data.completedAt ?? new Date();
  const cost = data.cost ?? task.cost;
  const notes = data.notes ?? task.notes;
  const checklist = data.checklist
    ? data.checklist.map((i) => ({ label: i.label, done: i.done ?? false }))
    : task.checklist;

  // 3. Prise atomique anti double clôture
  const claimed = await MaintenanceTask.findOneAndUpdate(
    { _id: task._id, status: { $in: OPEN_MAINTENANCE_STATUSES } },
    {
      $set: {
        status: MaintenanceStatus.DONE,
        completedAt,
        cost,
        notes,
        checklist,
      },
    },
    { new: true, runValidators: true }
  );

  if (!claimed) {
    const reloaded = await MaintenanceTask.findById(task._id).lean();
    if (reloaded?.status === MaintenanceStatus.DONE) return;
    throw new HttpError(409, "Clôture impossible");
  }

  const eq = await Equipment.findById(task.equipment).lean();

  // 4. Règle 7 : création automatique d'une dépense si cost > 0
  if (cost > 0 && !claimed.expense) {
    let createdExpenseId: Types.ObjectId | null = null;
    try {
      const description = eq?.name
        ? `Maintenance : ${task.title} (${eq.name})`
        : `Maintenance : ${task.title}`;
      const expense = await Expense.create({
        residence: task.residence,
        category: ExpenseCategory.MAINTENANCE,
        description,
        amount: cost,
        expenseDate: completedAt,
      });
      createdExpenseId = expense._id;
      await MaintenanceTask.updateOne(
        { _id: task._id },
        { $set: { expense: expense._id } }
      );
    } catch (err) {
      if (createdExpenseId) {
        await Expense.deleteOne({ _id: createdExpenseId }).catch(() => {});
      }
      await MaintenanceTask.updateOne(
        { _id: task._id },
        {
          $set: { status: originalStatus },
          $unset: { completedAt: 1 },
        }
      ).catch(() => {});
      throw err;
    }
  }

  // 5. Règle 3 : mise à jour des dates d'entretien de l'équipement
  if (
    eq &&
    (!eq.lastMaintenanceDate ||
      completedAt.getTime() >= new Date(eq.lastMaintenanceDate).getTime())
  ) {
    await Equipment.updateOne(
      { _id: eq._id },
      {
        $set: {
          lastMaintenanceDate: completedAt,
          nextMaintenanceDate: computeNextMaintenanceDate(
            completedAt,
            eq.maintenanceIntervalDays
          ),
        },
      }
    );
  }

  // 6. Règle 4 : synchronisation du statut de l'équipement
  await syncEquipmentStatus(task.equipment);
}
