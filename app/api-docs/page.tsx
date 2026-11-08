import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { Role } from "@/types/enums";
import { SwaggerViewer } from "@/components/docs/SwaggerViewer";

import { connection } from "next/server";

export const instant = false;

export default async function ApiDocsPage() {
  await connection();
  // En production, désactiver si ENABLE_API_DOCS n'est pas "true"
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_API_DOCS !== "true") {
    notFound();
  }

  const session = await auth();

  // Non connecté : redirection vers login
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/api-docs");
  }

  // Seuls les rôles ADMIN et SYNDIC sont autorisés à consulter la documentation API
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.SYNDIC) {
    redirect("/forbidden");
  }

  return <SwaggerViewer user={session.user} />;
}
