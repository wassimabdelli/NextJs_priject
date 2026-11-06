import { createCrudRoutes } from "@/lib/crud/createCrudRoutes";
import { Announcement } from "@/models/Announcement";
import { Apartment } from "@/models/Apartment";
import { getResidentApartmentIds, getSyndicResidenceIds } from "@/lib/auth-guard";
import {
  announcementCreateSchema,
  announcementUpdateSchema,
} from "@/lib/validations/announcement";
import { Role } from "@/types/enums";

/**
 * Configuration CRUD de référence pour l'entité Announcement.
 * - Lecture : tous les rôles autorisés de la résidence (ADMIN, SYNDIC, OWNER, TENANT, TECHNICIAN).
 * - Écriture / Modification / Suppression : réservées aux rôles ADMIN et SYNDIC.
 * - Scope : restriction stricte aux résidences de l'utilisateur.
 * - Injection de sécurité : author = session.user.id garanti.
 */
export const announcementCrudRoutes = createCrudRoutes({
  model: Announcement,
  createSchema: announcementCreateSchema,
  updateSchema: announcementUpdateSchema,
  access: {
    read: [Role.ADMIN, Role.SYNDIC, Role.OWNER, Role.TENANT, Role.TECHNICIAN],
    create: [Role.ADMIN, Role.SYNDIC],
    update: [Role.ADMIN, Role.SYNDIC],
    delete: [Role.ADMIN, Role.SYNDIC],
  },
  searchFields: ["title", "content"],
  defaultSort: { isPinned: -1, publishedAt: -1 },
  populate: [
    { path: "author", select: "name" },
    { path: "residence", select: "name city" },
  ],
  filterFields: ["residence", "isPinned"],
  scope: async (user) => {
    // 1. ADMIN : accès global
    if (user.role === Role.ADMIN) {
      return {};
    }
    // 2. SYNDIC : résidences gérées
    if (user.role === Role.SYNDIC) {
      const residenceIds = await getSyndicResidenceIds(user.id);
      return { residence: { $in: residenceIds } };
    }
    // 3. OWNER ou TENANT : résidences où l'utilisateur possède ou occupe un appartement
    if (user.role === Role.OWNER || user.role === Role.TENANT) {
      const apartmentIds = await getResidentApartmentIds(user.id);
      const residenceIds = await Apartment.find({ _id: { $in: apartmentIds } }).distinct(
        "residence"
      );
      return { residence: { $in: residenceIds } };
    }
    return {};
  },
  injectOnCreate: async (user) => {
    // Règle SyndicPro : author provient toujours de la session sécurisée
    return {
      author: user.id,
    };
  },
});
