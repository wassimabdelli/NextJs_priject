"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import { IncidentCategory } from "@/types/enums";
import { incidentCategoryLabel } from "@/types/enums";
import { DashboardEmptyState } from "./DashboardEmptyState";

const categories = Object.values(IncidentCategory);

export function IncidentCategoryChart({ data }: { data: Array<{ category: IncidentCategory; count: number }> }) {
  const chartData = categories.map((category) => ({
    name: incidentCategoryLabel[category],
    count: data.find((item) => item.category === category)?.count ?? 0,
  }));
  const hasData = chartData.some((item) => item.count > 0);
  return (
    <Card className="border-slate-200 shadow-none dark:border-slate-800">
      <div className="p-4 sm:p-5">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Réclamations par catégorie</h2>
        {!hasData ? <div className="mt-4"><DashboardEmptyState /></div> : (
          <div className="mt-3 h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#cbd5e1" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [value, "Réclamations"]} />
                <Bar dataKey="count" name="Réclamations" fill="#0284c7" radius={[0, 5, 5, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  );
}
