"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { EquipmentContent } from "@/components/ops/EquipmentContent";

export default function ClientPage() {
  return (
    <AppLayout>
      <div className="space-y-4 animate-fadeIn pb-12">
        <EquipmentContent />
      </div>
    </AppLayout>
  );
}
