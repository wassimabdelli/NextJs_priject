export function AIBadge({ label = "Suggestion IA" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
      ✨ {label}
    </span>
  );
}
