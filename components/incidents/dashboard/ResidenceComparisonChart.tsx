"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import { DashboardEmptyState } from "./DashboardEmptyState";

export function ResidenceComparisonChart({ data }: { data: Array<{ residenceId: string; name: string; incidents: number }> }) {
  return (
    <Card className="border-slate-200 shadow-none dark:border-slate-800">
      <div className="p-4 sm:p-5">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Comparaison des résidences</h2>
        {!data.length ? <div className="mt-4"><DashboardEmptyState message="Aucune donnée de résidence pour cette période." /></div> : (
          <div className="mt-3 h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ left: 8, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#cbd5e1" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [value, "Réclamations"]} />
                <Bar dataKey="incidents" name="Réclamations" fill="#8b5cf6" radius={[0, 5, 5, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  );
}
