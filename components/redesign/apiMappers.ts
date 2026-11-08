/**
 * Helpers partagés pour mapper les réponses API vers l’UI redesign (libellés FR, dates).
 */

import type { ExpenseCategory as RedesignExpenseCategory } from "@/lib/redesign/condo";
import {
  DocumentType,
  PaymentMethod,
  ReminderType,
  Role as ApiRole,
  VoteChoice,
  expenseCategoryLabel,
  paymentMethodLabel,
  reminderTypeLabel,
} from "@/types/enums";

/** Date ISO ou objet → libellé court type JJ/MM/AAAA pour le redesign. */
export function formatDateFrShort(iso: string | Date | undefined | null): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Catégorie dépense API → clé redesign (mêmes codes). */
export function apiExpenseCategoryToRedesign(cat: string): RedesignExpenseCategory {
  const allowed: RedesignExpenseCategory[] = [
    "WATER",
    "ELECTRICITY",
    "ELEVATOR",
    "CLEANING",
    "SECURITY",
    "MAINTENANCE",
    "OTHER",
  ];
  return (allowed.includes(cat as RedesignExpenseCategory) ? cat : "OTHER") as RedesignExpenseCategory;
}

/** Libellé français pour une catégorie de dépense (table redesign). */
export function expenseCategoryFr(cat: string): string {
  return expenseCategoryLabel[cat as keyof typeof expenseCategoryLabel] ?? cat;
}

/** Mode paiement → libellés proches du sélecteur redesign (Virement, Carte, etc.). */
export function paymentMethodToRedesignLabel(method: string): string {
  return paymentMethodLabel[method as PaymentMethod] ?? method;
}

/** Choix de vote API → libellé POUR / CONTRE / ABSTENTION (UI résolutions). */
export function voteChoiceToFr(choice: string): "POUR" | "CONTRE" | "ABSTENTION" {
  if (choice === VoteChoice.FOR) return "POUR";
  if (choice === VoteChoice.AGAINST) return "CONTRE";
  return "ABSTENTION";
}

/** Type document API → catégorie affichée dans le tableau (codes redesign). */
export function documentTypeToCategory(type: string): string {
  return type in DocumentType ? type : DocumentType.OTHER;
}

/** Libellé français pour le badge catégorie document. */
export function documentTypeFr(type: string): string {
  const labels: Record<string, string> = {
    [DocumentType.MINUTES]: "Procès-verbal",
    [DocumentType.RULES]: "Règlement",
    [DocumentType.CONTRACT]: "Contrat",
    [DocumentType.INVOICE]: "Facture",
    [DocumentType.OTHER]: "Autre",
  };
  return labels[type] ?? type;
}

/** Rôle API → rôle affiché dans ResidentsView / profil redesign. */
export function apiRoleToRedesignRole(role: string): import("@/lib/redesign/condo").Role {
  switch (role) {
    case ApiRole.ADMIN:
      return "Syndic";
    case ApiRole.SYNDIC:
      return "Syndic";
    case ApiRole.TENANT:
      return "Locataire";
    case ApiRole.TECHNICIAN:
      return "Technicien";
    case ApiRole.OWNER:
    default:
      return "Copropriétaire";
  }
}

/** Titre de rappel : type métier + titre brut. */
export function reminderTitle(type: string | undefined, title: string): string {
  const typeFr = type ? reminderTypeLabel[type as ReminderType] : "";
  return typeFr ? `${typeFr} — ${title}` : title;
}
