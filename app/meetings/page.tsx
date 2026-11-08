"use client";

import { ResourcePage } from "@/components/crud/ResourcePage";
import { meetingConfig } from "@/lib/resources/registry";

export default function MeetingsPage() {
  return (
    <ResourcePage
      config={meetingConfig}
      title="Assemblées Générales"
      description="Planification des AG, ouverture des sessions de vote et suivi du quorum."
    />
  );
}
