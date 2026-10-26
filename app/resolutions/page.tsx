"use client";

import React, { useState } from "react";
import { BarChart3 } from "lucide-react";
import { ResourcePage } from "@/components/crud/ResourcePage";
import { resolutionConfig } from "@/lib/resources/registry";
import { Button } from "@/components/ui/Button";
import { ResolutionResultsModal } from "@/components/governance/ResolutionResultsModal";
import type { ResolutionDTO } from "@/types/api";

export default function ResolutionsPage() {
  const [selectedResolutionId, setSelectedResolutionId] = useState<string | null>(null);

  return (
    <>
      <ResourcePage<ResolutionDTO>
        config={resolutionConfig}
        title="Résolutions d'AG"
        description="Textes soumis au vote en assemblée générale, majorités requises et résultats."
        headerExtra={(items) => (
          <div className="flex flex-col gap-2 rounded-2xl border border-sky-500/20 bg-sky-50/50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-sky-500/20 dark:bg-sky-950/20">
            <div>
              <h4 className="text-sm font-bold text-sky-950 dark:text-sky-200">
                Dépouillement des votes & Quorum
              </h4>
              <p className="text-xs text-sky-700/80 dark:text-sky-400">
                Visualisez la répartition des voix exprimées (POUR, CONTRE, ABSTENTION) et le quorum.
              </p>
            </div>
            {items && items.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => setSelectedResolutionId(items[0]._id)}
                  className="min-h-[44px] gap-2 text-xs sm:min-h-[36px]"
                >
                  <BarChart3 className="h-4 w-4" />
                  Voir les résultats ({items[0].title.slice(0, 20)}...)
                </Button>
              </div>
            )}
          </div>
        )}
      />

      <ResolutionResultsModal
        resolutionId={selectedResolutionId}
        onClose={() => setSelectedResolutionId(null)}
      />
    </>
  );
}
