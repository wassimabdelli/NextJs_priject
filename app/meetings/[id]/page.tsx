import { Suspense } from "react";
import MeetingAgPackClient from "./MeetingAgPackClient";

function PackFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div
        className="size-8 animate-spin rounded-full border-4 border-sky-600 border-t-transparent"
        role="status"
        aria-label="Chargement"
      />
    </div>
  );
}

/** Lit params à l'intérieur de Suspense (Cache Components / Next 16). */
async function MeetingAgPackLoader({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MeetingAgPackClient id={id} />;
}

export default function MeetingAgPackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<PackFallback />}>
      <MeetingAgPackLoader params={params} />
    </Suspense>
  );
}
