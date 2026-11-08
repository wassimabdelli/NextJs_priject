import { createCrudRoutes } from "@/lib/crud/createCrudRoutes";
import { Expense } from "@/models/Expense";
import { Residence } from "@/models/Residence";
import { getSyndicResidenceIds } from "@/lib/auth-guard";
import { expenseCreateSchema, expenseUpdateSchema } from "@/lib/validations/expense";
import { Role } from "@/types/enums";
import { HttpError } from "@/lib/api";

export const expenseCrudRoutes = createCrudRoutes({
  model: Expense,
  createSchema: expenseCreateSchema,
  updateSchema: expenseUpdateSchema,
  access: {
    read: [Role.ADMIN, Role.SYNDIC],
    create: [Role.ADMIN, Role.SYNDIC],
    update: [Role.ADMIN, Role.SYNDIC],
    delete: [Role.ADMIN, Role.SYNDIC],
  },
  searchFields: ["description"],
  defaultSort: { expenseDate: -1 },
  populate: [{ path: "residence", select: "name city" }],
  filterFields: ["residence", "category"],
  dateField: "expenseDate",
  exportPopulate: [{ path: "residence", select: "name" }],
  exportColumns: [
    { key: "expenseDate", label: "Date" },
    { key: "category", label: "Catégorie" },
    { key: "description", label: "Description" },
    { key: "amount", label: "Montant" },
    { key: "residence.name", label: "Résidence" },
  ],

  scope: async (user) => {
    if (user.role === Role.ADMIN) {
      return {};
    }
    if (user.role === Role.SYNDIC) {
      const residenceIds = await getSyndicResidenceIds(user.id);
      return { residence: { $in: residenceIds } };
    }
    return { _id: null };
  },

  beforeCreate: async (user, body) => {
    if (!(await Residence.exists({ _id: body.residence }))) {
      throw new HttpError(404, "Résidence introuvable");
    }

    if (user.role === Role.SYNDIC) {
      const residenceIds = await getSyndicResidenceIds(user.id);
      if (!residenceIds.includes(String(body.residence))) {
        throw new HttpError(403, "Vous n'administrez pas cette résidence");
      }
    }
  },
});
