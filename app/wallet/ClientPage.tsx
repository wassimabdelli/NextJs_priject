"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { WalletView } from "@/components/redesign/WalletView";
import { useRedesign } from "@/lib/redesign/store";

export default function WalletPage() {
  const store = useRedesign();
  return (
    <AppLayout>
      <WalletView currentUser={store.currentUser} residence={store.activeResidence} />
    </AppLayout>
  );
}
