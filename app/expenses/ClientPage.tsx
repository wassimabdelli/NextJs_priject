"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { ResourcePage } from "@/components/crud/ResourcePage";
import { expenseConfig } from "@/lib/resources/registry";

export default function ClientPage() {
  return (
    <AppLayout>
      <div className="space-y-4 animate-fadeIn pb-12">
        <ResourcePage
          config={expenseConfig}
          title="Dépenses"
          description="Factures et dépenses de la copropriété."
        />
      </div>
    </AppLayout>
  );
}
