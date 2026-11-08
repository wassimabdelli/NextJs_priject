"use client";

import { ResourcePage } from "@/components/crud/ResourcePage";
import { expenseConfig } from "@/lib/resources/registry";

export default function ExpensesPage() {
  return <ResourcePage config={expenseConfig} />;
}
