import { HttpError } from "@/lib/api";
import { getSyndicResidenceIds } from "@/lib/auth-guard";
import { createCrudRoutes } from "@/lib/crud/createCrudRoutes";
import { equipmentScope } from "@/lib/maintenance/service";
import { computeNextMaintenanceDate } from "@/lib/maintenance/workflow";
import {
  type EquipmentCreateInput,
  type EquipmentUpdateInput,
  equipmentCreateSchema,
  equipmentUpdateSchema,
} from "@/lib/validations/maintenance";
import { Equipment } from "@/models/Equipment";
import { MaintenanceTask } from "@/models/MaintenanceTask";
import { Residence } from "@/models/Residence";
import { Role } from "@/types/enums";

type EquipmentUpdatePayload = EquipmentUpdateInput & {
  nextMaintenanceDate?: Date | null;
};

export const equipmentCrudRoutes = createCrudRoutes({
  model: Equipment,
  createSchema: equipmentCreateSchema,
  updateSchema: equipmentUpdateSchema,
  access: {
    read: [Role.ADMIN, Role.SYNDIC, Role.TECHNICIAN],
    create: [Role.ADMIN, Role.SYNDIC],
    update: [Role.ADMIN, Role.SYNDIC],
    delete: [Role.ADMIN, Role.SYNDIC],
  },
  searchFields: ["name", "location", "serialNumber"],
  defaultSort: { name: 1 },
  populate: [{ path: "residence", select: "name city" }],
  filterFields: ["residence", "category", "status"],
  scope: (user) => equipmentScope(user),
  injectOnCreate: async (_user, body: EquipmentCreateInput) => {
    // Règle 3 : prochaine date = dernière intervention (ou date de création) + fréquence
    const next = computeNextMaintenanceDate(
      body.lastMaintenanceDate ?? new Date(),
      body.maintenanceIntervalDays
    );
    return next ? { nextMaintenanceDate: next } : {};
  },
  beforeCreate: async (user, body: EquipmentCreateInput) => {
    const exists = await Residence.exists({ _id: body.residence });
    if (!exists) {
      throw new HttpError(404, "Résidence introuvable");
    }
    if (user.role === Role.SYNDIC) {
      const ids = await getSyndicResidenceIds(user.id);
      if (!ids.includes(String(body.residence))) {
        throw new HttpError(403, "Vous n'administrez pas cette résidence");
      }
    }
  },
  beforeUpdate: async (id, body: EquipmentUpdatePayload) => {
    if (
      body.maintenanceIntervalDays === undefined &&
      body.lastMaintenanceDate === undefined
    ) {
      return;
    }
    const existant = await Equipment.findById(id).lean();
    if (!existant) return;

    const interval =
      body.maintenanceIntervalDays ?? existant.maintenanceIntervalDays;
    const base =
      body.lastMaintenanceDate ??
      existant.lastMaintenanceDate ??
      existant.createdAt;
    body.nextMaintenanceDate = computeNextMaintenanceDate(base, interval);
  },
  beforeDelete: async (id, user) => {
    const filtre = { _id: id, ...(await equipmentScope(user)) };
    const exists = await Equipment.exists(filtre);
    if (!exists) return;

    const hasTasks = await MaintenanceTask.exists({ equipment: id });
    if (hasTasks) {
      throw new HttpError(
        409,
        "Suppression impossible : cet équipement a des interventions. Passez-le plutôt « hors service »."
      );
    }
  },
});
