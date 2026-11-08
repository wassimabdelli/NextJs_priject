"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import { DashboardEmptyState } from "./DashboardEmptyState";

export function IncidentTrendChart({ data }: { data: Array<{ month: string; reported: number; resolved: number }> }) {
  const hasData = data.some((item) => item.reported || item.resolved);
  const chartData = data.map((item) => ({
    ...item,
    label: new Date(`${item.month}-01T00:00:00`).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
  }));
  return (
    <Card className="border-slate-200 shadow-none dark:border-slate-800">
      <div className="p-4 sm:p-5">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Tendance mensuelle</h2>
        {!hasData ? <div className="mt-4"><DashboardEmptyState /></div> : (
          <div className="mt-3 h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="reported" name="Signalées" fill="#0284c7" radius={[4, 4, 0, 0]} />
                <Bar dataKey="resolved" name="Résolues" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  );
}
