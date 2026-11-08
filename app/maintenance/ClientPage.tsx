"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { MaintenanceContent } from "@/components/ops/MaintenanceContent";

export default function ClientPage() {
  return (
    <AppLayout>
      <div className="space-y-4 animate-fadeIn pb-12">
        <MaintenanceContent />
      </div>
    </AppLayout>
  );
}
