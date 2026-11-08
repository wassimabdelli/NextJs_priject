"use client";

import { LoaderCircle } from "lucide-react";

export function AILoading({ label = "Gemini prépare une suggestion…" }: { label?: string }) {
  return <p role="status" className="flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />{label}</p>;
}
