"use client";

import { ResourcePage } from "@/components/crud/ResourcePage";
import { equipmentConfig } from "@/lib/resources/registry";

export default function EquipmentPage() {
  return <ResourcePage config={equipmentConfig} />;
}
