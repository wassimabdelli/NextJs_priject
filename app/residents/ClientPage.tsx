"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { ResourcePage } from "@/components/crud/ResourcePage";
import { residentConfig } from "@/lib/resources/registry";

export default function ClientPage() {
  return (
    <AppLayout>
      <div className="space-y-4 animate-fadeIn pb-12">
        <ResourcePage
          config={residentConfig}
          title="Résidents"
          description="Fiches d’occupation des lots — création, rattachement et suivi."
        />
      </div>
    </AppLayout>
  );
}
