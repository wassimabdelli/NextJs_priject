export function redactPII(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[EMAIL]")
    .replace(/(?:\+?216[\s.-]?)?(?:\d[\s.-]?){8}/g, "[TEL]")
    .replace(/\b(?:apt|appartement|app)\.?\s*n?°?\s*\d+\w?\b/gi, "[APPT]");
}
