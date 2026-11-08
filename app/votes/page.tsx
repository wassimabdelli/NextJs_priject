"use client";

import { ResourcePage } from "@/components/crud/ResourcePage";
import { voteConfig } from "@/lib/resources/registry";

export default function VotesPage() {
  return (
    <ResourcePage
      config={voteConfig}
      title="Bulletins de Vote"
      description="Consultation et expression des votes par lot selon les tantièmes de copropriété."
    />
  );
}
