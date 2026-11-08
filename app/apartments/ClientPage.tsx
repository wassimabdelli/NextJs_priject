"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { ResourcePage } from "@/components/crud/ResourcePage";
import { apartmentConfig } from "@/lib/resources/registry";

export default function ClientPage() {
  return (
    <AppLayout>
      <div className="space-y-4 animate-fadeIn pb-12">
        <ResourcePage
          config={apartmentConfig}
          title="Lots & Appartements"
          description="Cadastre des lots, tantièmes et occupation de la résidence."
        />
      </div>
    </AppLayout>
  );
}
