export default function AIIntelligenceSkeleton() {
  return (
    <div aria-label="Chargement des analyses" aria-busy="true" className="space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-slate-200 to-indigo-100 p-6 dark:from-slate-900 dark:to-indigo-950">
        <div className="space-y-3"><div className="h-4 w-48 animate-pulse rounded bg-white/70 dark:bg-white/10" /><div className="h-9 w-64 animate-pulse rounded bg-white/70 dark:bg-white/10" /><div className="h-4 w-80 max-w-full animate-pulse rounded bg-white/50 dark:bg-white/5" /></div>
        <div className="mt-5 h-11 w-32 animate-pulse rounded-xl bg-white/70 dark:bg-white/10" />
      </div>
      <div className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl bg-slate-100" />)}</div>
      <div className="grid gap-5 lg:grid-cols-2"><div className="h-80 animate-pulse rounded-2xl bg-slate-100" /><div className="h-80 animate-pulse rounded-2xl bg-slate-100" /></div>
    </div>
  );
}
