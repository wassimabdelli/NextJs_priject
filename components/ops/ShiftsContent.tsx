"use client";

import { ResourcePage } from "@/components/crud/ResourcePage";
import { shiftConfig } from "@/lib/resources/registry";

const extraProps: Record<string, unknown> = {
  title: "Plannings & Horaires",
  description:
    "Créneaux de travail et affectations par employé (sans chevauchement).",
};

// Page de gestion des plannings et créneaux horaires
export function ShiftsContent() {
  return <ResourcePage config={shiftConfig} {...extraProps} />;
}
