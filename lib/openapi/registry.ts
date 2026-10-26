import { ensureOpenApi } from "./init";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import {
  Role,
  ResidentType,
  ChargeStatus,
  PaymentMethod,
  ExpenseCategory,
  IncidentCategory,
  Priority,
  IncidentStatus,
  MeetingStatus,
  VoteChoice,
  DocumentType,
  values,
} from "@/types/enums";

import { userCreateSchema, userUpdateSchema } from "@/lib/validations/user";
import { residenceCreateSchema, residenceUpdateSchema } from "@/lib/validations/residence";
import { apartmentCreateSchema, apartmentUpdateSchema } from "@/lib/validations/apartment";
import { residentCreateSchema, residentUpdateSchema } from "@/lib/validations/resident";
import { chargeCreateSchema, chargeUpdateSchema } from "@/lib/validations/charge";
import { paymentCreateSchema, paymentUpdateSchema } from "@/lib/validations/payment";
import { expenseCreateSchema, expenseUpdateSchema } from "@/lib/validations/expense";
import { incidentCreateSchema, incidentUpdateSchema } from "@/lib/validations/incident";
import { announcementCreateSchema, announcementUpdateSchema } from "@/lib/validations/announcement";
import {
  meetingCreateSchema,
  meetingUpdateSchema,
  resolutionCreateSchema,
  resolutionUpdateSchema,
  voteCreateSchema,
  voteUpdateSchema,
  documentCreateSchema,
  documentUpdateSchema,
} from "@/lib/validations/governance";
import { loginSchema, registerSchema as authRegisterSchema } from "@/lib/validations/auth";

export const registry = new OpenAPIRegistry();

/**
 * Enregistre un schéma dans le composant /components/schemas avec garantie OpenAPI
 */
function registerComponentSchema<T extends z.ZodType>(name: string, schema: T): T {
  return registry.register(name, ensureOpenApi(schema));
}

/* ============================================================ */
/* 1. SCHÉMA DE SÉCURITÉ                                       */
/* ============================================================ */
export const cookieAuth = registry.registerComponent("securitySchemes", "cookieAuth", {
  type: "apiKey",
  in: "cookie",
  name: "authjs.session-token",
  description:
    "Cookie de session JWT HTTP-Only généré par Auth.js (v5). En développement local, le cookie se nomme 'authjs.session-token'.",
});

/* ============================================================ */
/* 2. ÉNUMÉRATIONS MÉTIER                                       */
/* ============================================================ */
export const RoleSchema = registerComponentSchema("Role", z.enum(values(Role)));
export const ResidentTypeSchema = registerComponentSchema("ResidentType", z.enum(values(ResidentType)));
export const ChargeStatusSchema = registerComponentSchema("ChargeStatus", z.enum(values(ChargeStatus)));
export const PaymentMethodSchema = registerComponentSchema("PaymentMethod", z.enum(values(PaymentMethod)));
export const ExpenseCategorySchema = registerComponentSchema("ExpenseCategory", z.enum(values(ExpenseCategory)));
export const IncidentCategorySchema = registerComponentSchema("IncidentCategory", z.enum(values(IncidentCategory)));
export const PrioritySchema = registerComponentSchema("Priority", z.enum(values(Priority)));
export const IncidentStatusSchema = registerComponentSchema("IncidentStatus", z.enum(values(IncidentStatus)));
export const MeetingStatusSchema = registerComponentSchema("MeetingStatus", z.enum(values(MeetingStatus)));
export const VoteChoiceSchema = registerComponentSchema("VoteChoice", z.enum(values(VoteChoice)));
export const DocumentTypeSchema = registerComponentSchema("DocumentType", z.enum(values(DocumentType)));

/* ============================================================ */
/* 3. SCHÉMAS DE RÉPONSES D'ERREURS STANDARD                   */
/* ============================================================ */
export const ErrorResponseSchema = registerComponentSchema(
  "ErrorResponse",
  z.object({
    error: z.string().openapi({ description: "Message d'erreur explicatif en français" }),
    details: z.unknown().optional().openapi({ description: "Détails complémentaires de validation ou de conflit" }),
  })
);

/* ============================================================ */
/* 4. ENREGISTREMENT DES SCHÉMAS ZOD EXISTANTS                 */
/* ============================================================ */
// Auth
export const LoginInputSchema = registerComponentSchema("LoginInput", loginSchema);
export const RegisterInputSchema = registerComponentSchema("RegisterInput", authRegisterSchema);

// Utilisateurs
export const UserCreateSchema = registerComponentSchema("UserCreate", userCreateSchema);
export const UserUpdateSchema = registerComponentSchema("UserUpdate", userUpdateSchema);

// Résidences
export const ResidenceCreateSchema = registerComponentSchema("ResidenceCreate", residenceCreateSchema);
export const ResidenceUpdateSchema = registerComponentSchema("ResidenceUpdate", residenceUpdateSchema);

// Appartements
export const ApartmentCreateSchema = registerComponentSchema("ApartmentCreate", apartmentCreateSchema);
export const ApartmentUpdateSchema = registerComponentSchema("ApartmentUpdate", apartmentUpdateSchema);

// Résidents
export const ResidentCreateSchema = registerComponentSchema("ResidentCreate", residentCreateSchema);
export const ResidentUpdateSchema = registerComponentSchema("ResidentUpdate", residentUpdateSchema);

// Charges
export const ChargeCreateSchema = registerComponentSchema("ChargeCreate", chargeCreateSchema);
export const ChargeUpdateSchema = registerComponentSchema("ChargeUpdate", chargeUpdateSchema);

// Paiements
export const PaymentCreateSchema = registerComponentSchema("PaymentCreate", paymentCreateSchema);
export const PaymentUpdateSchema = registerComponentSchema("PaymentUpdate", paymentUpdateSchema);

// Dépenses
export const ExpenseCreateSchema = registerComponentSchema("ExpenseCreate", expenseCreateSchema);
export const ExpenseUpdateSchema = registerComponentSchema("ExpenseUpdate", expenseUpdateSchema);

// Incidents
export const IncidentCreateSchema = registerComponentSchema("IncidentCreate", incidentCreateSchema);
export const IncidentUpdateSchema = registerComponentSchema("IncidentUpdate", incidentUpdateSchema);

// Annonces
export const AnnouncementCreateSchema = registerComponentSchema("AnnouncementCreate", announcementCreateSchema);
export const AnnouncementUpdateSchema = registerComponentSchema("AnnouncementUpdate", announcementUpdateSchema);

// Gouvernance (Assemblées générales, résolutions, votes, documents)
export const MeetingCreateSchema = registerComponentSchema("MeetingCreate", meetingCreateSchema);
export const MeetingUpdateSchema = registerComponentSchema("MeetingUpdate", meetingUpdateSchema);
export const ResolutionCreateSchema = registerComponentSchema("ResolutionCreate", resolutionCreateSchema);
export const ResolutionUpdateSchema = registerComponentSchema("ResolutionUpdate", resolutionUpdateSchema);
export const VoteCreateSchema = registerComponentSchema("VoteCreate", voteCreateSchema);
export const VoteUpdateSchema = registerComponentSchema("VoteUpdate", voteUpdateSchema);
export const DocumentCreateSchema = registerComponentSchema("DocumentCreate", documentCreateSchema);
export const DocumentUpdateSchema = registerComponentSchema("DocumentUpdate", documentUpdateSchema);
