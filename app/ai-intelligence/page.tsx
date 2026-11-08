import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppLayout } from "@/components/layout/AppLayout";
import AIIntelligenceDashboard from "@/components/ai-intelligence/AIIntelligenceDashboard";
import { Role } from "@/types/enums";

export const metadata: Metadata = {
  title: "AI Intelligence | SyndicPro",
  description: "Analyse intelligente de vos réclamations et annonces.",
};

async function AuthorizedAIIntelligencePage() {
  await connection();
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/ai-intelligence");
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.SYNDIC) {
    redirect("/forbidden");
  }

  return (
    <AppLayout user={session.user}>
      <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
        <AIIntelligenceDashboard />
      </main>
    </AppLayout>
  );
}

export default function AIIntelligencePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Chargement de l’analyse…</div>}>
      <AuthorizedAIIntelligencePage />
    </Suspense>
  );
}
