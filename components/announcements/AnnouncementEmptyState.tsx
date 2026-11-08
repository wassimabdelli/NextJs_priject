import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function AnnouncementEmptyState({
  message = "Aucune annonce ne correspond à ces filtres.",
  onCreate,
}: {
  message?: string;
  onCreate?: () => void;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-300">
        <Megaphone aria-hidden="true" className="h-8 w-8" />
      </span>
      <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">Rien à afficher</h3>
      <p className="mt-1 text-sm text-slate-500">{message}</p>
      {onCreate && <Button type="button" onClick={onCreate} className="mt-5 min-h-[44px]">Créer une annonce</Button>}
    </div>
  );
}
