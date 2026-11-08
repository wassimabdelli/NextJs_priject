"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, Send, Sparkles, User, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const QUICK_QUESTIONS = [
  "Quel est l'état du stock et les articles en rupture ?",
  "Bilan des charges, encaissements et dépenses ?",
  "Combien de réclamations sont ouvertes par priorité ?",
  "Fais-moi un résumé global des chiffres du syndic.",
];

const INITIAL_WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Bonjour ! Je suis votre assistant Data SyndicPro. Posez-moi une question sur vos **charges**, **dépenses**, **stocks** ou **réclamations** en temps réel.",
};

export function DataChatbot() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    INITIAL_WELCOME_MESSAGE,
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const sendMessage = async (questionText?: string) => {
    const trimmed = (questionText ?? input).trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    if (!questionText) setInput("");
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: nextMessages.slice(-6).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Impossible d'obtenir une réponse de l'assistant.");
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.reply || "Aucune réponse générée.",
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erreur de communication avec le chatbot IA."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage();
  };

  const resetChat = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "Conversation réinitialisée. Posez-moi une question sur les données actuelles du syndic (stock, charges, dépenses, réclamations).",
      },
    ]);
    setError(null);
  };

  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm dark:border-slate-800">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 bg-gradient-to-r from-blue-600/10 via-indigo-500/10 to-transparent px-4 py-3.5 dark:border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-500/25">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Assistant IA — Chatbot Data Syndic
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300">
                <Sparkles className="h-3 w-3" />
                Temps réel
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Interrogez vos données chiffrées (charges, dépenses, stock, réclamations)
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={resetChat}
          title="Réinitialiser la discussion"
          className="text-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <CardContent className="space-y-3 p-4">
        {/* Suggestions rapides */}
        <div className="flex flex-wrap gap-1.5">
          {QUICK_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              disabled={loading}
              onClick={() => void sendMessage(q)}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-700 transition-colors hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:border-sky-600 dark:hover:bg-sky-950/40"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Zone des messages */}
        <div
          ref={scrollContainerRef}
          className="max-h-80 min-h-[200px] space-y-3 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800/80 dark:bg-slate-900/40"
        >
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                className={`flex items-start gap-2.5 ${
                  isUser ? "flex-row-reverse" : "flex-row"
                }`}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs ${
                    isUser
                      ? "bg-sky-600 text-white"
                      : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-sky-400"
                  }`}
                >
                  {isUser ? (
                    <User className="h-3.5 w-3.5" />
                  ) : (
                    <Bot className="h-3.5 w-3.5" />
                  )}
                </div>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed sm:text-sm ${
                    isUser
                      ? "bg-sky-600 text-white"
                      : "border border-slate-200 bg-white text-slate-800 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-800">
                <Bot className="h-3.5 w-3.5 animate-pulse text-sky-500" />
              </div>
              <span className="animate-pulse font-medium">
                Analyse des données MongoDB et génération de la réponse…
              </span>
            </div>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
          >
            {error}
          </p>
        )}

        {/* Formulaire d'envoi */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Posez une question (ex: Quels articles sont en rupture de stock ?)"
            disabled={loading}
            className="min-h-[42px] flex-1 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim() || loading}
            isLoading={loading}
            className="min-h-[42px] gap-1.5 px-4"
          >
            <Send className="h-4 w-4" />
            <span>Envoyer</span>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
