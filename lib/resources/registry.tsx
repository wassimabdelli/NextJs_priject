import {
  Role,
  EmployeePosition,
  ContractType,
  ShiftStatus,
  LeaveType,
  LeaveStatus,
} from "@/types/enums";
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
        apiPath: "/api/users?role=OWNER",
        labelField: "name",
        valueField: "_id",
      },
      helpText:
        "Compte de connexion du propriétaire : il verra ses charges, paiements et annonces. Laisser vide si le lot n'a pas de compte.",
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
        { label: "Locataire", value: "TENANT" },
        { label: "Propriétaire", value: "OWNER" },
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
      roles: ["ADMIN", "SYNDIC", "OWNER", "TENANT"],
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

  rowLinks: [
    {
      label: "Pack AG (ODJ · Quorum · PV)",
      href: (item) => `/meetings/${item._id}`,
      roles: ["ADMIN", "SYNDIC", "OWNER"],
    },
  ],

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
      defaultValue: "OWNER",
      options: [
        { label: "Propriétaire", value: "OWNER" },
        { label: "Locataire", value: "TENANT" },
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
          OWNER: { label: "Propriétaire", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
          TENANT: { label: "Locataire", cls: "bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400" },
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

/* ============================================================ */
/* ÉQUIPEMENTS                                                  */
/* ============================================================ */
const EQUIPMENT_CATEGORIES = [
  { label: "Ascenseur", value: "ELEVATOR" },
  { label: "Pompe", value: "PUMP" },
  { label: "Groupe électrogène", value: "GENERATOR" },
  { label: "Électricité", value: "ELECTRICAL" },
  { label: "Plomberie", value: "PLUMBING" },
  { label: "Sécurité incendie", value: "FIRE_SAFETY" },
  { label: "Contrôle d'accès", value: "ACCESS_CONTROL" },
  { label: "Caméra", value: "CAMERA" },
  { label: "Espaces verts", value: "GARDEN" },
  { label: "Autre", value: "OTHER" },
];

const EQUIPMENT_STATUSES = [
  { label: "Opérationnel", value: "OPERATIONAL" },
  { label: "En panne", value: "BROKEN" },
  { label: "En maintenance", value: "UNDER_MAINTENANCE" },
  { label: "Hors service", value: "OUT_OF_SERVICE" },
];

const equipmentCategoryLabel = (v: string) =>
  EQUIPMENT_CATEGORIES.find((c) => c.value === v)?.label ?? v;

const daysUntil = (d?: string | Date | null) =>
  d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null;

export const equipmentConfig: ResourceConfig<any> = {
  key: "equipment",
  label: "Équipement",
  plural: "Équipements",
  apiPath: "/api/equipment",
  searchPlaceholder: "Rechercher un équipement, un emplacement, un n° de série...",
  defaultSort: "name",
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
      name: "name",
      label: "Nom de l'équipement",
      type: "text",
      required: true,
      placeholder: "Ex : Ascenseur bâtiment A",
    },
    {
      name: "category",
      label: "Catégorie",
      type: "select",
      required: true,
      options: EQUIPMENT_CATEGORIES,
      defaultValue: "ELEVATOR",
    },
    {
      name: "location",
      label: "Emplacement",
      type: "text",
      placeholder: "Ex : Hall, sous-sol, toit",
    },
    {
      name: "serialNumber",
      label: "N° de série",
      type: "text",
    },
    {
      name: "purchaseDate",
      label: "Date d'achat",
      type: "date",
    },
    {
      name: "warrantyEndDate",
      label: "Fin de garantie",
      type: "date",
    },
    {
      name: "status",
      label: "État",
      type: "select",
      options: EQUIPMENT_STATUSES,
      defaultValue: "OPERATIONAL",
      helpText: "Passe automatiquement en panne quand une intervention corrective est ouverte",
    },
    {
      name: "maintenanceIntervalDays",
      label: "Fréquence d'entretien (jours)",
      type: "number",
      min: 0,
      defaultValue: 0,
      helpText: "0 = pas d'entretien périodique",
    },
    {
      name: "lastMaintenanceDate",
      label: "Dernier entretien",
      type: "date",
    },
    {
      name: "provider",
      label: "Prestataire / fournisseur",
      type: "text",
    },
    {
      name: "notes",
      label: "Notes",
      type: "textarea",
    },
  ],
  listColumns: [
    { key: "name", label: "Équipement" },
    { key: "category", label: "Catégorie", render: (v) => equipmentCategoryLabel(v) },
    { key: "residence", label: "Résidence", type: "relation" },
    { key: "status", label: "État", type: "badge" },
    {
      key: "nextMaintenanceDate",
      label: "Prochain entretien",
      render: (v) => {
        if (!v) return "—";
        const formatted = new Date(v).toLocaleDateString("fr-FR");
        const days = daysUntil(v);
        if (days !== null && days < 0) {
          return <span className="text-rose-600">{formatted} (en retard)</span>;
        }
        return formatted;
      },
    },
    {
      key: "warrantyEndDate",
      label: "Garantie",
      render: (v) => {
        if (!v) return "—";
        const formatted = new Date(v).toLocaleDateString("fr-FR");
        const days = daysUntil(v);
        if (days !== null && days < 0) {
          return <span className="text-rose-600">{formatted} (expirée)</span>;
        }
        if (days !== null && days >= 0 && days <= 30) {
          return <span className="text-amber-600">{formatted} (bientôt)</span>;
        }
        return formatted;
      },
    },
  ],
  cardTitle: (item) => item.name || "Équipement",
  cardSubtitle: (item) =>
    `${equipmentCategoryLabel(item.category)} • ${item.location || "Emplacement non précisé"}`,
  badgeField: {
    name: "status",
    variantMap: {
      OPERATIONAL: { label: "Opérationnel", color: "success" },
      BROKEN: { label: "En panne", color: "danger" },
      UNDER_MAINTENANCE: { label: "En maintenance", color: "warning" },
      OUT_OF_SERVICE: { label: "Hors service", color: "default" },
    },
  },
  canCreate: (role) => role === Role.ADMIN || role === Role.SYNDIC,
  canEdit: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  canDelete: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  filterDefs: [
    { key: "category", label: "Catégorie", type: "select", options: EQUIPMENT_CATEGORIES },
    { key: "status", label: "État", type: "select", options: EQUIPMENT_STATUSES },
  ],
  sortOptions: [
    { value: "name:asc", label: "Nom (A → Z)" },
    { value: "nextMaintenanceDate:asc", label: "Entretien le plus proche" },
    { value: "warrantyEndDate:asc", label: "Fin de garantie la plus proche" },
  ],
};

