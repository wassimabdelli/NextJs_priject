"use client";

import { ResourcePage } from "@/components/crud/ResourcePage";
import { announcementConfig } from "@/lib/resources/registry";

export default function AnnouncementsPage() {
  return <ResourcePage config={announcementConfig} />;
}
