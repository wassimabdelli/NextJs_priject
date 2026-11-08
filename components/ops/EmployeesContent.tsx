"use client";

import { ResourcePage } from "@/components/crud/ResourcePage";
import { employeeConfig } from "@/lib/resources/registry";

const extraProps: Record<string, unknown> = {
  title: "Personnel & Employés",
  description:
    "Gestion des gardiens, techniciens, agents de nettoyage et gestionnaires.",
};

// Page de gestion du personnel et des employés de copropriété
export function EmployeesContent() {
  return <ResourcePage config={employeeConfig} {...extraProps} />;
}