/* ============================================================ */
/* STOCK & CONSOMMABLES                                         */
/* ============================================================ */
const STOCK_CATEGORIES = [
  { label: "Électricité & Éclairage", value: "ELECTRICAL" },
  { label: "Plomberie & Sanitaire", value: "PLUMBING" },
  { label: "Entretien & Nettoyage", value: "CLEANING" },
  { label: "Quincaillerie & Outillage", value: "HARDWARE" },
  { label: "Sécurité & Accès", value: "SECURITY" },
  { label: "Espaces verts", value: "GARDEN" },
  { label: "Autre", value: "OTHER" },
];

const stockCategoryLabel = (v: string) =>
  STOCK_CATEGORIES.find((c) => c.value === v)?.label ?? v;

export const stockConfig: ResourceConfig<any> = {
  key: "stock",
  label: "Article de stock",
  plural: "Stock & Consommables",
  apiPath: "/api/stock/items",
  searchPlaceholder: "Rechercher un article ou consommable...",
  defaultSort: "name:asc",
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
      name: "name",
      label: "Nom de l'article",
      type: "text",
      required: true,
      placeholder: "Ex : Ampoule LED E27, Produit nettoyant sol",
    },
    {
      name: "category",
      label: "Catégorie",
      type: "select",
      required: true,
      options: STOCK_CATEGORIES,
      defaultValue: "ELECTRICAL",
    },
    {
      name: "quantity",
      label: "Quantité en stock",
      type: "number",
      required: true,
      min: 0,
      defaultValue: 0,
    },
    {
      name: "minQuantity",
      label: "Seuil d'alerte (stock minimum)",
      type: "number",
      min: 0,
      defaultValue: 5,
      helpText: "Affiche une alerte « Stock bas » lorsque la quantité est inférieure ou égale à ce seuil",
    },
    {
      name: "unit",
      label: "Unité",
      type: "text",
      defaultValue: "unité",
      placeholder: "Ex : unité, boîte, litre, rouleau",
    },
    {
      name: "notes",
      label: "Notes / Emplacement",
      type: "textarea",
      placeholder: "Ex : Local technique sous-sol B, étagère 2",
    },
  ],
  listColumns: [
    { key: "name", label: "Article" },
    {
      key: "category",
      label: "Catégorie",
      render: (v: string) => stockCategoryLabel(v),
    },
    { key: "residence", label: "Résidence", type: "relation" },
    {
      key: "quantity",
      label: "Quantité",
      render: (val: number, item: any) => {
        const qty = val ?? 0;
        const minQty = item?.minQuantity ?? 0;
        const isLow = qty <= minQty;
        return (
          <div className="flex items-center gap-2">
            <span
              className={`font-bold ${
                isLow
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-slate-900 dark:text-white"
              }`}
            >
              {qty} {item?.unit || ""}
            </span>
            {isLow && (
              <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                Stock bas
              </span>
            )}
          </div>
        );
      },
    },
    { key: "minQuantity", label: "Seuil min.", type: "number" },
    { key: "unit", label: "Unité" },
  ],
  cardTitle: (item) => item.name || "Article",
  cardSubtitle: (item) =>
    `${stockCategoryLabel(item.category)} • Stock : ${item.quantity ?? 0} ${
      item.unit || "unité"
    } (seuil : ${item.minQuantity ?? 0})`,
  canCreate: (role) => role === Role.ADMIN || role === Role.SYNDIC,
  canEdit: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  canDelete: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  filterDefs: [
    { key: "category", label: "Catégorie", type: "select", options: STOCK_CATEGORIES },
    { key: "lowStock", label: "Stock bas uniquement", type: "boolean" },
  ],
  sortOptions: [
    { value: "name:asc", label: "Nom (A → Z)" },
    { value: "quantity:asc", label: "Quantité croissante" },
    { value: "quantity:desc", label: "Quantité décroissante" },
  ],
};

