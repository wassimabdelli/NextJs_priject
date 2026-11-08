"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card } from "@/components/ui/Card";
import { incidentStatusLabel, IncidentStatus } from "@/types/enums";
import { DashboardEmptyState } from "./DashboardEmptyState";

const colors: Record<IncidentStatus, string> = {
  REPORTED: "#f97316",
  ASSIGNED: "#eab308",
  IN_PROGRESS: "#0ea5e9",
  RESOLVED: "#10b981",
};

export function IncidentStatusChart({ data, total }: { data: Array<{ status: IncidentStatus; count: number }>; total: number }) {
  const chartData = Object.values(IncidentStatus).map((status) => ({
    status,
    name: incidentStatusLabel[status],
    value: data.find((item) => item.status === status)?.count ?? 0,
  }));
  return (
    <Card className="border-slate-200 shadow-none dark:border-slate-800">
      <div className="p-4 sm:p-5">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Réclamations par statut</h2>
        {total === 0 ? <div className="mt-4"><DashboardEmptyState /></div> : (
          <div className="mt-3 grid grid-cols-1 items-center gap-3 sm:grid-cols-[minmax(160px,1fr)_minmax(140px,0.8fr)]">
            <div className="relative h-52 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={3} stroke="none">
                    {chartData.map((item) => <Cell key={item.status} fill={colors[item.status]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => [value, "Réclamations"]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">{total}</span>
                <span className="text-xs text-slate-500">au total</span>
              </div>
            </div>
            <ul className="space-y-2">
              {chartData.map((item) => (
                <li key={item.status} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-slate-600 dark:text-slate-300"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colors[item.status] }} />{item.name}</span>
                  <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{item.value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
