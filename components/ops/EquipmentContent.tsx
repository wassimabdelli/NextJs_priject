"use client";

import { ResourcePage } from "@/components/crud/ResourcePage";
import { equipmentConfig } from "@/lib/resources/registry";

export function EquipmentContent() {
  return <ResourcePage config={equipmentConfig} />;
}
