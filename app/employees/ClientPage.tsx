"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { EmployeesContent } from "@/components/ops/EmployeesContent";

export default function ClientPage() {
  return (
    <AppLayout>
      <div className="space-y-4 animate-fadeIn pb-12">
        <EmployeesContent />
      </div>
    </AppLayout>
  );
}
