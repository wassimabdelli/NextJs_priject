"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { LeavesContent } from "@/components/ops/LeavesContent";

export default function ClientPage() {
  return (
    <AppLayout>
      <div className="space-y-4 animate-fadeIn pb-12">
        <LeavesContent />
      </div>
    </AppLayout>
  );
}
