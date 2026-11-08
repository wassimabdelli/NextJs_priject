"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { ResourcePage } from "@/components/crud/ResourcePage";
import { userConfig } from "@/lib/resources/registry";

export default function ClientPage() {
  return (
    <AppLayout>
      <div className="space-y-4 animate-fadeIn pb-12">
        <ResourcePage
          config={userConfig}
          title="Utilisateurs"
          description="Gestion des accès, activation/désactivation des comptes et attribution des rôles."
        />
      </div>
    </AppLayout>
  );
}
