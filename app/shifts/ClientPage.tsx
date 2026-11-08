"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { ShiftsContent } from "@/components/ops/ShiftsContent";

export default function ClientPage() {
  return (
    <AppLayout>
      <div className="space-y-4 animate-fadeIn pb-12">
        <ShiftsContent />
      </div>
    </AppLayout>
  );
}
