import { HttpError } from "@/lib/api";
import { getSyndicResidenceIds } from "@/lib/auth-guard";
import { createCrudRoutes } from "@/lib/crud/createCrudRoutes";
import {
  assertAssignableTechnician,
  MAINTENANCE_POPULATE,
  maintenanceScope,
  syncEquipmentStatus,
} from "@/lib/maintenance/service";
import { OPEN_MAINTENANCE_STATUSES } from "@/lib/maintenance/workflow";
import {
  type MaintenanceTaskCreateInput,
  type MaintenanceTaskUpdateInput,
  maintenanceTaskCreateSchema,
  maintenanceTaskUpdateSchema,
} from "@/lib/validations/maintenance";
import { Equipment } from "@/models/Equipment";
import { Incident } from "@/models/Incident";
import { type IMaintenanceTask, MaintenanceTask } from "@/models/MaintenanceTask";
import { Residence } from "@/models/Residence";
import { MaintenanceStatus, MaintenanceType, Role } from "@/types/enums";

export const maintenanceCrudRoutes = createCrudRoutes({
  model: MaintenanceTask,
  createSchema: maintenanceTaskCreateSchema,
  // statut : uniquement via /status et /complete ; type figé pour garder la règle 4 cohérente
  updateSchema: maintenanceTaskUpdateSchema.omit({ status: true, type: true }),
  access: {
    read: [Role.ADMIN, Role.SYNDIC, Role.TECHNICIAN],
    create: [Role.ADMIN, Role.SYNDIC],
    update: [Role.ADMIN, Role.SYNDIC],
    delete: [Role.ADMIN, Role.SYNDIC],
  },
  searchFields: ["title", "description"],
  defaultSort: { scheduledDate: 1 },
  dateField: "scheduledDate",
  populate: MAINTENANCE_POPULATE,
  filterFields: ["residence", "equipment", "type", "status", "assignedTo"],
  scope: (user) => maintenanceScope(user),
  injectOnCreate: () => ({ syncedAt: new Date() }),
  beforeCreate: async (user, body: MaintenanceTaskCreateInput) => {
    const resExists = await Residence.exists({ _id: body.residence });
    if (!resExists) {
      throw new HttpError(404, "Résidence introuvable");
    }
    if (user.role === Role.SYNDIC) {
      const ids = await getSyndicResidenceIds(user.id);
      if (!ids.includes(String(body.residence))) {
        throw new HttpError(403, "Vous n'administrez pas cette résidence");
      }
    }

    const equipement = await Equipment.findById(body.equipment)
      .select("residence")
      .lean();
    if (!equipement) {
      throw new HttpError(404, "Équipement introuvable");
    }
    if (String(equipement.residence) !== String(body.residence)) {
      throw new HttpError(
        400,
        "Cet équipement n'appartient pas à cette résidence"
      );
    }

    if (body.assignedTo) {
      await assertAssignableTechnician(String(body.assignedTo));
    }

    if (body.incident) {
      const inc = await Incident.findById(body.incident)
        .select("residence")
        .lean();
      if (!inc) {
        throw new HttpError(404, "Incident introuvable");
      }
      if (String(inc.residence) !== String(body.residence)) {
        throw new HttpError(
          400,
          "Cet incident n'appartient pas à cette résidence"
        );
      }
    }
  },
  afterCreate: async (doc: IMaintenanceTask) => {
    if (doc.type === MaintenanceType.CORRECTIVE) {
      await syncEquipmentStatus(doc.equipment);
    }
  },
  beforeUpdate: async (id, body: Omit<MaintenanceTaskUpdateInput, "status" | "type">, user) => {
    const task = await MaintenanceTask.findOne({
      _id: id,
      ...(await maintenanceScope(user)),
    }).lean();
    if (!task) return;

    if (!OPEN_MAINTENANCE_STATUSES.includes(task.status)) {
      throw new HttpError(
        409,
        "Intervention clôturée ou annulée : modification impossible"
      );
    }

    if (body.assignedTo) {
      await assertAssignableTechnician(String(body.assignedTo));
    }
  },
  beforeDelete: async (id, user) => {
    const task = await MaintenanceTask.findOne({
      _id: id,
      ...(await maintenanceScope(user)),
    }).lean();
    if (!task) return;

    if (
      task.status !== MaintenanceStatus.PLANNED &&
      task.status !== MaintenanceStatus.CANCELLED
    ) {
      throw new HttpError(
        409,
        "Seules les interventions planifiées ou annulées peuvent être supprimées"
      );
    }
  },
  afterDelete: async (deleted: IMaintenanceTask) => {
    if (deleted.type === MaintenanceType.CORRECTIVE) {
      await syncEquipmentStatus(deleted.equipment);
    }
  },
});
