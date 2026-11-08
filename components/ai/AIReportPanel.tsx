"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AIError } from "./AIError";
import { AILoading } from "./AILoading";
import { AIResultCard } from "./AIResultCard";

interface Report {
  summary: string;
  observations: string[];
  recommendations: string[];
}

export function AIReportPanel({ endpoint, title }: { endpoint: string; title: string }) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Rapport IA indisponible.");
      setReport(data as Report);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de produire le rapport."); }
    finally { setLoading(false); }
  };

  return <section className="space-y-3">
    <Button type="button" variant="outline" onClick={() => void generate()} disabled={loading}><Sparkles className="h-4 w-4" />{title}</Button>
    {loading && <AILoading label="Analyse des statistiques…" />}
    {error && <AIError message={error} />}
    {report && <AIResultCard title="Rapport IA — basé sur les statistiques de la base">
      <p className="font-medium">{report.summary}</p>
      {report.observations.length > 0 && <div className="mt-3"><strong>Observations</strong><ul className="mt-1 list-disc space-y-1 pl-5">{report.observations.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
      {report.recommendations.length > 0 && <div className="mt-3"><strong>Pistes de réflexion</strong><ul className="mt-1 list-disc space-y-1 pl-5">{report.recommendations.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
      <p className="mt-3 text-xs">L’IA explique les indicateurs calculés par SyndicPro; vérifiez les recommandations avant d’agir.</p>
    </AIResultCard>}
  </section>;
}