/* ============================================================ */
/* PERSONNEL, PLANNINGS & CONGÉS (RH)                           */
/* ============================================================ */
const POSITION_LABELS: Record<string, string> = {
  GUARD: "Gardien / Sécurité",
  CONCIERGE: "Concierge / Gardien",
  CLEANER: "Agent d'entretien",
  CLEANING: "Agent d'entretien",
  TECHNICIAN: "Technicien",
  MAINTENANCE: "Agent de maintenance",
  GARDENER: "Jardinier / Espaces verts",
  MANAGER: "Régisseur / Responsable",
  SECURITY: "Agent de sécurité",
  OTHER: "Autre",
};

const EMPLOYEE_POSITIONS = Object.values(EmployeePosition).map((val) => ({
  value: String(val),
  label: POSITION_LABELS[String(val)] ?? String(val),
}));

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  CDI: "CDI (Contrat à durée indéterminée)",
  CDD: "CDD (Contrat à durée déterminée)",
  FREELANCE: "Prestataire / Indépendant",
  INTERIM: "Intérim",
  PART_TIME: "Temps partiel",
  FULL_TIME: "Temps plein",
  STAGE: "Stage / Apprentissage",
  OTHER: "Autre",
};

const CONTRACT_TYPES = Object.values(ContractType).map((val) => ({
  value: String(val),
  label: CONTRACT_TYPE_LABELS[String(val)] ?? String(val),
}));

