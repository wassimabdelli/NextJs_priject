"use client";

import { Suspense } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { AnnouncementDashboard } from "@/components/announcements/AnnouncementDashboard";

function Fallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div
        className="size-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"
        role="status"
        aria-label="Chargement"
      />
    </div>
  );
}

export default function AnnouncementsPage() {
  return (
    <AppLayout>
      <div className="animate-fadeIn pb-12">
        <Suspense fallback={<Fallback />}>
          <AnnouncementDashboard />
        </Suspense>
      </div>
    </AppLayout>
  );
}
