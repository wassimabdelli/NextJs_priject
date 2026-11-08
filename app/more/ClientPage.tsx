"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { MoreHubView } from "@/components/redesign/MoreHubView";
import { TAB_PATHS } from "@/lib/redesign/store";
import { useRouter } from "next/navigation";

export default function MorePage() {
  const router = useRouter();
  return (
    <AppLayout>
      <MoreHubView
        onNavigate={(tab) => {
          const path = TAB_PATHS[tab] || (tab.startsWith("/") ? tab : `/${tab}`);
          router.push(path);
        }}
      />
    </AppLayout>
  );
}
