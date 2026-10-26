"use client";

import { ResourcePage } from "@/components/crud/ResourcePage";
import { userConfig } from "@/lib/resources/registry";

export default function UsersPage() {
  return (
    <ResourcePage
      config={userConfig}
      title="Utilisateurs"
      description="Gestion des accès, activation/désactivation des comptes et attribution des rôles."
    />
  );
}