const SHIFT_STATUS_LABELS: Record<string, string> = {
  PLANNED: "Planifié",
  SCHEDULED: "Planifié",
  CONFIRMED: "Confirmé",
  IN_PROGRESS: "En cours",
  COMPLETED: "Terminé",
  DONE: "Effectué",
  CANCELLED: "Annulé",
  ABSENT: "Absent",
};

const SHIFT_STATUSES = Object.values(ShiftStatus).map((val) => ({
  value: String(val),
  label: SHIFT_STATUS_LABELS[String(val)] ?? String(val),
}));

const LEAVE_TYPE_LABELS: Record<string, string> = {
  PAID: "Congés payés",
  ANNUAL: "Congés annuels",
  VACATION: "Congés payés",
  SICK: "Congé maladie",
  SICK_LEAVE: "Congé maladie",
  UNPAID: "Congé sans solde",
  EXCEPTIONAL: "Congé exceptionnel",
  PARENTAL: "Congé parental",
  RECOVERY: "Récupération / RTT",
  OTHER: "Autre",
};

const LEAVE_TYPES = Object.values(LeaveType).map((val) => ({
  value: String(val),
  label: LEAVE_TYPE_LABELS[String(val)] ?? String(val),
}));

const LEAVE_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  APPROVED: "Approuvé",
  REJECTED: "Refusé",
};

const LEAVE_STATUSES = Object.values(LeaveStatus).map((val) => ({
  value: String(val),
  label: LEAVE_STATUS_LABELS[String(val)] ?? String(val),
}));

const employeeRoleLabel = (v: string) =>
  POSITION_LABELS[v] ?? EMPLOYEE_POSITIONS.find((r) => r.value === v)?.label ?? v;

const contractTypeLabel = (v: string) =>
  CONTRACT_TYPE_LABELS[v] ?? CONTRACT_TYPES.find((c) => c.value === v)?.label ?? v;

const leaveTypeLabel = (v: string) =>
  LEAVE_TYPE_LABELS[v] ?? LEAVE_TYPES.find((t) => t.value === v)?.label ?? v;

