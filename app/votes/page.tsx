import { Suspense } from "react";
import ClientPage from "./ClientPage";

function Fallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#f4f7fb]">
      <div
        className="size-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"
        role="status"
        aria-label="Chargement"
      />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Fallback />}>
      <ClientPage />
    </Suspense>
  );
}
