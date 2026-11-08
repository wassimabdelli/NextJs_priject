"use client";

import { ResourcePage } from "@/components/crud/ResourcePage";
import { userConfig } from "@/lib/resources/registry";

export default function UsersPage() {
  return (
    <ResourcePage
      config={userConfig}
      title="Utilisateurs"
      description="Gérez les comptes et les rôles, et rattachez chaque compte résident à sa résidence."
    />
  );
}
