import { Role } from "@/types/enums";
import type { ResourceConfig } from "./types";
import type {
  AnnouncementDTO,
  ResidenceDTO,
  ApartmentDTO,
  ChargeDTO,
  PaymentDTO,
  ExpenseDTO,
  IncidentDTO,
  MeetingDTO,
  ResolutionDTO,
  VoteDTO,
  DocumentDTO,
  UserDTO,
} from "@/types/api";



/* ============================================================ */
/* 1. ANNONCES                                                  */
/* ============================================================ */
export const announcementConfig: ResourceConfig<AnnouncementDTO> = {
  key: "announcements",
  label: "Annonce",
  plural: "Annonces",
  apiPath: "/api/announcements",
  entityOfflineKey: "announcement",
  searchPlaceholder: "Rechercher par titre ou contenu...",
  defaultSort: "-isPinned,-publishedAt",

  fields: [
    {
      name: "title",
      label: "Titre de l'annonce",
      type: "text",
      required: true,
      placeholder: "Ex : Travaux de ravalement, Réunion syndic...",
    },
    {
      name: "residence",
      label: "Résidence concernée",
      type: "relation",
      required: true,
      relation: {
        resource: "residences",
        apiPath: "/api/residences",
        labelField: "name",
        valueField: "_id",
      },
    },
    {
      name: "content",
      label: "Contenu de l'annonce",
      type: "textarea",
      required: true,
      placeholder: "Précisez l'objet, la date des interventions, les consignes aux résidents...",
    },
    {
      name: "publishedAt",
      label: "Date de publication",
      type: "date",
    },
    {
      name: "isPinned",
      label: "Épingler l'annonce",
      type: "boolean",
      defaultValue: false,
      helpText: "Affiche l'annonce en priorité en tête de liste pour tous les résidents",
    },
  ],

  listColumns: [
    {
      key: "title",
      label: "Titre",
    },
    {
      key: "residence",
      label: "Résidence",
      type: "relation",
    },
    {
      key: "publishedAt",
      label: "Date",
      type: "date",
    },
    {
      key: "isPinned",
      label: "Épinglée",
      type: "boolean",
    },
  ],

  cardTitle: (item) => item.title || "Annonce",
  cardSubtitle: (item) => item.content || "",

  canCreate: (role) => role === Role.ADMIN || role === Role.SYNDIC,
  canEdit: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  canDelete: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  filterDefs: [
    {
      key: "isPinned",
      label: "Épinglées",
      type: "boolean",
    },
  ],
};

/* ============================================================ */
/* 2. RÉSIDENCES                                                */
/* ============================================================ */
export const residenceConfig: ResourceConfig<ResidenceDTO> = {
  key: "residences",
  label: "Résidence",
  plural: "Résidences",
  apiPath: "/api/residences",
  entityOfflineKey: "residence",
  searchPlaceholder: "Rechercher une résidence par nom, ville ou adresse...",
  defaultSort: "name",

  fields: [
    {
      name: "name",
      label: "Nom de la copropriété",
      type: "text",
      required: true,
      placeholder: "Ex : Résidence Les Oliviers",
    },
    {
      name: "address",
      label: "Adresse complète",
      type: "text",
      required: true,
      placeholder: "Ex : 14 rue de la République",
    },
    {
      name: "city",
      label: "Ville",
      type: "text",
      required: true,
      placeholder: "Ex : Nice",
    },
    {
      name: "floors",
      label: "Nombre d'étages",
      type: "number",
      required: true,
      defaultValue: 1,
    },
    {
      name: "totalApartments",
      label: "Nombre total de lots",
      type: "number",
      required: true,
      defaultValue: 10,
    },
    {
      name: "syndic",
      label: "Syndic gestionnaire",
      type: "relation",
      required: true,
      helpText: "Le syndic ne verra la résidence que si elle lui est rattachée",
      relation: {
        resource: "users",
        apiPath: "/api/users?role=SYNDIC",
        labelField: "name",
        valueField: "_id",
      },
    },
  ],

  listColumns: [
    {
      key: "name",
      label: "Nom",
    },
    {
      key: "city",
      label: "Ville",
    },
    {
      key: "address",
      label: "Adresse",
    },
    {
      key: "totalApartments",
      label: "Nombre de lots",
      type: "number",
    },
    {
      key: "syndic",
      label: "Syndic",
      type: "relation",
    },
  ],

  cardTitle: (item) => item.name || "Résidence",
  cardSubtitle: (item) => `${item.city || ""} • ${item.totalApartments || 0} lots • ${item.address || ""}`,

  canCreate: (role) => role === Role.ADMIN || role === Role.SYNDIC,
  canEdit: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  canDelete: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
};

