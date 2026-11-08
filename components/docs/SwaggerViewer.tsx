"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Home, Info, ShieldCheck, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Role } from "@/types/enums";

interface SwaggerViewerProps {
  user?: {
    name?: string | null;
    email?: string | null;
    role?: Role;
  };
}

export function SwaggerViewer({ user }: SwaggerViewerProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Injection de la feuille de style Swagger UI
    const linkId = "swagger-ui-styles";
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/swagger-ui-dist@5/swagger-ui.css";
      document.head.appendChild(link);
    }

    // 2. Chargement asynchrone des scripts du bundle Swagger UI
    const loadScript = (src: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve();
          return;
        }
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Échec du chargement du script ${src}`));
        document.body.appendChild(script);
      });
    };

    Promise.all([
      loadScript("https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"),
      loadScript("https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"),
    ])
      .then(() => {
        setLoading(false);
        const win = window as any;
        if (win.SwaggerUIBundle) {
          win.SwaggerUIBundle({
            url: "/api/openapi",
            dom_id: "#swagger-ui",
            deepLinking: true,
            presets: [win.SwaggerUIBundle.presets.apis, win.SwaggerUIStandalonePreset],
            layout: "BaseLayout",
            // Point clé B : Envoi automatique des cookies de session pour le "Try it out"
            requestInterceptor: (req: any) => {
              req.credentials = "include";
              return req;
            },
          });
        }
      })
      .catch((err) => {
        console.error("[SwaggerUI] Erreur de chargement :", err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Barre supérieure d'information et navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-sky-400 text-white shadow-md shadow-sky-500/20">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Syndic<span className="text-sky-500">Pro</span>
                </span>
                <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                  OpenAPI 3.0
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Documentation Swagger UI</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span className="font-semibold">{user.name}</span>
                <Badge variant={user.role === Role.ADMIN ? "danger" : "info"} className="text-[10px]">
                  {user.role}
                </Badge>
              </div>
            )}
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Home className="h-3.5 w-3.5" />
              Retour à l'application
            </Link>
          </div>
        </div>
      </header>

      {/* Note d'information sur la session */}
      <div className="mx-auto max-w-7xl px-4 pt-4">
        <div className="flex items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50/80 p-4 text-xs text-sky-900 sm:text-sm dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-200">
          <Info className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" />
          <div>
            <strong>Session active :</strong> Connectez-vous d'abord à l'application dans ce navigateur pour tester les routes protégées.
            Toutes les requêtes exécutées via le bouton <em>'Try it out'</em> transmettent automatiquement votre cookie de session JWT (<code>credentials: &quot;include&quot;</code>).
          </div>
        </div>
      </div>

      {/* Conteneur Swagger UI */}
      <div className="mx-auto max-w-7xl px-4 py-6">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Loader2 className="h-10 w-10 animate-spin text-sky-500" />
            <p className="mt-3 text-sm font-medium">Chargement de l'interface Swagger...</p>
          </div>
        )}
        <div id="swagger-ui" className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-950" />
      </div>
    </div>
  );
}
