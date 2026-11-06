/**
 * Génère un lien de visioconférence stable pour une AG.
 * Jitsi Meet : gratuit, sans compte Google, room unique par meetingId.
 */
export function buildJitsiMeetUrl(meetingId: string, title?: string): string {
  const slug = `SyndicPro-AG-${meetingId}`
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .slice(0, 80);
  const url = new URL(`https://meet.jit.si/${slug}`);
  if (title) {
    url.searchParams.set("config.subject", title.slice(0, 80));
  }
  return url.toString();
}
