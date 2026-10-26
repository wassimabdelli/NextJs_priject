"use client";

import { ResourcePage } from "@/components/crud/ResourcePage";
import { residentConfig } from "@/lib/resources/registry";

export default function ResidentsPage() {
  return <ResourcePage config={residentConfig} />;
}