export const employeeConfig: ResourceConfig<any> = {
  key: "employees",
  label: "Employé",
  plural: "Personnel",
  apiPath: "/api/employees",
  searchPlaceholder: "Rechercher un employé par nom, poste ou résidence...",
  defaultSort: "-hireDate",
  fields: [
    {
      name: "residence",
      label: "Résidence d'affectation",
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
      name: "fullName",
      label: "Nom complet",
      type: "text",
      required: true,
      placeholder: "Ex : Karim Benali",
    },
    {
      name: "user",
      label: "Compte utilisateur associé (facultatif)",
      type: "relation",
      relation: {
        resource: "users",
        apiPath: "/api/users",
        labelField: "name",
        valueField: "_id",
      },
    },
    {
      name: "position",
      label: "Poste / Fonction",
      type: "select",
      required: true,
      options: EMPLOYEE_POSITIONS,
      defaultValue: EMPLOYEE_POSITIONS[0]?.value,
    },
    {
      name: "contractType",
      label: "Type de contrat",
      type: "select",
      required: true,
      options: CONTRACT_TYPES,
      defaultValue: CONTRACT_TYPES[0]?.value,
    },
    {
      name: "hireDate",
      label: "Date d'embauche",
      type: "date",
      required: true,
    },
    {
      name: "endDate",
      label: "Date de fin de contrat (facultatif)",
      type: "date",
    },
    {
      name: "monthlySalary",
      label: "Salaire mensuel brut (€)",
      type: "number",
      min: 0,
      defaultValue: 0,
    },
    {
      name: "phone",
      label: "Téléphone",
      type: "text",
      placeholder: "Ex : 06 12 34 56 78",
    },
    {
      name: "email",
      label: "Email",
      type: "text",
      placeholder: "Ex : employe@syndicpro.fr",
    },
    {
      name: "isActive",
      label: "En poste actuellement",
      type: "boolean",
      defaultValue: true,
    },
    {
      name: "notes",
      label: "Notes",
      type: "textarea",
      placeholder: "Informations complémentaires sur le poste ou les horaires...",
    },
  ],
  listColumns: [
    {
      key: "fullName",
      label: "Collaborateur",
      render: (val: any, item: any) =>
        val || item?.user?.name || item?.name || "Employé",
    },
    {
      key: "position",
      label: "Poste",
      render: (v: string, item: any) => employeeRoleLabel(v || item?.role),
    },
    {
      key: "contractType",
      label: "Contrat",
      render: (v: string) => (v ? contractTypeLabel(v) : "—"),
    },
    { key: "residence", label: "Résidence", type: "relation" },
    { key: "hireDate", label: "Embauche", type: "date" },
    {
      key: "monthlySalary",
      label: "Salaire",
      render: (val: number, item: any) =>
        `${(val ?? item?.salary ?? 0).toFixed(2)} €`,
    },
    { key: "isActive", label: "Actif", type: "boolean" },
  ],
  cardTitle: (item) =>
    item.fullName ||
    (typeof item.user === "object" && item.user?.name) ||
    item.name ||
    employeeRoleLabel(item.position || item.role),
  cardSubtitle: (item) =>
    `${employeeRoleLabel(item.position || item.role)} • ${contractTypeLabel(
      item.contractType || ""
    )} • ${(item.monthlySalary ?? item.salary ?? 0).toFixed(2)} €`,
  canCreate: (role) => role === Role.ADMIN || role === Role.SYNDIC,
  canEdit: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  canDelete: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  filterDefs: [
    { key: "position", label: "Poste", type: "select", options: EMPLOYEE_POSITIONS },
    { key: "isActive", label: "Actif", type: "boolean" },
  ],
};

export const shiftConfig: ResourceConfig<any> = {
  key: "shifts",
  label: "Créneau de planning",
  plural: "Plannings",
  apiPath: "/api/shifts",
  searchPlaceholder: "Rechercher dans les missions ou notes de planning...",
  defaultSort: "-startAt",
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
      name: "employee",
      label: "Employé",
      type: "relation",
      required: true,
      relation: {
        resource: "employees",
        apiPath: "/api/employees",
        labelField: "fullName",
        valueField: "_id",
      },
    },
    {
      name: "startAt",
      label: "Début du service",
      type: "date",
      required: true,
    },
    {
      name: "endAt",
      label: "Fin du service",
      type: "date",
      required: true,
    },
    {
      name: "mission",
      label: "Mission / Objet du créneau",
      type: "text",
      placeholder: "Ex : Permanence accueil, Ronde de sécurité...",
    },
    {
      name: "status",
      label: "Statut",
      type: "select",
      options: SHIFT_STATUSES,
      defaultValue: SHIFT_STATUSES[0]?.value,
    },
    {
      name: "notes",
      label: "Consignes / Notes",
      type: "textarea",
      placeholder: "Détails ou consignes particulières...",
    },
  ],
  listColumns: [
    {
      key: "employee",
      label: "Employé",
      type: "relation",
      render: (val: any) =>
        val?.fullName ||
        val?.name ||
        (val?.position || val?.role
          ? employeeRoleLabel(val.position || val.role)
          : "—"),
    },
    { key: "residence", label: "Résidence", type: "relation" },
    {
      key: "startAt",
      label: "Début",
      type: "date",
      render: (val: any, item: any) => {
        const d = val || item?.startTime;
        return d ? new Date(d).toLocaleDateString("fr-FR") : "—";
      },
    },
    {
      key: "endAt",
      label: "Fin",
      type: "date",
      render: (val: any, item: any) => {
        const d = val || item?.endTime;
        return d ? new Date(d).toLocaleDateString("fr-FR") : "—";
      },
    },
    {
      key: "mission",
      label: "Mission / Notes",
      render: (val: any, item: any) => val || item?.notes || "—",
    },
  ],
  cardTitle: (item) =>
    (typeof item.employee === "object" &&
      (item.employee?.fullName ||
        item.employee?.name ||
        employeeRoleLabel(item.employee?.position || item.employee?.role))) ||
    item.mission ||
    "Planning",
  cardSubtitle: (item) => {
    const start = item.startAt || item.startTime;
    return `${
      start ? new Date(start).toLocaleDateString("fr-FR") : ""
    } • ${item.mission || item.notes || "Service planifié"}`;
  },
  canCreate: (role) => role === Role.ADMIN || role === Role.SYNDIC,
  canEdit: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  canDelete: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
};

