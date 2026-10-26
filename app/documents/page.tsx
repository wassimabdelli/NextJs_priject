"use client";

import React, { useState, useEffect, useRef } from "react";
import { UploadCloud, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { ResourcePage } from "@/components/crud/ResourcePage";
import { documentConfig } from "@/lib/resources/registry";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { fetchWithOffline } from "@/lib/offline/apiClient";
import { Role } from "@/types/enums";
import { getOfflineSession } from "@/lib/offline/db";

export default function DocumentsPage() {
  const [userRole, setUserRole] = useState<Role | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [residences, setResidences] = useState<Array<{ label: string; value: string }>>([]);
  const [selectedResidence, setSelectedResidence] = useState("");
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("OTHER");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.role) setUserRole(data.user.role as Role);
      })
      .catch(() => {
        getOfflineSession().then((offline) => {
          if (offline) setUserRole(offline.role);
        });
      });

    // Chargement des résidences
    fetchWithOffline<any>("/api/residences")
      .then((res) => {
        const items = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        const opts = items.map((r: any) => ({
          label: r.name,
          value: r._id,
        }));
        setResidences(opts);
        if (opts.length > 0) setSelectedResidence(opts[0].value);
      })
      .catch(() => {});
  }, []);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErrorMessage("Veuillez choisir un fichier (PDF ou image, max 5 Mo).");
      return;
    }
    if (!selectedResidence) {
      setErrorMessage("Veuillez sélectionner une résidence.");
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    try {
      // 1. Envoi du fichier à /api/documents/upload
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadData.error || "Erreur lors du téléversement du fichier");
      }

      // 2. Création de la ressource Document avec l'URL renvoyée
      const createRes = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          residence: selectedResidence,
          title: title.trim() || file.name,
          type: docType,
          fileUrl: uploadData.fileUrl,
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) {
        throw new Error(createData.error || "Erreur lors de l'enregistrement du document");
      }

      setSuccessMessage("Document téléversé et enregistré avec succès !");
      setIsModalOpen(false);
      setTitle("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setRefreshTrigger((prev) => prev + 1);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Erreur de téléversement");
    } finally {
      setIsUploading(false);
    }
  };

  const isStaff = userRole === Role.ADMIN || userRole === Role.SYNDIC;

  return (
    <>
      <ResourcePage
        key={refreshTrigger}
        config={documentConfig}
        title="Documents & Contrats"
        description="Règlements, procès-verbaux, contrats et attestations de la copropriété."
        headerExtra={() => (
          <div className="space-y-3">
            {successMessage && (
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-50/80 p-3.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{successMessage}</span>
              </div>
            )}

            {isStaff && (
              <div className="flex flex-col gap-2 rounded-2xl border border-sky-500/20 bg-sky-50/50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-sky-500/20 dark:bg-sky-950/20">
                <div>
                  <h4 className="text-sm font-bold text-sky-950 dark:text-sky-200">
                    Dépôt de document certifié
                  </h4>
                  <p className="text-xs text-sky-700/80 dark:text-sky-400">
                    Téléversez un document PDF ou une image (max 5 Mo) validé côté serveur.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    setErrorMessage(null);
                    setIsModalOpen(true);
                  }}
                  className="min-h-[44px] gap-2 whitespace-nowrap text-xs sm:min-h-[36px]"
                >
                  <UploadCloud className="h-4 w-4" />
                  Téléverser un document
                </Button>
              </div>
            )}
          </div>
        )}
      />

      <BottomSheet
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Téléverser un document"
        description="Fichier PDF ou image jusqu'à 5 Mo, stocké de façon sécurisée."
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4 pt-2 pb-4">
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <Select
            label="Résidence concernée"
            required
            options={residences}
            value={selectedResidence}
            onChange={(e) => setSelectedResidence(e.target.value)}
            disabled={isUploading}
          />

          <Input
            label="Titre du document"
            placeholder="Ex : PV Assemblée Générale 2026"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            disabled={isUploading}
          />

          <Select
            label="Catégorie de document"
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            required
            disabled={isUploading}
            options={[
              { label: "Procès-verbal d'assemblée", value: "MINUTES" },
              { label: "Règlement de copropriété", value: "RULES" },
              { label: "Contrat", value: "CONTRACT" },
              { label: "Facture", value: "INVOICE" },
              { label: "Autre", value: "OTHER" },
            ]}
          />

          {/* Fichier input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Fichier (PDF ou image JPEG/PNG/WEBP, max 5 Mo)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const files = e.target.files;
                if (files && files[0]) {
                  setFile(files[0]);
                  if (!title) setTitle(files[0].name.replace(/\.[^/.]+$/, ""));
                }
              }}
              required
              className="block w-full text-xs text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-sky-50 file:px-4 file:py-2.5 file:text-xs file:font-semibold file:text-sky-700 hover:file:bg-sky-100 dark:text-slate-400 dark:file:bg-sky-950/40 dark:file:text-sky-300"
            />
            {file && (
              <p className="text-[11px] text-slate-500">
                Fichier sélectionné : {file.name} ({(file.size / 1024 / 1024).toFixed(2)} Mo)
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={isUploading}
              className="min-h-[44px]"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isUploading}
              className="min-h-[44px]"
            >
              Téléverser et enregistrer
            </Button>
          </div>
        </form>
      </BottomSheet>
    </>
  );
}