/* ============================================================ */
/* 3. APPARTEMENTS                                              */
/* ============================================================ */
export const apartmentConfig: ResourceConfig<ApartmentDTO> = {
  key: "apartments",
  label: "Appartement",
  plural: "Appartements",
  apiPath: "/api/apartments",
  entityOfflineKey: "apartment",
  searchPlaceholder: "Rechercher par numéro de lot...",
  defaultSort: "floor,number",

  fields: [
    {
      name: "residence",
      label: "Résidence",
      type: "relation",
      required: true,
      relation: {
        resource: "residences",
        apiPath: "/api/residences",
        labelField: "name",
        valueField: "_id",
      },
    },
    {
      name: "number",
      label: "Numéro de lot / porte",
      type: "text",
      required: true,
      placeholder: "Ex : A101, B204, Lot 12",
    },
    {
      name: "floor",
      label: "Étage",
      type: "number",
      required: true,
      defaultValue: 0,
    },
    {
      name: "surface",
      label: "Surface (m²)",
      type: "number",
      required: true,
      defaultValue: 50,
    },
    {
      name: "shares",
      label: "Tantièmes (parts)",
      type: "number",
      required: true,
      defaultValue: 100,
      helpText: "Quote-part pour la répartition des charges (base légale usuelle : 1 000)",
    },
    {
      name: "isOccupied",
      label: "Lot actuellement occupé",
      type: "boolean",
      defaultValue: true,
    },
    {
      name: "owner",
      label: "Propriétaire du lot",
      type: "relation",
      relation: {
        resource: "users",
        apiPath: "/api/users?role=RESIDENT",
        labelField: "name",
        valueField: "_id",
      },
      helpText:
        "Compte de connexion du résident : il verra ses charges, paiements et annonces. Laisser vide si le lot n'a pas de compte.",
    },
  ],

  listColumns: [
    {
      key: "number",
      label: "N° Lot",
    },
    {
      key: "residence",
      label: "Résidence",
      type: "relation",
    },
    {
      key: "floor",
      label: "Étage",
      type: "number",
    },
    {
      key: "surface",
      label: "Surface (m²)",
      type: "number",
    },
    {
      key: "shares",
      label: "Tantièmes",
      type: "number",
    },
    {
      key: "isOccupied",
      label: "Occupé",
      type: "boolean",
    },
    {
      key: "owner",
      label: "Propriétaire",
      type: "relation",
    },
  ],

  cardTitle: (item) => `Lot n° ${item.number}`,
  cardSubtitle: (item) => {
    const resName =
      item.residence && typeof item.residence === "object"
        ? (item.residence as any).name
        : "Copropriété";
    return `${resName} • Étage ${item.floor} • ${item.surface} m² • ${item.shares} tantièmes`;
  },

  canCreate: (role) => role === Role.ADMIN || role === Role.SYNDIC,
  canEdit: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  canDelete: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
};

/* ============================================================ */
/* 4. RÉSIDENTS                                                 */
/* ============================================================ */
export const residentConfig: ResourceConfig<any> = {
  key: "residents",
  label: "Résident",
  plural: "Résidents",
  apiPath: "/api/residents",
  searchPlaceholder: "Rechercher par nom, email ou téléphone...",
  defaultSort: "fullName",

  fields: [
    {
      name: "apartment",
      label: "Appartement / Lot",
      type: "relation",
      required: true,
      relation: {
        resource: "apartments",
        apiPath: "/api/apartments",
        labelField: "number",
        valueField: "_id",
      },
    },
    {
      name: "fullName",
      label: "Nom et prénom",
      type: "text",
      required: true,
      placeholder: "Ex : Jean Dupont",
    },
    {
      name: "type",
      label: "Statut d'occupation",
      type: "select",
      required: true,
      defaultValue: "TENANT",
      options: [
        { label: "Propriétaire", value: "OWNER" },
        { label: "Locataire", value: "TENANT" },
      ],
    },
    {
      name: "email",
      label: "Adresse email",
      type: "text",
      placeholder: "Ex : jean.dupont@email.com",
    },
    {
      name: "phone",
      label: "Téléphone",
      type: "text",
      placeholder: "Ex : 06 12 34 56 78",
    },
    {
      name: "moveInDate",
      label: "Date d'emménagement",
      type: "date",
      required: true,
    },
    {
      name: "isActive",
      label: "Résident actuellement actif",
      type: "boolean",
      defaultValue: true,
    },
  ],

  listColumns: [
    {
      key: "fullName",
      label: "Nom",
    },
    {
      key: "apartment",
      label: "Lot",
      type: "relation",
      render: (val: any) => (val?.number ? `Lot ${val.number}` : "—"),
    },
    {
      key: "type",
      label: "Statut",
      render: (val: string) => {
        const labels: Record<string, string> = {
          TENANT: "Locataire",
          OWNER: "Propriétaire",
        };
        return labels[val] || val || "—";
      },
    },
    {
      key: "email",
      label: "Email",
    },
    {
      key: "phone",
      label: "Téléphone",
    },
    {
      key: "isActive",
      label: "Actif",
      type: "boolean",
    },
  ],

  cardTitle: (item) => item.fullName || "Résident",
  cardSubtitle: (item) => {
    const aptNumber =
      item.apartment && typeof item.apartment === "object"
        ? `Lot ${item.apartment.number}`
        : "Appartement";
    return `${aptNumber} • ${item.phone || item.email || item.type || ""}`;
  },

  canCreate: (role) => role === Role.ADMIN || role === Role.SYNDIC,
  canEdit: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  canDelete: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  filterDefs: [
    {
      key: "type",
      label: "Type",
      type: "select",
      options: [
        { value: "OWNER", label: "Propriétaire" },
        { value: "TENANT", label: "Locataire" },
      ],
    },
    {
      key: "isActive",
      label: "Actif",
      type: "boolean",
    },
  ],
  exportPath: "/api/residents/export",
};

