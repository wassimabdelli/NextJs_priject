"use client";

import { useState } from "react";
import { MessageCircle, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AIChatMessage } from "./AIChatMessage";
import { AIError } from "./AIError";
import { AILoading } from "./AILoading";

type Message = { role: "user" | "assistant"; content: string };

export function AIChatWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [conversationId, setConversationId] = useState<string>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = message.trim();
    if (!text || loading) return;
    setMessage("");
    setError("");
    setMessages((current) => [...current, { role: "user", content: text }]);
    setLoading(true);
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, ...(conversationId ? { conversationId } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Assistant IA indisponible.");
      setConversationId(data.conversationId);
      setMessages((current) => [...current, { role: "assistant", content: data.answer }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible d’obtenir une réponse.");
    } finally { setLoading(false); }
  };

  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label="Ouvrir l’assistant IA" className="fixed bottom-20 right-4 z-40 flex h-12 items-center gap-2 rounded-full bg-sky-600 px-4 text-sm font-semibold text-white shadow-lg hover:bg-sky-700 md:bottom-6">
      <Sparkles className="h-4 w-4" /><span className="hidden sm:inline">Assistant IA</span><MessageCircle className="h-4 w-4 sm:hidden" />
    </button>
    {open && <div className="fixed inset-0 z-50 flex items-end justify-end bg-slate-950/30 p-0 sm:p-4 sm:items-end" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="ai-chat-title" className="flex h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:h-[min(680px,85vh)] sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800">
          <div><h2 id="ai-chat-title" className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><Sparkles className="h-4 w-4 text-sky-600" />Assistant SyndicPro</h2><p className="mt-1 text-xs text-slate-500">Réponses fondées sur les informations autorisées à votre compte.</p></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Fermer l’assistant" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {!messages.length && <p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-900 dark:bg-sky-950/30 dark:text-sky-200">Vous pouvez demander de l’aide sur les réclamations et annonces visibles pour votre rôle. Les réponses IA peuvent être inexactes.</p>}
          {messages.map((item, index) => <AIChatMessage key={`${index}-${item.role}`} {...item} />)}
          {loading && <AILoading label="L’assistant rédige une réponse…" />}
          {error && <AIError message={error} />}
        </div>
        <form onSubmit={send} className="flex gap-2 border-t border-slate-100 p-3 dark:border-slate-800">
          <label className="sr-only" htmlFor="ai-chat-message">Votre question</label>
          <textarea id="ai-chat-message" rows={2} maxLength={1200} required value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Comment puis-je vous aider ?" className="min-h-11 flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          <Button type="submit" aria-label="Envoyer" disabled={loading || !message.trim()}><Send className="h-4 w-4" /></Button>
        </form>
      </section>
    </div>}
  </>;
}
