"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { ResourcePage } from "@/components/crud/ResourcePage";
import { voteConfig } from "@/lib/resources/registry";

export default function ClientPage() {
  return (
    <AppLayout>
      <div className="space-y-4 animate-fadeIn pb-12">
        <ResourcePage
          config={voteConfig}
          title="Bulletins de Vote"
          description="Consultation et expression des votes par lot selon les tantièmes de copropriété."
        />
      </div>
    </AppLayout>
  );
}
