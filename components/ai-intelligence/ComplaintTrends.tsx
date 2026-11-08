"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CategoryPoint, StatusPoint, TrendPoint } from "@/types/ai-intelligence";
import { incidentCategoryLabel, incidentStatusLabel } from "@/types/enums";

type Props = { data: TrendPoint[]; categories: CategoryPoint[]; statuses: StatusPoint[] };
const statusColors = ["#f59e0b", "#6366f1", "#8b5cf6", "#10b981"];
const cardClass = "rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6";

function categoryName(category: string) {
  return category in incidentCategoryLabel
    ? incidentCategoryLabel[category as keyof typeof incidentCategoryLabel]
    : category;
}

function statusName(status: string) {
  return status in incidentStatusLabel
    ? incidentStatusLabel[status as keyof typeof incidentStatusLabel]
    : status;
}

export default function ComplaintTrends({ data, categories, statuses }: Props) {
  const trendData = data.map((item) => ({
    ...item,
    label: new Date(`${item.period}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
  }));
  const categoryData = categories.map((item) => ({ name: categoryName(item.category), count: item.count }));
  const statusData = statuses.map((item) => ({ name: statusName(item.status), count: item.count }));
  const hasTrend = trendData.some((item) => item.count > 0);

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Tendances des réclamations</h2>
        <p className="mt-1 text-sm text-slate-500">Volumes observés et répartition selon les données de la période sélectionnée.</p>
      </header>
      <div className="grid gap-4 xl:grid-cols-2">
        <article className={cardClass}>
          <h3 className="font-semibold text-slate-900 dark:text-white">Activité des réclamations</h3>
          <p className="mt-1 text-sm text-slate-500">Signalements quotidiens et réclamations non résolues.</p>
          {!hasTrend ? <div className="flex h-64 items-center justify-center text-sm text-slate-500">Aucune réclamation sur cette période.</div> : (
            <div className="mt-5 h-64 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 8, right: 8, bottom: 4 }}>
                  <defs><linearGradient id="aiComplaintGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.22} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} minTickGap={20} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0", fontSize: 12 }} />
                  <Area type="monotone" dataKey="count" name="Toutes" stroke="#6366f1" strokeWidth={2.5} fill="url(#aiComplaintGradient)" />
                  <Area type="monotone" dataKey="unresolvedCount" name="Non résolues" stroke="#f59e0b" strokeWidth={2} fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>
        <article className={cardClass}>
          <h3 className="font-semibold text-slate-900 dark:text-white">Réclamations par catégorie</h3>
          <p className="mt-1 text-sm text-slate-500">Répartition réelle des signalements de la période.</p>
          {!categoryData.length ? <div className="flex h-64 items-center justify-center text-sm text-slate-500">Aucune donnée de catégorie disponible.</div> : (
            <div className="mt-5 h-64 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={94} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0", fontSize: 12 }} formatter={(value) => [value, "Réclamations"]} />
                  <Bar dataKey="count" name="Réclamations" fill="#6366f1" radius={[0, 5, 5, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>
        <article className={`${cardClass} xl:col-span-2`}>
          <h3 className="font-semibold text-slate-900 dark:text-white">Réclamations par statut</h3>
          <p className="mt-1 text-sm text-slate-500">Les statuts suivent le workflow des réclamations.</p>
          {!statusData.length ? <div className="flex h-56 items-center justify-center text-sm text-slate-500">Aucune donnée de statut disponible.</div> : (
            <div className="grid items-center gap-4 sm:grid-cols-[minmax(160px,260px)_1fr]">
              <div className="relative mx-auto h-56 w-full max-w-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="count" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={3} stroke="none">
                      {statusData.map((item, index) => <Cell key={item.name} fill={statusColors[index % statusColors.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0", fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {statusData.map((item, index) => <li key={item.name} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60"><span className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: statusColors[index % statusColors.length] }} />{item.name}</span><span className="font-semibold tabular-nums text-slate-900 dark:text-white">{item.count.toLocaleString("fr-FR")}</span></li>)}
              </ul>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
