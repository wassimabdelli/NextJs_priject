import React from "react";

function inlineContent(text: string, keyPrefix: string): React.ReactNode[] {
  const tokenPattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  const pieces = text.split(tokenPattern);
  return pieces.map((piece, index) => {
    if (piece.startsWith("**") && piece.endsWith("**")) {
      return <strong key={`${keyPrefix}-${index}`}>{piece.slice(2, -2)}</strong>;
    }
    const link = piece.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
    if (link) {
      try {
        const url = new URL(link[2]);
        if (url.protocol === "http:" || url.protocol === "https:") {
          return <a key={`${keyPrefix}-${index}`} href={url.href} target="_blank" rel="noreferrer" className="text-sky-700 underline dark:text-sky-300">{link[1]}</a>;
        }
      } catch {
        return piece;
      }
    }
    return piece;
  });
}

export function AnnouncementContent({ content }: { content: string }) {
  return (
    <div className="space-y-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
      {content.split(/\r?\n/).map((line, index) => {
        const key = `line-${index}`;
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return <div key={key} className="flex gap-2 pl-2"><span aria-hidden="true">•</span><span>{inlineContent(line.slice(2), key)}</span></div>;
        }
        return <p key={key}>{line ? inlineContent(line, key) : "\u00a0"}</p>;
      })}
    </div>
  );
}
