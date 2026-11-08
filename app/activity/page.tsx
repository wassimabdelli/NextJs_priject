import { Suspense } from "react";
import { ActivityCenter } from "@/components/activity/ActivityCenter";
import { auth } from "@/auth";

async function AuthenticatedActivityCenter() {
  const session = await auth();
  return <ActivityCenter userId={session?.user?.id} />;
}

export default function ActivityPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Chargement de l’activité…</div>}>
      <AuthenticatedActivityCenter />
    </Suspense>
  );
}
