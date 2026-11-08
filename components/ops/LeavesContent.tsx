"use client";

import { ResourcePage } from "@/components/crud/ResourcePage";
import { leaveConfig } from "@/lib/resources/registry";

const extraProps: Record<string, unknown> = {
  title: "Demandes de Congés",
  description:
    "Suivi des congés et validation par la direction ou le syndic.",
};

// Page de suivi et validation des demandes de congés
export function LeavesContent() {
  return <ResourcePage config={leaveConfig} {...extraProps} />;
}
