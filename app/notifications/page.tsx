import { Suspense } from "react";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { auth } from "@/auth";

async function AuthenticatedNotificationCenter() {
  const session = await auth();
  return <NotificationCenter userId={session?.user?.id} />;
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Chargement des notifications…</div>}>
      <AuthenticatedNotificationCenter />
    </Suspense>
  );
}
