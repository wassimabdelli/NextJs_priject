"use client";

import React, { useEffect, useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { CheckCircle2, XCircle, AlertCircle, BarChart3, Users, Scale } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";

interface ResolutionResults {
  resolution: {
    _id: string;
    title: string;
    description?: string;
    requiredMajority: number;
  };
  tally: {
    FOR: number;
    AGAINST: number;
    ABSTAIN: number;
  };
  expressedVotes: number;
  totalVotedWeight: number;
  approvalRate: number;
  isAdopted: boolean;
  isQuorumReached: boolean;
  quorum: {
    totalShares: number;
    presentShares: number;
    percentage: number;
    requiredPercentage: number;
  };
  voteCount: number;
}

interface Props {
  resolutionId: string | null;
  onClose: () => void;
}

const COLORS = {
  FOR: "#10b981", // Emerald
  AGAINST: "#f43f5e", // Rose
  ABSTAIN: "#94a3b8", // Slate
};

export function ResolutionResultsModal({ resolutionId, onClose }: Props) {
  const [data, setData] = useState<ResolutionResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!resolutionId) return;

    setLoading(true);
    setError(null);

    fetch(`/api/resolutions/${resolutionId}/results`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Erreur serveur (${res.status})`);
        }
        return res.json();
      })
      .then((resData) => setData(resData))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [resolutionId]);

  const chartData = data
    ? [
        { name: "Pour", value: data.tally.FOR, color: COLORS.FOR },
        { name: "Contre", value: data.tally.AGAINST, color: COLORS.AGAINST },
        { name: "Abstention", value: data.tally.ABSTAIN, color: COLORS.ABSTAIN },
      ].filter((item) => item.value > 0)
    : [];

  return (
    <BottomSheet
      isOpen={Boolean(resolutionId)}
      onClose={onClose}
      title="Dépouillement & Résultats du Vote"
      description={data?.resolution.title || "Résultats pondérés de la résolution"}
    >
      <div className="space-y-4 pt-2">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-400">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : data ? (
          <>
            {/* Verdict d'adoption et quorum */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div
                className={`flex items-center gap-3 rounded-xl p-3.5 border ${
                  data.isAdopted
                    ? "border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                    : "border-rose-200 bg-rose-50/70 text-rose-900 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300"
                }`}
              >
                {data.isAdopted ? (
                  <CheckCircle2 className="h-7 w-7 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="h-7 w-7 text-rose-600 shrink-0" />
                )}
                <div>
                  <p className="text-xs uppercase tracking-wide font-bold opacity-75">
                    Résultat de la résolution
                  </p>
                  <p className="text-base font-extrabold">
                    {data.isAdopted ? "ADOPTÉE" : "REJETÉE"}
                  </p>
                  <p className="text-[11px] opacity-80">
                    {data.approvalRate}% des voix exprimées (Requis : {data.resolution.requiredMajority}%)
                  </p>
                </div>
              </div>

              <div
                className={`flex items-center gap-3 rounded-xl p-3.5 border ${
                  data.isQuorumReached
                    ? "border-sky-200 bg-sky-50/70 text-sky-900 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-300"
                    : "border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                }`}
              >
                <Scale
                  className={`h-7 w-7 shrink-0 ${
                    data.isQuorumReached ? "text-sky-600" : "text-amber-600"
                  }`}
                />
                <div>
                  <p className="text-xs uppercase tracking-wide font-bold opacity-75">
                    Quorum de l&apos;Assemblée
                  </p>
                  <p className="text-base font-extrabold">
                    {data.isQuorumReached ? "ATTEINT (> 50%)" : "NON ATTEINT (&le; 50%)"}
                  </p>
                  <p className="text-[11px] opacity-80">
                    {data.quorum.presentShares} / {data.quorum.totalShares} tantièmes ({data.quorum.percentage}%)
                  </p>
                </div>
              </div>
            </div>

            {/* Graphique Recharts */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4 text-sky-500" />
                  Répartition des voix (Tantièmes)
                </span>
                <span className="text-xs text-slate-500">
                  {data.voteCount} bulletin(s) • {data.totalVotedWeight} tantièmes
                </span>
              </div>

              {chartData.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Aucun vote exprimé pour le moment.
                </div>
              ) : (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: any) => [`${val} tantièmes`, "Poids"]}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Synthèse chiffrée détaillée */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-2.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <p className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
                  Pour
                </p>
                <p className="text-lg font-extrabold text-emerald-800 dark:text-emerald-300">
                  {data.tally.FOR}
                </p>
                <p className="text-[10px] text-emerald-600">tantièmes</p>
              </div>

              <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-2.5 dark:border-rose-900/40 dark:bg-rose-950/20">
                <p className="text-[10px] font-bold uppercase text-rose-700 dark:text-rose-400">
                  Contre
                </p>
                <p className="text-lg font-extrabold text-rose-800 dark:text-rose-300">
                  {data.tally.AGAINST}
                </p>
                <p className="text-[10px] text-rose-600">tantièmes</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
                <p className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400">
                  Abstention
                </p>
                <p className="text-lg font-extrabold text-slate-700 dark:text-slate-200">
                  {data.tally.ABSTAIN}
                </p>
                <p className="text-[10px] text-slate-500">tantièmes</p>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </BottomSheet>
  );
}
