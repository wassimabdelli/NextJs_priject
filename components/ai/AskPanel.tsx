"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, Search } from "lucide-react";
import { incidentStatusLabel } from "@/types/enums";
import { Input } from "@/components/ui/Input";
import { AIBadge } from "./AIBadge";

type AskResponse = {
  answer: string;
  sources: Array<{
    id: string;
    title: string;
    status: string;
    similarity: number;
  }>;
  coverage: {
    searched: number;
    withoutEmbedding: number;
  };
};

const SUGGESTIONS = [
  "Fuites d'eau récentes",
  "Problèmes d'ascenseur",
  "Réclamations urgentes non résolues",
  "Pannes d'électricité",
];

export default function AskPanel() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function ask(value = question) {
    const trimmed = value.trim();
    if (trimmed.length < 3 || loading) return;
    setQuestion(trimmed);
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const payload = await response.json() as AskResponse & { error?: string; message?: string };
      if (!response.ok || typeof payload.answer !== "string" || !Array.isArray(payload.sources) || !payload.coverage) {
        throw new Error(payload.error ?? payload.message ?? "Impossible d’interroger les réclamations.");
      }
      setResult(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Impossible d’interroger les réclamations.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask();
  }

  return (
    <section aria-labelledby="ask-incidents-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-sky-100 p-2 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
          <Search aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h2 id="ask-incidents-title" className="text-lg font-semibold text-slate-900 dark:text-white">
            Poser une question à vos données
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Les réponses s’appuient sur les réclamations auxquelles votre rôle vous autorise à accéder.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Input
          label="Votre question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ex. Quelles réclamations de plomberie restent à traiter ?"
          maxLength={500}
          minLength={3}
          disabled={loading}
          className="rounded-full px-4"
        />
        <button
          type="submit"
          disabled={loading || question.trim().length < 3}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          {loading ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <ArrowRight aria-hidden="true" className="h-4 w-4" />}
          Demander
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Exemples de questions">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={loading}
            onClick={() => {
              setQuestion(suggestion);
              void ask(suggestion);
            }}
            className="min-h-9 rounded-full border border-slate-200 px-3 text-xs font-medium text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
          >
            {suggestion}
          </button>
        ))}
      </div>

      {loading && (
        <div aria-label="Recherche dans les réclamations" aria-busy="true" className="mt-5 space-y-3">
          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-4 w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
          <div className="h-4 w-4/5 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </p>
      )}

      {result && (
        <div aria-live="polite" className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-slate-900 dark:text-white">Réponse</h3><AIBadge label="Réponse IA" /></div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-300">{result.answer}</p>

          {result.sources.length > 0 && (
            <div className="mt-5">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Sources</h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {result.sources.map((source) => (
                  <button
                    key={source.id}
                    type="button"
                    onClick={() => router.push(`/incidents?incident=${encodeURIComponent(source.id)}`)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs transition hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/50"
                  >
                    <span className="max-w-56 truncate font-medium text-slate-800 dark:text-slate-100">{source.title}</span>
                    <span className="shrink-0 text-slate-500 dark:text-slate-400">
                      {incidentStatusLabel[source.status as keyof typeof incidentStatusLabel] ?? source.status}
                    </span>
                    <span className="shrink-0 font-medium text-indigo-700 dark:text-indigo-300">
                      similarité {source.similarity} %
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Réponse générée à partir des {result.sources.length} dossiers les plus proches.{" "}
            {result.coverage.withoutEmbedding} dossiers sans analyse sémantique ne sont pas inclus.
          </p>
        </div>
      )}
    </section>
  );
}