/* ============================================================ */
/* 5. CHARGES                                                   */
/* ============================================================ */
export const chargeConfig: ResourceConfig<ChargeDTO> = {
  key: "charges",
  label: "Charge",
  plural: "Charges",
  apiPath: "/api/charges",
  entityOfflineKey: "charge",
  searchPlaceholder: "Rechercher par période (ex: 2026-10)...",
  defaultSort: "-period",

  fields: [
    {
      name: "apartment",
      label: "Appartement / Lot",
      type: "relation",
      required: true,
      relation: {
        resource: "apartments",
        apiPath: "/api/apartments",
        labelField: "number",
        valueField: "_id",
      },
    },
    {
      name: "period",
      label: "Période (AAAA-MM)",
      type: "text",
      required: true,
      placeholder: "Ex : 2026-10",
    },
    {
      name: "amount",
      label: "Montant appelé (€)",
      type: "number",
      required: true,
      defaultValue: 150,
    },
    {
      name: "dueDate",
      label: "Date d'échéance",
      type: "date",
      required: true,
    },
  ],

  listColumns: [
    {
      key: "apartment",
      label: "Lot",
      type: "relation",
      render: (val: any) => (val?.number ? `Lot ${val.number}` : "—"),
    },
    {
      key: "period",
      label: "Période",
    },
    {
      key: "amount",
      label: "Appelé",
      render: (val: number) => `${(val || 0).toFixed(2)} €`,
    },
    {
      key: "paidAmount",
      label: "Réglé",
      render: (val: number) => `${(val || 0).toFixed(2)} €`,
    },
    {
      key: "status",
      label: "Statut",
      type: "badge",
      render: (val: string) => {
        const labels: Record<string, { text: string; bg: string }> = {
          PAID: { text: "Payé", bg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
          PARTIAL: { text: "Partiel", bg: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" },
          PENDING: { text: "En attente", bg: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400" },
          OVERDUE: { text: "En retard", bg: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400" },
        };
        const item = labels[val] || { text: val, bg: "bg-slate-100 text-slate-700" };
        return (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${item.bg}`}>
            {item.text}
          </span>
        );
      },
    },
    {
      key: "dueDate",
      label: "Échéance",
      type: "date",
    },
  ],

  cardTitle: (item) => {
    const aptNumber =
      item.apartment && typeof item.apartment === "object"
        ? (item.apartment as any).number
        : "N/A";
    return `Charge ${item.period} • Lot ${aptNumber}`;
  },
  cardSubtitle: (item) =>
    `${(item.amount || 0).toFixed(2)} € appelés • ${(item.paidAmount || 0).toFixed(2)} € réglés (reste : ${Math.max(
      0,
      (item.amount || 0) - (item.paidAmount || 0)
    ).toFixed(2)} €)`,

  canCreate: (role) => role === Role.ADMIN || role === Role.SYNDIC,
  canEdit: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  canDelete: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  filterDefs: [
    {
      key: "period",
      label: "Période",
      type: "month",
    },
    {
      key: "status",
      label: "Statut",
      type: "select",
      options: [
        { value: "PENDING", label: "En attente" },
        { value: "PARTIAL", label: "Partiel" },
        { value: "PAID", label: "Payé" },
        { value: "OVERDUE", label: "En retard" },
      ],
    },
  ],
  sortOptions: [
    { value: "dueDate:asc", label: "Échéance proche" },
    { value: "dueDate:desc", label: "Échéance lointaine" },
  ],
  exportPath: "/api/charges/export",
};

/* ============================================================ */
/* 6. PAIEMENTS                                                 */
/* ============================================================ */
export const paymentConfig: ResourceConfig<PaymentDTO> = {
  key: "payments",
  label: "Paiement",
  plural: "Paiements",
  apiPath: "/api/payments",
  entityOfflineKey: "payment",
  searchPlaceholder: "Rechercher par n° de reçu (REC-...)...",
  defaultSort: "-paymentDate",

  fields: [
    {
      name: "charge",
      label: "Charge à régler",
      type: "relation",
      required: true,
      relation: {
        resource: "charges",
        apiPath: "/api/charges",
        labelField: "period",
        valueField: "_id",
      },
    },
    {
      name: "amount",
      label: "Montant encaissé (€)",
      type: "number",
      required: true,
    },
    {
      name: "method",
      label: "Mode de règlement",
      type: "select",
      required: true,
      defaultValue: "BANK_TRANSFER",
      options: [
        { label: "Espèces", value: "CASH" },
        { label: "Virement bancaire", value: "BANK_TRANSFER" },
        { label: "Chèque", value: "CHEQUE" },
        { label: "Carte bancaire", value: "CARD" },
      ],
    },
    {
      name: "paymentDate",
      label: "Date de règlement",
      type: "date",
    },
    {
      name: "receiptNumber",
      label: "Numéro de reçu",
      type: "text",
      placeholder: "Laissez vide pour auto-génération (REC-YYYY-NNNN)",
      helpText: "Auto-généré sous le format REC-YYYY-NNNN si non renseigné",
    },
  ],

  listColumns: [
    {
      key: "receiptNumber",
      label: "N° Reçu",
    },
    {
      key: "amount",
      label: "Montant",
      render: (val: number) => (
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
          {(val || 0).toFixed(2)} €
        </span>
      ),
    },
    {
      key: "method",
      label: "Mode",
      render: (val: string) => {
        const labels: Record<string, string> = {
          BANK_TRANSFER: "Virement",
          CHEQUE: "Chèque",
          CASH: "Espèces",
          CARD: "Carte",
        };
        return labels[val] || val || "—";
      },
    },
    {
      key: "paymentDate",
      label: "Date",
      type: "date",
    },
  ],

  cardTitle: (item) => item.receiptNumber || "Paiement",
  cardSubtitle: (item) =>
    `${(item.amount || 0).toFixed(2)} € réglés par ${item.method} le ${new Date(
      item.paymentDate
    ).toLocaleDateString("fr-FR")}`,

  canCreate: (role) => role === Role.ADMIN || role === Role.SYNDIC,
  canEdit: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  canDelete: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  filterDefs: [
    {
      key: "method",
      label: "Mode",
      type: "select",
      options: [
        { value: "CASH", label: "Espèces" },
        { value: "BANK_TRANSFER", label: "Virement" },
        { value: "CHEQUE", label: "Chèque" },
        { value: "CARD", label: "Carte" },
      ],
    },
    {
      key: "dates",
      label: "Période de paiement",
      type: "dateRange",
    },
  ],
  sortOptions: [
    { value: "paymentDate:desc", label: "Plus récents" },
    { value: "paymentDate:asc", label: "Plus anciens" },
  ],
  exportPath: "/api/payments/export",
  rowLinks: [
    {
      label: "Reçu PDF",
      href: (item) => `/api/payments/${item._id}/receipt`,
      roles: ["ADMIN", "SYNDIC", "RESIDENT"],
    },
  ],
};

/* ============================================================ */
/* 7. DÉPENSES                                                  */
/* ============================================================ */
export const expenseConfig: ResourceConfig<ExpenseDTO> = {
  key: "expenses",
  label: "Dépense",
  plural: "Dépenses",
  apiPath: "/api/expenses",
  searchPlaceholder: "Rechercher par description ou libellé...",
  defaultSort: "-expenseDate",

  fields: [
    {
      name: "residence",
      label: "Résidence",
      type: "relation",
      required: true,
      relation: {
        resource: "residences",
        apiPath: "/api/residences",
        labelField: "name",
        valueField: "_id",
      },
    },
    {
      name: "category",
      label: "Catégorie",
      type: "select",
      required: true,
      defaultValue: "MAINTENANCE",
      options: [
        { label: "Eau", value: "WATER" },
        { label: "Électricité", value: "ELECTRICITY" },
        { label: "Ascenseur", value: "ELEVATOR" },
        { label: "Nettoyage", value: "CLEANING" },
        { label: "Sécurité", value: "SECURITY" },
        { label: "Entretien / Maintenance", value: "MAINTENANCE" },
        { label: "Autre", value: "OTHER" },
      ],
    },
    {
      name: "description",
      label: "Libellé de la dépense",
      type: "text",
      required: true,
      placeholder: "Ex : Réparation ascenseur, Facture EDF parties communes...",
    },
    {
      name: "amount",
      label: "Montant TTC (€)",
      type: "number",
      required: true,
      defaultValue: 0,
    },
    {
      name: "expenseDate",
      label: "Date de la facture",
      type: "date",
      required: true,
    },
    {
      name: "proofUrl",
      label: "Lien justificatif (URL)",
      type: "text",
      placeholder: "https://...",
    },
  ],

  listColumns: [
    {
      key: "description",
      label: "Description",
    },
    {
      key: "residence",
      label: "Résidence",
      type: "relation",
    },
    {
      key: "category",
      label: "Catégorie",
    },
    {
      key: "amount",
      label: "Montant",
      render: (val: number) => (
        <span className="font-semibold text-rose-600 dark:text-rose-400">
          {(val || 0).toFixed(2)} €
        </span>
      ),
    },
    {
      key: "expenseDate",
      label: "Date",
      type: "date",
    },
  ],

  cardTitle: (item) => item.description || "Dépense",
  cardSubtitle: (item) =>
    `${(item.amount || 0).toFixed(2)} € • ${item.category} • ${new Date(
      item.expenseDate
    ).toLocaleDateString("fr-FR")}`,

  canCreate: (role) => role === Role.ADMIN || role === Role.SYNDIC,
  canEdit: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  canDelete: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  filterDefs: [
    {
      key: "category",
      label: "Catégorie",
      type: "select",
      options: [
        { value: "WATER", label: "Eau" },
        { value: "ELECTRICITY", label: "Électricité" },
        { value: "ELEVATOR", label: "Ascenseur" },
        { value: "CLEANING", label: "Nettoyage" },
        { value: "SECURITY", label: "Sécurité" },
        { value: "MAINTENANCE", label: "Maintenance" },
        { value: "OTHER", label: "Autre" },
      ],
    },
    {
      key: "dates",
      label: "Période",
      type: "dateRange",
    },
  ],
  sortOptions: [
    { value: "expenseDate:desc", label: "Plus récentes" },
    { value: "expenseDate:asc", label: "Plus anciennes" },
  ],
  exportPath: "/api/expenses/export",
};

/* ============================================================ */
/* 8. INCIDENTS                                                 */
/* ============================================================ */
export const incidentConfig: ResourceConfig<IncidentDTO> = {
  key: "incidents",
  label: "Incident",
  plural: "Incidents",
  apiPath: "/api/incidents",
  entityOfflineKey: "incident",
  searchPlaceholder: "Rechercher par titre ou description...",
  defaultSort: "-reportedAt",

  fields: [
    {
      name: "residence",
      label: "Résidence concernée",
      type: "relation",
      required: true,
      relation: {
        resource: "residences",
        apiPath: "/api/residences",
        labelField: "name",
        valueField: "_id",
      },
    },
    {
      name: "apartment",
      label: "Appartement / Lot (facultatif)",
      type: "relation",
      relation: {
        resource: "apartments",
        apiPath: "/api/apartments",
        labelField: "number",
        valueField: "_id",
      },
    },
    {
      name: "title",
      label: "Titre de l'incident",
      type: "text",
      required: true,
      placeholder: "Ex : Fuite d'eau cage d'escalier B",
    },
    {
      name: "category",
      label: "Catégorie",
      type: "select",
      required: true,
      defaultValue: "PLUMBING",
      options: [
        { label: "Plomberie", value: "PLUMBING" },
        { label: "Électricité", value: "ELECTRICITY" },
        { label: "Ascenseur", value: "ELEVATOR" },
        { label: "Nettoyage", value: "CLEANING" },
        { label: "Sécurité", value: "SECURITY" },
        { label: "Autre", value: "OTHER" },
      ],
    },
    {
      name: "priority",
      label: "Priorité",
      type: "select",
      required: true,
      defaultValue: "MEDIUM",
      options: [
        { label: "Basse", value: "LOW" },
        { label: "Moyenne", value: "MEDIUM" },
        { label: "Haute", value: "HIGH" },
        { label: "Urgente", value: "URGENT" },
      ],
    },
    {
      name: "description",
      label: "Description détaillée",
      type: "textarea",
      required: true,
      placeholder: "Décrivez précisément le lieu et les constatations...",
    },
  ],

  listColumns: [
    {
      key: "title",
      label: "Incident",
    },
    {
      key: "residence",
      label: "Résidence",
      type: "relation",
    },
    {
      key: "category",
      label: "Catégorie",
    },
    {
      key: "priority",
      label: "Priorité",
      type: "badge",
    },
    {
      key: "status",
      label: "Statut",
      type: "badge",
      render: (val: string) => {
        const labels: Record<string, { text: string; bg: string }> = {
          REPORTED: { text: "Signalé", bg: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400" },
          ASSIGNED: { text: "Assigné", bg: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" },
          IN_PROGRESS: { text: "En cours", bg: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400" },
          RESOLVED: { text: "Résolu", bg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
        };
        const item = labels[val] || { text: val, bg: "bg-slate-100 text-slate-700" };
        return (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${item.bg}`}>
            {item.text}
          </span>
        );
      },
    },
    {
      key: "reportedAt",
      label: "Signalé le",
      type: "date",
    },
  ],

  cardTitle: (item) => item.title || "Incident",
  cardSubtitle: (item) =>
    `${item.category} • ${item.priority} • ${item.description}`,

  canCreate: () => true, // Tous les rôles peuvent créer
  canEdit: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  canDelete: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  filterDefs: [
    {
      key: "status",
      label: "Statut",
      type: "select",
      options: [
        { value: "REPORTED", label: "Signalé" },
        { value: "ASSIGNED", label: "Assigné" },
        { value: "IN_PROGRESS", label: "En cours" },
        { value: "RESOLVED", label: "Résolu" },
      ],
    },
    {
      key: "priority",
      label: "Priorité",
      type: "select",
      options: [
        { value: "LOW", label: "Basse" },
        { value: "MEDIUM", label: "Moyenne" },
        { value: "HIGH", label: "Haute" },
        { value: "URGENT", label: "Urgente" },
      ],
    },
    {
      key: "category",
      label: "Catégorie",
      type: "select",
      options: [
        { value: "PLUMBING", label: "Plomberie" },
        { value: "ELECTRICITY", label: "Électricité" },
        { value: "ELEVATOR", label: "Ascenseur" },
        { value: "CLEANING", label: "Nettoyage" },
        { value: "SECURITY", label: "Sécurité" },
        { value: "OTHER", label: "Autre" },
      ],
    },
  ],
  sortOptions: [
    { value: "reportedAt:desc", label: "Plus récents" },
    { value: "reportedAt:asc", label: "Plus anciens" },
  ],
};

/* ============================================================ */
/* 9. ASSEMBLÉES GÉNÉRALES (MEETINGS)                         */
/* ============================================================ */
export const meetingConfig: ResourceConfig<MeetingDTO> = {
  key: "meetings",
  label: "Assemblée Générale",
  plural: "Assemblées Générales",
  apiPath: "/api/meetings",
  searchPlaceholder: "Rechercher par titre ou lieu...",
  defaultSort: "-date",

  fields: [
    {
      name: "residence",
      label: "Résidence",
      type: "relation",
      required: true,
      relation: {
        resource: "residences",
        apiPath: "/api/residences",
        labelField: "name",
        valueField: "_id",
      },
    },
    {
      name: "title",
      label: "Titre de l'AG",
      type: "text",
      required: true,
      placeholder: "Ex : AG Ordinaire 2026",
    },
    {
      name: "date",
      label: "Date et heure",
      type: "date",
      required: true,
    },
    {
      name: "location",
      label: "Lieu",
      type: "text",
      placeholder: "Ex : Salle commune ou visioconférence",
    },
    {
      name: "status",
      label: "Statut",
      type: "select",
      required: true,
      defaultValue: "PLANNED",
      options: [
        { label: "Planifiée", value: "PLANNED" },
        { label: "Ouverte (Votes autorisés)", value: "OPEN" },
        { label: "Clôturée", value: "CLOSED" },
      ],
    },
    {
      name: "agenda",
      label: "Ordre du jour",
      type: "textarea",
      placeholder: "Détaillez les points à l'ordre du jour...",
    },
  ],

  listColumns: [
    {
      key: "title",
      label: "Titre",
    },
    {
      key: "residence",
      label: "Résidence",
      type: "relation",
    },
    {
      key: "date",
      label: "Date",
      type: "date",
    },
    {
      key: "status",
      label: "Statut",
      type: "badge",
      render: (val: string) => {
        const badges: Record<string, { text: string; bg: string }> = {
          PLANNED: { text: "Planifiée", bg: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
          OPEN: { text: "Ouverte aux votes", bg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
          CLOSED: { text: "Clôturée", bg: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400" },
        };
        const item = badges[val] || { text: val, bg: "bg-slate-100 text-slate-700" };
        return (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${item.bg}`}>
            {item.text}
          </span>
        );
      },
    },
    {
      key: "location",
      label: "Lieu",
    },
  ],

  cardTitle: (item) => item.title || "Assemblée Générale",
  cardSubtitle: (item) =>
    `${item.status} • ${new Date(item.date).toLocaleDateString("fr-FR")} • ${item.location || "Lieu non précisé"}`,

  canCreate: (role) => role === Role.ADMIN || role === Role.SYNDIC,
  canEdit: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  canDelete: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
};

/* ============================================================ */
/* 10. RÉSOLUTIONS                                              */
/* ============================================================ */
export const resolutionConfig: ResourceConfig<ResolutionDTO> = {
  key: "resolutions",
  label: "Résolution",
  plural: "Résolutions",
  apiPath: "/api/resolutions",
  searchPlaceholder: "Rechercher une résolution...",
  defaultSort: "-createdAt",

  fields: [
    {
      name: "meeting",
      label: "Assemblée Générale",
      type: "relation",
      required: true,
      relation: {
        resource: "meetings",
        apiPath: "/api/meetings",
        labelField: "title",
        valueField: "_id",
      },
    },
    {
      name: "title",
      label: "Titre de la résolution",
      type: "text",
      required: true,
      placeholder: "Ex : Approbation des comptes de l'exercice 2025",
    },
    {
      name: "requiredMajority",
      label: "Majorité requise (%)",
      type: "number",
      required: true,
      defaultValue: 50,
      min: 0,
      max: 100,
    },
    {
      name: "description",
      label: "Description détaillée",
      type: "textarea",
      placeholder: "Texte complet soumis au vote des copropriétaires...",
    },
  ],

  listColumns: [
    {
      key: "title",
      label: "Titre",
    },
    {
      key: "meeting",
      label: "Assemblée",
      type: "relation",
      render: (m: any) => m?.title || "—",
    },
    {
      key: "requiredMajority",
      label: "Majorité",
      render: (val: number) => (
        <span className="font-semibold text-slate-700 dark:text-slate-300">
          {val ?? 50} %
        </span>
      ),
    },
  ],

  cardTitle: (item) => item.title || "Résolution",
  cardSubtitle: (item) =>
    `Majorité ${item.requiredMajority}% • ${item.description || "Aucune description"}`,

  canCreate: (role) => role === Role.ADMIN || role === Role.SYNDIC,
  canEdit: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  canDelete: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
};

/* ============================================================ */
/* 11. VOTES                                                    */
/* ============================================================ */
export const voteConfig: ResourceConfig<VoteDTO> = {
  key: "votes",
  label: "Vote",
  plural: "Votes",
  apiPath: "/api/votes",
  searchPlaceholder: "Rechercher par choix...",
  defaultSort: "-votedAt",

  fields: [
    {
      name: "resolution",
      label: "Résolution",
      type: "relation",
      required: true,
      relation: {
        resource: "resolutions",
        apiPath: "/api/resolutions",
        labelField: "title",
        valueField: "_id",
      },
    },
    {
      name: "apartment",
      label: "Lot votant",
      type: "relation",
      required: true,
      relation: {
        resource: "apartments",
        apiPath: "/api/apartments",
        labelField: "number",
        valueField: "_id",
      },
    },
    {
      name: "choice",
      label: "Choix du vote",
      type: "select",
      required: true,
      options: [
        { label: "POUR (FOR)", value: "FOR" },
        { label: "CONTRE (AGAINST)", value: "AGAINST" },
        { label: "ABSTENTION (ABSTAIN)", value: "ABSTAIN" },
      ],
    },
  ],

  listColumns: [
    {
      key: "resolution",
      label: "Résolution",
      type: "relation",
      render: (r: any) => r?.title || "—",
    },
    {
      key: "apartment",
      label: "Lot",
      type: "relation",
      render: (a: any) => (a?.number ? `Lot ${a.number}` : "—"),
    },
    {
      key: "choice",
      label: "Vote",
      render: (val: string) => {
        const styles: Record<string, { label: string; cls: string }> = {
          FOR: { label: "POUR", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
          AGAINST: { label: "CONTRE", cls: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400" },
          ABSTAIN: { label: "ABSTENTION", cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
        };
        const s = styles[val] || { label: val, cls: "bg-slate-100 text-slate-700" };
        return (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${s.cls}`}>
            {s.label}
          </span>
        );
      },
    },
    {
      key: "weight",
      label: "Tantièmes",
      render: (val: number) => <span className="font-semibold">{val} / 1000</span>,
    },
    {
      key: "votedAt",
      label: "Date",
      type: "date",
    },
  ],

  cardTitle: (item) => `Vote : ${item.choice}`,
  cardSubtitle: (item) => `Poids : ${item.weight} tantièmes`,

  canCreate: () => true, // Tous les rôles votants
  canEdit: (_item, role) => role === Role.ADMIN,
  canDelete: (_item, role) => role === Role.ADMIN,
};

/* ============================================================ */
/* 12. DOCUMENTS                                                */
/* ============================================================ */
export const documentConfig: ResourceConfig<DocumentDTO> = {
  key: "documents",
  label: "Document",
  plural: "Documents",
  apiPath: "/api/documents",
  searchPlaceholder: "Rechercher par titre...",
  defaultSort: "-uploadedAt",

  fields: [
    {
      name: "residence",
      label: "Résidence",
      type: "relation",
      required: true,
      relation: {
        resource: "residences",
        apiPath: "/api/residences",
        labelField: "name",
        valueField: "_id",
      },
    },
    {
      name: "meeting",
      label: "Assemblée Générale liée (facultatif)",
      type: "relation",
      relation: {
        resource: "meetings",
        apiPath: "/api/meetings",
        labelField: "title",
        valueField: "_id",
      },
    },
    {
      name: "title",
      label: "Nom du document",
      type: "text",
      required: true,
      placeholder: "Ex : Procès-Verbal AG 2026, Règlement de copropriété",
    },
    {
      name: "type",
      label: "Type de document",
      type: "select",
      required: true,
      defaultValue: "OTHER",
      options: [
        { label: "Procès-verbal d'assemblée", value: "MINUTES" },
        { label: "Règlement de copropriété", value: "RULES" },
        { label: "Contrat", value: "CONTRACT" },
        { label: "Facture", value: "INVOICE" },
        { label: "Autre", value: "OTHER" },
      ],
    },
    {
      name: "fileUrl",
      label: "URL du fichier",
      type: "text",
      required: true,
      placeholder: "/uploads/... ou URL",
    },
  ],

  listColumns: [
    {
      key: "title",
      label: "Titre",
    },
    {
      key: "residence",
      label: "Résidence",
      type: "relation",
    },
    {
      key: "type",
      label: "Catégorie",
    },
    {
      key: "fileUrl",
      label: "Fichier",
      render: (val: string) => (
        <a
          href={val}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-600 underline hover:text-sky-700 dark:text-sky-400"
        >
          Ouvrir le fichier
        </a>
      ),
    },
    {
      key: "uploadedAt",
      label: "Déposé le",
      type: "date",
    },
  ],

  cardTitle: (item) => item.title || "Document",
  cardSubtitle: (item) => `${item.type} • Déposé le ${new Date(item.uploadedAt).toLocaleDateString("fr-FR")}`,

  canCreate: (role) => role === Role.ADMIN || role === Role.SYNDIC,
  canEdit: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  canDelete: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
};

/* ============================================================ */
/* 13. UTILISATEURS (USERS)                                     */
/* ============================================================ */
export const userConfig: ResourceConfig<UserDTO> = {
  key: "users",
  label: "Utilisateur",
  plural: "Utilisateurs",
  apiPath: "/api/users",
  searchPlaceholder: "Rechercher par nom ou email...",
  defaultSort: "-createdAt",

  fields: [
    {
      name: "name",
      label: "Nom complet",
      type: "text",
      required: true,
      placeholder: "Ex : Jean Dupont",
    },
    {
      name: "email",
      label: "Adresse email",
      type: "text",
      required: true,
      placeholder: "jean.dupont@example.com",
    },
    {
      name: "password",
      label: "Mot de passe (création)",
      type: "text",
      placeholder: "Minimum 6 caractères",
    },
    {
      name: "phone",
      label: "Téléphone",
      type: "text",
      placeholder: "+33 6 12 34 56 78",
    },
    {
      name: "role",
      label: "Rôle dans SyndicPro",
      type: "select",
      required: true,
      defaultValue: "RESIDENT",
      options: [
        { label: "Résident / Copropriétaire", value: "RESIDENT" },
        { label: "Technicien d'intervention", value: "TECHNICIAN" },
        { label: "Syndic gestionnaire", value: "SYNDIC" },
        { label: "Administrateur système", value: "ADMIN" },
      ],
    },
    {
      name: "isActive",
      label: "Compte actif",
      type: "boolean",
      defaultValue: true,
    },
  ],

  listColumns: [
    {
      key: "name",
      label: "Nom",
    },
    {
      key: "email",
      label: "Email",
    },
    {
      key: "role",
      label: "Rôle",
      type: "badge",
      render: (val: string) => {
        const badges: Record<string, { label: string; cls: string }> = {
          ADMIN: { label: "Admin", cls: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400" },
          SYNDIC: { label: "Syndic", cls: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400" },
          TECHNICIAN: { label: "Technicien", cls: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" },
          RESIDENT: { label: "Résident", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
        };
        const b = badges[val] || { label: val, cls: "bg-slate-100 text-slate-700" };
        return (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${b.cls}`}>
            {b.label}
          </span>
        );
      },
    },
    {
      key: "phone",
      label: "Téléphone",
    },
    {
      key: "isActive",
      label: "Statut",
      type: "boolean",
      render: (val: boolean) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
            val !== false
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          }`}
        >
          {val !== false ? "Actif" : "Désactivé"}
        </span>
      ),
    },
  ],

  cardTitle: (item) => item.name || "Utilisateur",
  cardSubtitle: (item) => `${item.role} • ${item.email} • ${item.isActive !== false ? "Actif" : "Désactivé"}`,

  canCreate: (role) => role === Role.ADMIN || role === Role.SYNDIC,
  canEdit: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  canDelete: (_item, role) => role === Role.ADMIN,
};

export const resourcesRegistry = {
  announcements: announcementConfig,
  residences: residenceConfig,
  apartments: apartmentConfig,
  residents: residentConfig,
  charges: chargeConfig,
  payments: paymentConfig,
  expenses: expenseConfig,
  incidents: incidentConfig,
  meetings: meetingConfig,
  resolutions: resolutionConfig,
  votes: voteConfig,
  documents: documentConfig,
  users: userConfig,
};


