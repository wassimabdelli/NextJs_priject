"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { AnnouncementAudience as Audience, AnnouncementCategory as Category, AnnouncementPriority as Priority } from "@/types/enums";
import { AIButton } from "./AIButton";
import { AIError } from "./AIError";
import { AILoading } from "./AILoading";
import { AIResultCard } from "./AIResultCard";

interface GeneratedAnnouncement {
  title: string;
  content: string;
  suggestedCategory: Category;
  suggestedPriority: Priority;
}

type ContextFact = { id: string; label: string };

export function AIAnnouncementGenerator({
  title,
  content,
  category,
  audience,
  residenceId,
  onApply,
}: {
  title: string;
  content: string;
  category: Category;
  audience: Audience;
  residenceId: string;
  onApply: (value: GeneratedAnnouncement) => void;
}) {
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("PROFESSIONAL");
  const [language, setLanguage] = useState("FR");
  const [mode, setMode] = useState("GENERATE");
  const [result, setResult] = useState<GeneratedAnnouncement | null>(null);
  const [contextFacts, setContextFacts] = useState<ContextFact[]>([]);
  const [contextKey, setContextKey] = useState("");
  const [selectedFactIds, setSelectedFactIds] = useState<Set<string>>(new Set());
  const [providedFacts, setProvidedFacts] = useState<string[]>([]);
  const [contextError, setContextError] = useState("");
  const [loadingContext, setLoadingContext] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const currentContextKey = `${residenceId}:${category}`;
  const currentFacts = contextKey === currentContextKey ? contextFacts : [];
  const currentContextError = contextKey === currentContextKey ? contextError : "";

  useEffect(() => {
    if (!residenceId) {
      return;
    }

    const controller = new AbortController();
    const loadContext = async () => {
      setLoadingContext(true);
      setContextError("");
      try {
        const query = new URLSearchParams({ residenceId, category });
        const response = await fetch(`/api/ai/announcements/context?${query}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Contexte indisponible.");
        const facts = (data.facts ?? []) as ContextFact[];
        setContextFacts(facts);
        setContextKey(`${residenceId}:${category}`);
        setSelectedFactIds(new Set(facts.map((fact) => fact.id)));
      } catch (cause) {
        if (controller.signal.aborted) return;
        setContextFacts([]);
        setContextKey(`${residenceId}:${category}`);
        setSelectedFactIds(new Set());
        setContextError(cause instanceof Error ? cause.message : "Contexte indisponible.");
      } finally {
        if (!controller.signal.aborted) setLoadingContext(false);
      }
    };
    void loadContext();
    return () => controller.abort();
  }, [residenceId, category]);

  const run = async () => {
    setLoading(true); setError(""); setResult(null);
    try {
      const facts = currentFacts
        .filter((fact) => selectedFactIds.has(fact.id))
        .map((fact) => fact.label);
      setProvidedFacts(facts);
      const response = await fetch("/api/ai/announcements/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic || content || title, category, audience, tone, language, mode, existingTitle: title, existingContent: content, facts }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Génération IA indisponible.");
      setResult(data as GeneratedAnnouncement);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Génération impossible."); }
    finally { setLoading(false); }
  };

  return <section className="space-y-3 rounded-xl border border-sky-200 p-3 dark:border-sky-900">
    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Rédiger avec Gemini — vérifiez avant d’enregistrer</p>
    <label className="block space-y-1 text-xs font-medium">Sujet / instructions<textarea rows={2} maxLength={2000} value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Décrivez les informations à communiquer…" className="w-full rounded-lg border border-slate-200 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-800" /></label>
    <div className="grid gap-2 sm:grid-cols-3">
      <label className="text-xs">Action<select value={mode} onChange={(event) => setMode(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-800"><option value="GENERATE">Rédiger</option><option value="TITLE">Réviser le titre</option><option value="REWRITE">Réécrire</option><option value="SHORTER">Raccourcir</option><option value="PROFESSIONAL">Professionnaliser</option><option value="FRIENDLY">Rendre plus chaleureux</option><option value="GRAMMAR">Corriger la grammaire</option></select></label>
      <label className="text-xs">Ton<select value={tone} onChange={(event) => setTone(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-800"><option value="PROFESSIONAL">Professionnel</option><option value="FRIENDLY">Amical</option><option value="URGENT">Urgent</option></select></label>
      <label className="text-xs">Langue<select value={language} onChange={(event) => setLanguage(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-800"><option value="FR">Français</option><option value="AR">العربية</option><option value="EN">English</option></select></label>
    </div>
    <fieldset className="space-y-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
      <legend className="px-1 text-xs font-semibold text-slate-700 dark:text-slate-200">Contexte détecté</legend>
      {residenceId && loadingContext && <AILoading label="Recherche de faits pour cette résidence…" />}
      {currentContextError && <AIError message={currentContextError} />}
      {!residenceId && <p className="text-xs text-slate-500 dark:text-slate-400">Choisissez une résidence pour rechercher des faits vérifiés.</p>}
      {residenceId && !loadingContext && !currentContextError && currentFacts.length === 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400">Aucun fait vérifié disponible pour cette résidence et cette catégorie.</p>
      )}
      {currentFacts.map((fact) => (
        <label key={fact.id} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={selectedFactIds.has(fact.id)}
            onChange={(event) => {
              setSelectedFactIds((current) => {
                const next = new Set(current);
                if (event.target.checked) next.add(fact.id);
                else next.delete(fact.id);
                return next;
              });
            }}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600"
          />
          <span>{fact.label}</span>
        </label>
      ))}
    </fieldset>
    <AIButton disabled={loading || loadingContext || !residenceId || (!topic.trim() && !content.trim() && !title.trim())} onClick={() => void run()}>Générer une proposition</AIButton>
    {loading && <AILoading />}
    {error && <AIError message={error} />}
    {result && <AIResultCard title="Brouillon IA — aucune publication automatique">
      <div className="space-y-2"><p><strong>{result.title}</strong></p><p className="whitespace-pre-wrap">{result.content}</p><p className="text-xs">Catégorie suggérée : {result.suggestedCategory} · Priorité : {result.suggestedPriority}</p>
        <div className="space-y-1 rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-800/60">
          <p className="font-semibold">Faits fournis à l&apos;IA</p>
          <div className="space-y-2">
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Faits transmis au modèle ({providedFacts.length})
              </p>
              {providedFacts.length > 0 ? (
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {providedFacts.map((fact, index) => (
                    <li key={index} className="inline-flex max-w-full items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-medium text-sky-900 dark:bg-sky-950/50 dark:text-sky-200">
                      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
                      <span className="truncate">{fact}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Aucun fait vérifié sélectionné.
                </p>
              )}
            </div>
            {currentFacts.length > providedFacts.length && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {currentFacts.length - providedFacts.length} autre(s) fait(s) vérifié(s)
                disponible(s) — non transmis au modèle car décoché(s).
              </p>
            )}
          </div>
          <details className="rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-700">
            <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
              Comment ces faits ont été vérifiés
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-slate-600 dark:text-slate-400">
              <li>Nombre de résidents : compté par rôles OWNER/TENANT actifs de la résidence.</li>
              <li>Réclamations ouvertes : agrégat par catégorie sur les incidents non RESOLVED.</li>
              <li>Dernière annonce : publiée sur la même résidence et la même catégorie.</li>
              <li>Aucune de ces informations n&apos;a été inventée par le modèle.</li>
            </ul>
          </details>
          <p className="pt-1 text-slate-500 dark:text-slate-400">Relisez le texte : l&apos;IA peut reformuler ou omettre des éléments.</p>
        </div>
        <Button type="button" size="sm" onClick={() => onApply(result)}>Utiliser après vérification</Button>
      </div>
    </AIResultCard>}
  </section>;
}
