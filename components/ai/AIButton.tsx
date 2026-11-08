"use client";

import type { ButtonHTMLAttributes } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function AIButton({
  children = "Assistant IA",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) {
  return <Button type="button" variant="outline" {...props}><Sparkles className="h-4 w-4 text-sky-600" />{children}</Button>;
}
