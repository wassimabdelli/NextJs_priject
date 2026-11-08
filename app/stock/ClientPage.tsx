"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { StockContent } from "@/components/ops/StockContent";

export default function ClientPage() {
  return (
    <AppLayout>
      <div className="space-y-4 animate-fadeIn pb-12">
        <StockContent />
      </div>
    </AppLayout>
  );
}
