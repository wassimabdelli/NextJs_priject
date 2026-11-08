function tokens(text: string) {
  const normalized = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(lift|elevator)\b/g, "ascenseur")
    .replace(/\b(leak|flood|infiltration)\b/g, "fuite")
    .replace(/[^\p{L}\p{N}]+/gu, " ");
  return new Set(normalized.split(/\s+/).filter((word) => word.length > 2));
}

export function similarityScore(left: string, right: string) {
  const a = tokens(left);
  const b = tokens(right);
  const union = new Set([...a, ...b]).size;
  if (!union) return 0;
  const intersection = [...a].filter((word) => b.has(word)).length;
  return intersection / union;
}

export async function explainDuplicates(
  userId: string,
  current: { title: string; description: string },
  candidates: Array<{ incidentId: string; title: string; description: string; status: string }>
) {
  const [{ generateValidated }, { duplicateExplanationSchema }, { structuredPrompt }] =
    await Promise.all([
      import("./provider"),
      import("./schemas"),
      import("./prompts"),
    ]);

  return generateValidated(
    userId,
    "incident-duplicates",
    duplicateExplanationSchema,
    structuredPrompt("For each candidate, decide only whether it may describe the same physical issue as the new incident. Be conservative; return matches with a concise explanation. Do not infer identity or disclose personal information.", { current, candidates })
  );
}
