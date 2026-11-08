"use client";

import { ResourcePage } from "@/components/crud/ResourcePage";
import { residenceConfig } from "@/lib/resources/registry";

export default function ResidencesPage() {
  return <ResourcePage config={residenceConfig} />;
}
