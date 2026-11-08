"use client";

import React from "react";
import {
  FileText,
  UploadCloud,
  Search,
  X,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import type { DocumentContract, DocumentCategory } from "@/lib/redesign/condo";
import { fetchWithOffline } from "@/lib/offline/apiClient";
import { DocumentType } from "@/types/enums";
import { documentTypeFr, formatDateFrShort } from "@/components/redesign/apiMappers";

type DocApi = {
  _id: string;
  title: string;
  type: string;
  fileUrl: string;
  uploadedAt?: string;
  residence?: { name?: string };
};

type ListRes = { data: DocApi[] };

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

/** Type API → catégorie affichée (codes redesign alignés sur DocumentType). */
function typeToUiCategory(t: string): DocumentCategory {
  const v = t as DocumentType;
  if (v === DocumentType.MINUTES) return "MINUTES";
  if (v === DocumentType.RULES) return "RULES";
  if (v === DocumentType.CONTRACT) return "CONTRACT";
  if (v === DocumentType.INVOICE) return "INVOICE";
  return "OTHER";
}

export const DocumentsView: React.FC = () => {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("Tous");
  const [showModal, setShowModal] = React.useState(false);
  const [previewDoc, setPreviewDoc] = React.useState<DocumentContract | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [documents, setDocuments] = React.useState<DocumentContract[]>([]);
  const [residenceId, setResidenceId] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);

  const [title, setTitle] = React.useState("");
  const [cat, setCat] = React.useState<DocumentCategory>("CONTRACT");
  const [fileUrl, setFileUrl] = React.useState("");
  const [fileSizeLabel, setFileSizeLabel] = React.useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const mapRow = React.useCallback((d: DocApi): DocumentContract => {
    const category = typeToUiCategory(d.type);
    return {
      id: d._id,
      title: d.title,
      category,
      date: formatDateFrShort(d.uploadedAt),
      fileSize: "—",
      downloadUrl: d.fileUrl,
      residenceName: d.residence?.name ?? "—",
    };
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [docJson, mineJson] = await Promise.all([
        fetchWithOffline<ListRes>("/api/documents?limit=200"),
        fetchWithOffline<{ data: Array<{ _id: string }> }>("/api/residences/mine"),
      ]);
      setDocuments((docJson.data || []).map(mapRow));
      setResidenceId(mineJson.data?.[0]?._id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [mapRow]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const uploadFile = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/documents/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec du téléversement");
      setFileUrl(data.fileUrl);
      setFileSizeLabel(formatFileSize(Number(data.size) || file.size));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload échoué");
    } finally {
      setUploading(false);
    }
  };

  const filtered = documents.filter((d) => {
    const matchesSearch = d.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = categoryFilter === "Tous" || d.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !fileUrl) return;
    if (!residenceId) {
      setError("Aucune résidence : archivage impossible.");
      return;
    }
    const typeMap: Record<DocumentCategory, DocumentType> = {
      MINUTES: DocumentType.MINUTES,
      RULES: DocumentType.RULES,
      CONTRACT: DocumentType.CONTRACT,
      INVOICE: DocumentType.INVOICE,
      OTHER: DocumentType.OTHER,
    };
    setError(null);
    setSuccess(null);
    try {
      await fetchWithOffline("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          residence: residenceId,
          title: title.trim(),
          type: typeMap[cat],
          fileUrl,
        }),
        entity: "document",
      });
      setSuccess("Document archivé.");
      setShowModal(false);
      setTitle("");
      setFileUrl("");
      setFileSizeLabel("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec");
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-white/[0.08] pb-5">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Coffre-fort Numérique
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-0.5">
            Documents & Contrats Copropriété
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Archivage certifié des règlements de copropriété, procès-verbaux, contrats de maintenance et assurances
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <UploadCloud className="w-3.5 h-3.5" />
          <span>Déposer un document</span>
        </button>
      </div>

      {(error || success) && (
        <div className="space-y-2">
          {error && (
            <div
              role="alert"
              className="glass-card rounded-3xl p-4 border border-rose-500/25 bg-rose-500/10 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div
              role="status"
              className="glass-card rounded-3xl p-4 border border-emerald-500/25 bg-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}
        </div>
      )}

      <div className="p-5 rounded-3xl glass-card border border-blue-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Dépôt de document certifié</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Téléversez un document PDF ou une image (max 5 Mo) avec horodatage certifié et archivage immuable.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all shrink-0"
        >
          <UploadCloud className="w-3.5 h-3.5" />
          <span>Téléverser un document</span>
        </button>
      </div>

      <div className="p-4 rounded-3xl glass-card flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par titre de document..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50/80 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Catégorie:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:border-blue-500 cursor-pointer min-h-[44px]"
          >
            <option value="Tous">Toutes</option>
            <option value="CONTRACT">Contrat</option>
            <option value="INVOICE">Facture</option>
            <option value="MINUTES">Procès-verbal</option>
            <option value="RULES">Règlement</option>
            <option value="OTHER">Autre</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="glass-card rounded-3xl p-10 animate-pulse min-h-[200px]" />
      ) : (
        <div className="rounded-3xl glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/60 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/[0.06] text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                <tr>
                  <th className="py-3.5 px-5">Titre</th>
                  <th className="py-3.5 px-4">Résidence</th>
                  <th className="py-3.5 px-4">Catégorie</th>
                  <th className="py-3.5 px-4">Fichier</th>
                  <th className="py-3.5 px-4">Déposé le</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 px-5 text-center text-slate-500">
                      Aucun document.
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors group">
                      <td className="py-3.5 px-5 font-bold text-slate-900 dark:text-white">{item.title}</td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">{item.residenceName}</td>
                      <td className="py-3.5 px-4">
                        <span className="text-[11px] font-bold text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-0.5 rounded-full border border-blue-500/25">
                          {documentTypeFr(item.category)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(item)}
                          className="flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          <span>Consulter</span>
                          {item.fileSize && item.fileSize !== "—" && (
                            <span className="text-[10px] text-slate-400 font-mono">({item.fileSize})</span>
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500 dark:text-slate-400">{item.date}</td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(item)}
                          className="px-3 py-1.5 rounded-xl bg-blue-600/10 hover:bg-blue-600 text-blue-600 hover:text-white dark:text-blue-400 border border-blue-500/25 text-xs font-bold transition-all shadow-xs"
                        >
                          Aperçu
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md animate-fadeIn"
          onClick={() => setShowModal(false)}
        >
          <div className="w-full max-w-md glass-card rounded-3xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-white/[0.08]">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Déposer un document</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleCreate(e)} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Titre du document *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Contrat d’entretien ascenseur 2026"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full min-h-[44px] text-base md:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Catégorie</label>
                <select
                  value={cat}
                  onChange={(e) => setCat(e.target.value as DocumentCategory)}
                  className="w-full min-h-[44px] text-base md:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/[0.1] rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium"
                >
                  <option value="CONTRACT">Contrat</option>
                  <option value="INVOICE">Facture</option>
                  <option value="MINUTES">Procès-verbal (PV)</option>
                  <option value="RULES">Règlement de copropriété</option>
                  <option value="OTHER">Autre document</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Fichier (PDF ou image)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadFile(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-slate-300 dark:border-white/15 rounded-2xl p-5 text-center cursor-pointer hover:border-blue-500 transition-colors bg-slate-50/50 dark:bg-white/[0.02] min-h-[44px]"
                >
                  <UploadCloud className="w-7 h-7 text-blue-500 mx-auto mb-1.5" />
                  <span className="text-slate-700 dark:text-slate-200 font-bold block">
                    Sélectionner un fichier PDF certifié
                  </span>
                  <span className="block text-[11px] text-slate-400 mt-1">Taille maximale autorisée : 5 Mo</span>
                  {uploading && <span className="block text-[11px] text-amber-600 mt-2">Téléversement…</span>}
                  {fileUrl && (
                    <span className="block text-[11px] text-emerald-600 dark:text-emerald-400 mt-2 font-semibold truncate">
                      Fichier prêt {fileSizeLabel ? `(${fileSizeLabel})` : ""}
                    </span>
                  )}
                </button>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!fileUrl}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-md shadow-blue-500/20 disabled:opacity-50"
                >
                  Archiver le document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md animate-fadeIn"
          onClick={() => setPreviewDoc(null)}
        >
          <div className="w-full max-w-lg glass-card rounded-3xl p-6 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/[0.08]">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{previewDoc.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {previewDoc.residenceName} · {documentTypeFr(previewDoc.category)}
                </p>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-8 bg-slate-50 dark:bg-black/20 rounded-2xl border border-slate-200/60 dark:border-white/[0.06] text-center space-y-3">
              <FileText className="w-12 h-12 text-blue-500 mx-auto" />
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">Document certifié et signé numériquement</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Horodatage d’archivage légal : {previewDoc.date}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 font-semibold text-xs"
              >
                Fermer
              </button>
              {previewDoc.downloadUrl && (
                <a
                  href={previewDoc.downloadUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20"
                >
                  Télécharger le fichier
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
