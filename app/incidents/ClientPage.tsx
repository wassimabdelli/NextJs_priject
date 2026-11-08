"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { IncidentsAdvancedContent } from "@/components/ops/IncidentsAdvancedContent";

export default function IncidentsPage() {
  return (
    <AppLayout>
      <div className="animate-fadeIn pb-12">
        <IncidentsAdvancedContent />
      </div>
    </AppLayout>
  );
}