export const leaveConfig: ResourceConfig<any> = {
  key: "leaves",
  label: "Demande de congé",
  plural: "Congés & Absences",
  apiPath: "/api/leaves",
  searchPlaceholder: "Rechercher par motif de congé...",
  defaultSort: "-startDate",
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
      name: "employee",
      label: "Employé",
      type: "relation",
      required: true,
      relation: {
        resource: "employees",
        apiPath: "/api/employees",
        labelField: "fullName",
        valueField: "_id",
      },
    },
    {
      name: "type",
      label: "Type de congé",
      type: "select",
      required: true,
      options: LEAVE_TYPES,
      defaultValue: LEAVE_TYPES[0]?.value,
    },
    {
      name: "startDate",
      label: "Date de début",
      type: "date",
      required: true,
    },
    {
      name: "endDate",
      label: "Date de fin",
      type: "date",
      required: true,
    },
    {
      name: "reason",
      label: "Motif",
      type: "textarea",
      required: true,
      placeholder: "Ex : Congés payés annuels, Arrêt maladie...",
    },
    {
      name: "status",
      label: "Décision",
      type: "select",
      options: LEAVE_STATUSES,
      defaultValue: "PENDING",
    },
  ],
  listColumns: [
    {
      key: "employee",
      label: "Employé",
      type: "relation",
      render: (val: any) =>
        val?.fullName ||
        val?.name ||
        (val?.position || val?.role
          ? employeeRoleLabel(val.position || val.role)
          : "—"),
    },
    { key: "residence", label: "Résidence", type: "relation" },
    {
      key: "type",
      label: "Type",
      render: (val: string) => (val ? leaveTypeLabel(val) : "—"),
    },
    { key: "startDate", label: "Du", type: "date" },
    { key: "endDate", label: "Au", type: "date" },
    { key: "status", label: "Statut", type: "badge" },
    { key: "reason", label: "Motif" },
  ],
  cardTitle: (item) =>
    (typeof item.employee === "object" &&
      (item.employee?.fullName ||
        item.employee?.name ||
        employeeRoleLabel(item.employee?.position || item.employee?.role))) ||
    "Demande de congé",
  cardSubtitle: (item) =>
    `${item.type ? `${leaveTypeLabel(item.type)} • ` : ""}Du ${
      item.startDate ? new Date(item.startDate).toLocaleDateString("fr-FR") : "—"
    } au ${
      item.endDate ? new Date(item.endDate).toLocaleDateString("fr-FR") : "—"
    } • ${item.reason || ""}`,
  badgeField: {
    name: "status",
    variantMap: {
      PENDING: { label: "En attente", color: "warning" },
      APPROVED: { label: "Approuvé", color: "success" },
      REJECTED: { label: "Refusé", color: "danger" },
    },
  },
  canCreate: (role) => role === Role.ADMIN || role === Role.SYNDIC,
  canEdit: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  canDelete: (_item, role) => role === Role.ADMIN || role === Role.SYNDIC,
  filterDefs: [
    { key: "status", label: "Statut", type: "select", options: LEAVE_STATUSES },
    { key: "type", label: "Type", type: "select", options: LEAVE_TYPES },
  ],
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
  equipment: equipmentConfig,
  stock: stockConfig,
  employees: employeeConfig,
  shifts: shiftConfig,
  leaves: leaveConfig,
};


