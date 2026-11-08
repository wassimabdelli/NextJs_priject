"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AnnouncementContent } from "./AnnouncementContent";
import { AnnouncementCategoryBadge, AnnouncementPriorityBadge } from "./AnnouncementBadges";
import { AIAnnouncementGenerator } from "@/components/ai/AIAnnouncementGenerator";
import { AITranslationPanel } from "@/components/ai/AITranslationPanel";
import type { AnnouncementItem, AnnouncementResidence, AnnouncementAttachment } from "./types";
import type { AnnouncementAudience, AnnouncementCategory, AnnouncementPriority, AnnouncementStatus } from "@/types/enums";

type PublishMode = "DRAFT" | "PUBLISHED" | "SCHEDULED";

function localDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

export function AnnouncementEditor({
  initial,
  residences,
  onClose,
  onSubmit,
  saving,
}: {
  initial: AnnouncementItem | null;
  residences: AnnouncementResidence[];
  onClose: () => void;
  onSubmit: (data: {
    residence: string;
    title: string;
    content: string;
    category: AnnouncementCategory;
    priority: AnnouncementPriority;
    audience: AnnouncementAudience;
    status: AnnouncementStatus;
    scheduledAt: string | null;
    expiresAt: string | null;
    isPinned: boolean;
    attachments: AnnouncementAttachment[];
    files: File[];
  }) => Promise<void>;
  saving: boolean;
}) {
  const initialResidence = typeof initial?.residence === "string" ? initial.residence : initial?.residence._id;
  const [residence, setResidence] = useState(initialResidence || residences[0]?._id || "");
  const [title, setTitle] = useState(initial?.title || "");
  const [content, setContent] = useState(initial?.content || "");
  const [category, setCategory] = useState<AnnouncementCategory>(initial?.category || "GENERAL");
  const [priority, setPriority] = useState<AnnouncementPriority>(initial?.priority || "NORMAL");
  const [audience, setAudience] = useState<AnnouncementAudience>(initial?.audience || "RESIDENTS");
  const [status, setStatus] = useState<PublishMode>(
    initial?.status === "SCHEDULED" ? "SCHEDULED" : initial?.status === "DRAFT" ? "DRAFT" : "PUBLISHED"
  );
  const [scheduledAt, setScheduledAt] = useState(localDateTime(initial?.scheduledAt));
  const [expiresAt, setExpiresAt] = useState(localDateTime(initial?.expiresAt));
  const [isPinned, setIsPinned] = useState(initial?.isPinned || false);
  const [attachments, setAttachments] = useState(initial?.attachments || []);
  const [files, setFiles] = useState<File[]>([]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSubmit({
      residence,
      title,
      content,
      category,
      priority,
      audience,
      status,
      scheduledAt: status === "SCHEDULED" && scheduledAt ? new Date(scheduledAt).toISOString() : null,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      isPinned,
      attachments,
      files,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <form onSubmit={submit} className="max-h-[95vh] w-full max-w-6xl space-y-4 overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl dark:bg-slate-900 sm:rounded-2xl sm:p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{initial ? "Modifier l'annonce" : "Nouvelle annonce"}</h2>
            <p className="mt-1 text-sm text-slate-500">Les annonces planifiées restent invisibles jusqu&apos;à leur date de publication.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
        </header>

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <section className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Contenu</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300 sm:col-span-2">Titre
                  <input required minLength={3} maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800" />
                </label>
                <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300">Catégorie
                  <select value={category} onChange={(event) => setCategory(event.target.value as AnnouncementCategory)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800">
                    <option value="GENERAL">Général</option><option value="MAINTENANCE">Maintenance</option><option value="SECURITY">Sécurité</option><option value="MEETING">Réunion</option><option value="PAYMENT">Paiement</option><option value="EMERGENCY">Urgence</option><option value="OTHER">Autre</option>
                  </select>
                </label>
                <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300">Priorité
                  <select value={priority} onChange={(event) => setPriority(event.target.value as AnnouncementPriority)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800">
                    <option value="LOW">Basse</option><option value="NORMAL">Normale</option><option value="HIGH">Haute</option><option value="URGENT">Urgente</option>
                  </select>
                </label>
                <label htmlFor="announcement-content" className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300 sm:col-span-2">
                  <span className="block">Texte (Markdown léger : **gras**, - liste, [lien](https://...))</span>
                  <textarea id="announcement-content" required minLength={3} maxLength={20_000} rows={7} value={content} onChange={(event) => setContent(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-800" />
                </label>
              </div>
              <AIAnnouncementGenerator
                title={title}
                content={content}
                category={category}
                audience={audience}
                residenceId={residence}
                onApply={(suggestion) => {
                  setTitle(suggestion.title);
                  setContent(suggestion.content);
                  setCategory(suggestion.suggestedCategory);
                  setPriority(suggestion.suggestedPriority);
                }}
              />
              <AITranslationPanel content={content} onApply={setContent} />
            </section>

            <section className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Diffusion</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300 sm:col-span-2">Résidence
                  <select required value={residence} onChange={(event) => setResidence(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800">
                    <option value="">Choisir une résidence</option>{residences.map((item) => <option key={item._id} value={item._id}>{item.name}{item.city ? ` — ${item.city}` : ""}</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300">Destinataires
                  <select value={audience} onChange={(event) => setAudience(event.target.value as AnnouncementAudience)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800">
                    <option value="RESIDENTS">Résidents</option><option value="TECHNICIANS">Techniciens</option><option value="ALL">Tous</option>
                  </select>
                </label>
                <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300">Expiration (facultative)
                  <input type="datetime-local" min={status === "SCHEDULED" ? scheduledAt : localDateTime(new Date().toISOString())} value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800" />
                </label>
                {status === "SCHEDULED" && <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300 sm:col-span-2">Date et heure de publication
                  <input type="datetime-local" required min={localDateTime(new Date().toISOString())} value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800" />
                </label>}
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 sm:col-span-2">
                  <input type="checkbox" checked={isPinned} onChange={(event) => setIsPinned(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-sky-600" /> Épingler en haut du fil
                </label>
              </div>
            </section>

            <section className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Pièces jointes</h3>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">PDF/JPG/PNG, 5 Mo chacune, 5 maximum
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" multiple onChange={(event) => {
                  const added = Array.from(event.target.files || []);
                  if (attachments.length + files.length + added.length > 5) {
                    window.alert("Vous pouvez ajouter jusqu'à 5 pièces jointes.");
                    event.target.value = "";
                    return;
                  }
                  setFiles((current) => [...current, ...added]);
                }} className="mt-2 block w-full text-sm" />
              </label>
              <ul className="space-y-1 text-xs text-slate-500">
                {attachments.map((item) => <li key={item.url} className="flex items-center justify-between gap-2"><span className="truncate">{item.name}</span><button type="button" onClick={() => setAttachments((current) => current.filter((value) => value.url !== item.url))} className="text-rose-600">Retirer</button></li>)}
                {files.map((file, index) => <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2"><span className="truncate">{file.name}</span><button type="button" onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} className="text-rose-600">Retirer</button></li>)}
              </ul>
            </section>
          </div>

          <aside className="hidden md:block">
            <div className="sticky top-2 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Aperçu en direct</h3>
              <div className="flex flex-wrap gap-2">
                <AnnouncementCategoryBadge category={category} />
                <AnnouncementPriorityBadge priority={priority} />
              </div>
              <h4 className="break-words text-lg font-bold text-slate-900 dark:text-white">{title || "Titre de l’annonce"}</h4>
              <div className="min-h-24 border-t border-slate-200 pt-3 dark:border-slate-700">
                <AnnouncementContent content={content || "Le contenu de l’annonce apparaîtra ici."} />
              </div>
            </div>
          </aside>
        </div>

        <footer className="flex flex-col gap-3 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-slate-600 dark:text-slate-300">Mode de publication</legend>
            <div className="inline-flex max-w-full rounded-xl border border-slate-200 p-1 dark:border-slate-700" role="radiogroup" aria-label="Mode de publication">
              {([
                ["DRAFT", "Brouillon"],
                ["PUBLISHED", "Publier"],
                ["SCHEDULED", "Programmer"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={status === value}
                  onClick={() => setStatus(value)}
                  className={`min-h-[44px] rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 sm:text-sm ${status === value ? "bg-sky-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button type="submit" isLoading={saving} disabled={!residence || residences.length === 0}>{initial ? "Enregistrer" : status === "DRAFT" ? "Enregistrer le brouillon" : status === "SCHEDULED" ? "Programmer" : "Publier"}</Button>
          </div>
        </footer>
      </form>
    </div>
  );
}
