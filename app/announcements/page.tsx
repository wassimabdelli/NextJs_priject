import { Suspense } from "react";
import { AnnouncementDashboard } from "@/components/announcements/AnnouncementDashboard";

export default function AnnouncementsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Chargement des annonces…</div>}>
      <AnnouncementDashboard />
    </Suspense>
  );
}
