"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { ResourcePage } from "@/components/crud/ResourcePage";
import { residenceConfig } from "@/lib/resources/registry";

export default function ClientPage() {
  return (
    <AppLayout>
      <div className="space-y-4 animate-fadeIn pb-12">
        <ResourcePage
          config={residenceConfig}
          title="Résidences"
          description="Immeubles et copropriétés gérés par le syndic."
        />
      </div>
    </AppLayout>
  );
}
