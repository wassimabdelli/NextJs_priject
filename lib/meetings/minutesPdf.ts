import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Meeting } from "@/models/Meeting";
import { Resolution } from "@/models/Resolution";
import { Residence } from "@/models/Residence";

/**
 * Helvetica (WinAnsi) ne supporte pas certains glyphes Unicode (• → …).
 * On normalise le texte avant dessin.
 */
function pdfSafe(text: string): string {
  return String(text ?? "")
    .normalize("NFC")
    .replace(/[•●]/g, "-")
    .replace(/[→⇒➔]/g, "->")
    .replace(/[—–]/g, "-")
    .replace(/[‘’‛‹›]/g, "'")
    .replace(/[“”„«»]/g, '"')
    .replace(/[…]/g, "...")
    .replace(/[·]/g, " · ")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Génère un PV d'AG PDF (pdf-lib) avec quorum, résolutions et signature.
 */
export async function buildMinutesPdf(meetingId: string): Promise<Uint8Array> {
  const meeting = await Meeting.findById(meetingId);
  if (!meeting) throw new Error("Assemblée introuvable");

  const residence = await Residence.findById(meeting.residence).lean();
  const resolutions = await Resolution.find({ meeting: meeting._id });
  const quorum = await meeting.getQuorumStats();

  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595.28, 841.89]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = 800;
  const left = 50;
  const bottom = 60;

  const ensureSpace = (needed: number) => {
    if (y - needed < bottom) {
      page = pdf.addPage([595.28, 841.89]);
      y = 800;
    }
  };

  const draw = (text: string, opts?: { bold?: boolean; size?: number }) => {
    const size = opts?.size ?? 11;
    const f = opts?.bold ? bold : font;
    const safe = pdfSafe(text).slice(0, 95);
    ensureSpace(size + 8);
    page.drawText(safe.length > 0 ? safe : " ", {
      x: left,
      y,
      size,
      font: f,
      color: rgb(0.1, 0.1, 0.15),
    });
    y -= size + 6;
  };

  draw("PROCES-VERBAL D'ASSEMBLEE GENERALE", { bold: true, size: 16 });
  y -= 4;
  draw(`Residence : ${residence?.name ?? "-"} (${residence?.city ?? ""})`);
  draw(`Titre : ${meeting.title}`, { bold: true });
  draw(
    `Date : ${new Date(meeting.date).toLocaleString("fr-FR")} | Lieu : ${meeting.location || "-"}`
  );
  draw(
    `Quorum : ${quorum.percentage} % (requis ${quorum.requiredPercentage} %) - ${
      quorum.reached ? "ATTEINT" : "NON ATTEINT"
    } [${quorum.source}]`,
    { bold: true }
  );
  y -= 8;

  draw("Ordre du jour", { bold: true, size: 13 });
  const agendaLines =
    meeting.agendaItems?.length > 0
      ? meeting.agendaItems
      : (meeting.agenda || "").split("\n").filter(Boolean);
  for (const line of agendaLines.slice(0, 24)) {
    draw(line, { size: 10 });
  }

  y -= 10;
  draw("Resolutions et votes", { bold: true, size: 13 });
  for (const res of resolutions) {
    const tally = await res.countVotes();
    const adopted = await res.isAdopted();
    draw(`- ${res.title}`, { bold: true, size: 11 });
    draw(
      `  Pour ${tally.FOR} / Contre ${tally.AGAINST} / Abst. ${tally.ABSTAIN} -> ${
        adopted ? "ADOPTEE" : "REJETEE"
      }`,
      { size: 10 }
    );
  }

  if (meeting.aiMinutesDraft) {
    y -= 10;
    draw("Compte rendu IA (a partir de la transcription)", { bold: true, size: 13 });
    const draftLines = meeting.aiMinutesDraft.split(/\n+/).filter(Boolean);
    for (const line of draftLines.slice(0, 40)) {
      draw(line, { size: 9 });
    }
  }

  if (meeting.meetUrl) {
    y -= 6;
    draw(`Lien visio : ${meeting.meetUrl}`, { size: 9 });
  }

  y -= 20;
  ensureSpace(50);
  draw("Signature du syndic / president de seance", { bold: true });
  if (meeting.minutesSignedAt) {
    draw(
      `Signe electroniquement le ${new Date(meeting.minutesSignedAt).toLocaleString("fr-FR")}`
    );
  } else {
    draw("En attente de signature");
  }
  page.drawLine({
    start: { x: left, y: y - 10 },
    end: { x: left + 200, y: y - 10 },
    thickness: 1,
    color: rgb(0.4, 0.4, 0.45),
  });

  return pdf.save();
}
