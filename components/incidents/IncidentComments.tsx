"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Paperclip, Send, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { compressIncidentImage } from "./compressIncidentImage";

interface CommentEntry {
  _id: string;
  content: string;
  attachments: string[];
  createdAt: string;
  author?: { _id?: string; name?: string; role?: string } | null;
}

function chronological(comments: CommentEntry[]) {
  return [...comments].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  );
}

export function IncidentComments({ incidentId, currentUserId }: { incidentId: string; currentUserId: string }) {
  const [comments, setComments] = useState<CommentEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [readingFiles, setReadingFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/incidents/${incidentId}/comments?limit=50`, { signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible de charger la discussion.");
      setComments(chronological(Array.isArray(result.data) ? result.data : []));
      setTotal(Number(result.meta?.total) || 0);
      setPage(Number(result.meta?.page) || 1);
    } catch (err) {
      if (!signal.aborted) setError(err instanceof Error ? err.message : "Impossible de charger la discussion.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [incidentId]);

  const loadMore = async () => {
    setLoadingMore(true);
    setError(null);
    try {
      const response = await fetch(`/api/incidents/${incidentId}/comments?page=${page + 1}&limit=50`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible de charger la suite de la discussion.");
      setComments((current) => chronological([...current, ...(Array.isArray(result.data) ? result.data : [])]));
      setPage(Number(result.meta?.page) || page + 1);
      setTotal(Number(result.meta?.total) || total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger la suite de la discussion.");
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load, reload]);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const selected = Array.from(files).slice(0, Math.max(0, 3 - attachments.length));
    if (!selected.length) {
      setError("Maximum 3 pièces jointes par commentaire.");
      return;
    }
    setReadingFiles(true);
    setError(null);
    try {
      const values = await Promise.all(selected.map(compressIncidentImage));
      setAttachments((current) => [...current, ...values].slice(0, 3));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de lire la pièce jointe.");
    } finally {
      setReadingFiles(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!content.trim() || sending || readingFiles) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/incidents/${incidentId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, attachments }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible d'envoyer le commentaire.");
      setComments((current) => chronological([...current, result]));
      setTotal((current) => current + 1);
      setContent("");
      setAttachments([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'envoyer le commentaire.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="flex min-h-[360px] flex-col gap-3">
      <div className="flex-1 space-y-3">
        {loading ? (
          <div className="animate-pulse space-y-3" aria-label="Chargement de la discussion">
            <div className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800" />
            <div className="ml-8 h-20 rounded-xl bg-slate-100 dark:bg-slate-800" />
          </div>
        ) : error && comments.length === 0 ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
            <p>{error}</p>
            <Button className="mt-3" variant="outline" size="sm" onClick={() => setReload((value) => value + 1)}>Réessayer</Button>
          </div>
        ) : comments.length === 0 ? (
          <div className="rounded-xl bg-slate-50 p-6 text-center dark:bg-slate-800/50">
            <MessageCircle className="mx-auto h-7 w-7 text-slate-400" />
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">No comments yet. Start the discussion.</p>
          </div>
        ) : comments.map((comment) => {
          const ownComment = comment.author?._id === currentUserId;
          return (
            <article key={comment._id} className={`max-w-[92%] rounded-2xl border p-3 sm:max-w-[80%] ${ownComment ? "ml-auto border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/30" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"}`}>
              <p className="whitespace-pre-wrap break-words text-sm text-slate-800 dark:text-slate-100">{comment.content}</p>
              {comment.attachments.length > 0 && (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {comment.attachments.map((src, index) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={`${comment._id}-${index}`} src={src} alt={`Pièce jointe ${index + 1}`} className="aspect-square w-full rounded-lg border border-slate-200 object-cover dark:border-slate-700" />
                  ))}
                </div>
              )}
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                {comment.author?.name || "Utilisateur"}{comment.author?.role ? ` · ${comment.author.role}` : ""}
                {" · "}
                <time dateTime={comment.createdAt} title={new Date(comment.createdAt).toLocaleString("fr-FR")}>
                  {new Date(comment.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                </time>
              </p>
            </article>
          );
        })}
      </div>

      {comments.length < total && (
        <Button className="self-start" type="button" variant="outline" size="sm" isLoading={loadingMore} onClick={() => void loadMore()}>
          Afficher les commentaires suivants
        </Button>
      )}
      {error && comments.length > 0 && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      <form onSubmit={submit} className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
        <label htmlFor="incident-comment" className="sr-only">Votre commentaire</label>
        <textarea
          id="incident-comment"
          rows={3}
          maxLength={3000}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Écrire un message..."
          className="w-full resize-y rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          required
        />
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((src, index) => (
              <div key={src} className="relative h-14 w-14 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Pièce jointe ${index + 1}`} className="h-full w-full object-cover" />
                <button type="button" onClick={() => setAttachments((current) => current.filter((_, item) => item !== index))} aria-label="Retirer la pièce jointe" className="absolute right-0 top-0 rounded-bl-md bg-slate-900/80 p-1 text-white"><X className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <input ref={fileInput} type="file" accept="image/*" multiple className="hidden" onChange={(event) => void addFiles(event.target.files)} />
          <Button type="button" variant="outline" size="sm" disabled={attachments.length >= 3 || readingFiles} onClick={() => fileInput.current?.click()}>
            <Paperclip className="h-4 w-4" /> {readingFiles ? "Lecture..." : "Joindre une image"}
          </Button>
          <Button type="submit" size="sm" disabled={!content.trim() || readingFiles} isLoading={sending}>
            <Send className="h-4 w-4" /> Envoyer
          </Button>
        </div>
      </form>
    </section>
  );
}
