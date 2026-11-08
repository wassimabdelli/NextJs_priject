import { Users, CheckCheck, CircleDashed } from "lucide-react";
import { Card } from "@/components/ui/Card";

export interface AnnouncementReadStatsData {
  totalEligibleResidents: number;
  readCount: number;
  unreadCount: number;
  readPercentage: number;
}

export function AnnouncementReadStats({ stats }: { stats: AnnouncementReadStatsData }) {
  return (
    <Card className="space-y-4">
      <div>
        <h3 className="font-semibold text-slate-900 dark:text-white">Suivi des lectures</h3>
        <p className="mt-1 text-sm text-slate-500">Résidents actifs de la résidence concernée</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-valuenow={stats.readPercentage} aria-valuemin={0} aria-valuemax={100} aria-label={`${stats.readPercentage}% des résidents ont lu l'annonce`}>
        <div className="h-full rounded-full bg-sky-600 transition-all" style={{ width: `${stats.readPercentage}%` }} />
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.readPercentage}% <span className="text-sm font-medium text-slate-500">lus</span></p>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><Users className="mb-1 h-4 w-4 text-slate-500" /><strong>{stats.totalEligibleResidents}</strong><p className="text-xs text-slate-500">Éligibles</p></div>
        <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/30"><CheckCheck className="mb-1 h-4 w-4 text-emerald-600" /><strong>{stats.readCount}</strong><p className="text-xs text-slate-500">Lus</p></div>
        <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/30"><CircleDashed className="mb-1 h-4 w-4 text-amber-600" /><strong>{stats.unreadCount}</strong><p className="text-xs text-slate-500">Non lus</p></div>
      </div>
    </Card>
  );
}
