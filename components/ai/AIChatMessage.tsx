"use client";

export function AIChatMessage({ role, content }: { role: "user" | "assistant"; content: string }) {
  return <div className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${role === "user" ? "ml-auto bg-sky-600 text-white" : "mr-auto bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"}`}>
    {content}
  </div>;
}
