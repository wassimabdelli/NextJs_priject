import React from "react";

export type FieldType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "textarea"
  | "relation"
  | "boolean";

export interface FieldOption {
  label: string;
  value: string | number | boolean;
}

export interface RelationConfig {
  resource: string; // Ex: "residences", "apartments", "users"
  apiPath?: string; // Ex: "/api/residences" (par défaut `/api/${resource}`)
  labelField: string; // Champ affiché, ex: "name" ou "title"
  valueField?: string; // Champ clé, ex: "_id" (par défaut "_id")
}

export interface ResourceField {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  defaultValue?: any;
  placeholder?: string;
  options?: FieldOption[];
  relation?: RelationConfig;
  readOnly?: boolean;
  helpText?: string;
  min?: number;
  max?: number;
}

export interface ListColumn<T = any> {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "badge" | "boolean" | "relation";
  render?: (value: any, item: T) => React.ReactNode;
}

export interface BadgeFieldConfig {
  name: string;
  variantMap?: Record<
    string,
    {
      label: string;
      color?: "default" | "success" | "warning" | "danger" | "info";
      className?: string;
    }
  >;
}

export interface FilterDef {
  key: string; // nom du paramètre de requête (ex "status")
  label: string; // libellé français
  type: "select" | "boolean" | "month" | "dateRange";
  options?: { value: string; label: string }[]; // pour "select"
}
// "boolean" : valeurs "true" / "false". "month" : valeur "YYYY-MM".
// "dateRange" : utilise les deux clés fixes "from" et "to" (YYYY-MM-DD) ; key sert d'identifiant.

export interface SortOption {
  value: string;
  label: string;
} // value = "champ:asc" ou "champ:desc"

export interface RowLink {
  label: string;
  href: (item: any) => string;
  roles?: string[]; // rôles autorisés ; absent = tous
}

export interface ResourceConfig<T = any> {
  key: string;
  label: string;
  plural: string;
  apiPath: string;
  entityOfflineKey?: "announcement" | "incident" | "payment" | "charge" | "residence" | "apartment";

  fields: ResourceField[];
  listColumns: ListColumn<T>[];
  cardTitle: (item: T) => string;
  cardSubtitle: (item: T) => string;
  badgeField?: BadgeFieldConfig;
  searchPlaceholder?: string;
  defaultSort?: string;
  canCreate?: (userRole?: string) => boolean;
  canEdit?: (item: T, userRole?: string) => boolean;
  canDelete?: (item: T, userRole?: string) => boolean;
  filterDefs?: FilterDef[];
  sortOptions?: SortOption[];
  exportPath?: string; // ex "/api/payments/export"
  rowLinks?: RowLink[];
}
