import { NextRequest } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  withAuth,
  getResidentApartmentIds,
  getSyndicResidenceIds,
  type AuthUser,
} from "@/lib/auth-guard";
import { HttpError, isValidObjectId } from "@/lib/api";
import { Role } from "@/types/enums";
import { Payment } from "@/models/Payment";

const CURRENCY = "€";

// Traduction française des modes de paiement
const METHOD_LABELS: Record<string, string> = {
  CASH: "Espèces",
  BANK_TRANSFER: "Virement",
  CHEQUE: "Chèque",
  CHECK: "Chèque",
  CARD: "Carte",
};

// Formatage manuel d'un montant sans espace insécable (compatible WinAnsi / pdf-lib)
function formatAmount(value: unknown): string {
  const num = Number(value) || 0;
  return `${num.toFixed(2).replace(".", ",")} ${CURRENCY}`;
}

// Formatage d'une date au format JJ/MM/AAAA
function formatDateFR(dateValue: unknown): string {
  if (!dateValue) return "—";
  const d = new Date(dateValue as string | number | Date);
  if (isNaN(d.getTime())) return "-";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export const GET = withAuth(
  async (
    _req: NextRequest,
    user: AuthUser,
    context?: { params?: Promise<{ id: string }> }
  ) => {
    const resolvedParams = context?.params ? await context.params : undefined;
    const id = resolvedParams?.id;

    if (!isValidObjectId(id)) {
      throw new HttpError(400, "Identifiant de paiement invalide");
    }

    // Chargement du paiement avec les relations nécessaires au reçu
    const payment = (await Payment.findById(id)
      .populate({
        path: "charge",
        select: "period amount paidAmount apartment",
        populate: {
          path: "apartment",
          select: "number floor residence",
          populate: {
            path: "residence",
            select: "name address city",
          },
        },
      })
      .populate({
        path: "receivedBy",
        select: "name",
      })
      .lean()) as any;

    if (!payment) {
      throw new HttpError(404, "Reçu introuvable");
    }

    const charge = payment.charge;
    const apartment = charge?.apartment;
    const residence = apartment?.residence;

    // Contrôle strict du périmètre selon le rôle (renvoie 404 en cas de refus)
    if (user.role === Role.SYNDIC) {
      const syndicResidenceIds = await getSyndicResidenceIds(user.id);
      const resId = residence?._id ? String(residence._id) : String(apartment?.residence || "");
      if (!resId || !syndicResidenceIds.includes(resId)) {
        throw new HttpError(404, "Reçu introuvable");
      }
    } else if (user.role === Role.RESIDENT) {
      const residentApartmentIds = await getResidentApartmentIds(user.id);
      const aptId = apartment?._id ? String(apartment._id) : String(charge?.apartment || "");
      if (!aptId || !residentApartmentIds.includes(aptId)) {
        throw new HttpError(404, "Reçu introuvable");
      }
    }

    // Extraction des données pour le document PDF
    const receiptNumber = String(payment.receiptNumber || payment._id);
    const paymentDateStr = formatDateFR(payment.paymentDate);
    const residenceName = String(residence?.name || "Copropriété");
    const residenceAddress = [residence?.address, residence?.city]
      .filter(Boolean)
      .join(", ");
    const apartmentLabel =
      apartment?.number !== undefined
        ? `Lot ${apartment.number}${
            apartment.floor !== undefined && apartment.floor !== null
              ? ` (Étage ${apartment.floor})`
              : ""
          }`
        : "-";
    const periodLabel = String(charge?.period || "-");
    const methodLabel = METHOD_LABELS[String(payment.method)] || String(payment.method || "-");
    const paidThisTime = formatAmount(payment.amount);
    const remainingAmount = Math.max(
      0,
      (Number(charge?.amount) || 0) - (Number(charge?.paidAmount) || 0)
    );
    const remainingLabel = formatAmount(remainingAmount);
    const receiverName = String(payment.receivedBy?.name || "Syndic");

    // Génération du PDF au format A5 (419.5 x 595 pt)
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([419.5, 595]);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const { width, height } = page.getSize();
    const margin = 36;
    let y = height - 48;

    // En-tête : Titre et numéro de reçu
    page.drawText("REÇU DE PAIEMENT", {
      x: margin,
      y,
      size: 18,
      font: fontBold,
      color: rgb(0.05, 0.25, 0.45),
    });

    y -= 20;
    page.drawText(`N° de reçu : ${receiptNumber}`, {
      x: margin,
      y,
      size: 10,
      font: fontBold,
      color: rgb(0.3, 0.35, 0.4),
    });

    page.drawText(`Date : ${paymentDateStr}`, {
      x: width - margin - 110,
      y,
      size: 10,
      font: fontRegular,
      color: rgb(0.3, 0.35, 0.4),
    });

    y -= 16;
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 1,
      color: rgb(0.85, 0.88, 0.92),
    });

    // Bloc Résidence & Lot
    y -= 26;
    page.drawText("Copropriété / Résidence", {
      x: margin,
      y,
      size: 9,
      font: fontBold,
      color: rgb(0.45, 0.5, 0.55),
    });

    y -= 15;
    page.drawText(residenceName, {
      x: margin,
      y,
      size: 12,
      font: fontBold,
      color: rgb(0.1, 0.12, 0.15),
    });

    if (residenceAddress) {
      y -= 14;
      page.drawText(residenceAddress, {
        x: margin,
        y,
        size: 10,
        font: fontRegular,
        color: rgb(0.3, 0.35, 0.4),
      });
    }

    y -= 24;
    page.drawText(`Appartement : ${apartmentLabel}`, {
      x: margin,
      y,
      size: 11,
      font: fontBold,
      color: rgb(0.15, 0.18, 0.22),
    });

    // Tableau récapitulatif du règlement
    y -= 24;
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 0.75,
      color: rgb(0.85, 0.88, 0.92),
    });

    const drawRow = (label: string, value: string, boldValue = false) => {
      y -= 24;
      page.drawText(label, {
        x: margin,
        y,
        size: 10,
        font: fontRegular,
        color: rgb(0.3, 0.35, 0.4),
      });
      page.drawText(value, {
        x: width - margin - 140,
        y,
        size: 11,
        font: boldValue ? fontBold : fontRegular,
        color: rgb(0.1, 0.12, 0.15),
      });
    };

    drawRow("Période de la charge :", periodLabel);
    drawRow("Montant réglé :", paidThisTime, true);
    drawRow("Mode de paiement :", methodLabel);
    drawRow("Reste à payer sur la charge :", remainingLabel);

    y -= 16;
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 0.75,
      color: rgb(0.85, 0.88, 0.92),
    });

    // Mention d'encaissement
    y -= 32;
    page.drawText(`Encaissé par : ${receiverName}`, {
      x: margin,
      y,
      size: 10,
      font: fontBold,
      color: rgb(0.2, 0.25, 0.3),
    });

    // Pied de page
    page.drawLine({
      start: { x: margin, y: 48 },
      end: { x: width - margin, y: 48 },
      thickness: 0.5,
      color: rgb(0.85, 0.88, 0.92),
    });

    page.drawText("Document généré par SyndicPro", {
      x: margin,
      y: 32,
      size: 9,
      font: fontRegular,
      color: rgb(0.5, 0.55, 0.6),
    });

    const pdfBytes = await pdfDoc.save();

    return new Response(new Uint8Array(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="recu-${receiptNumber}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  },
  {
    roles: [Role.ADMIN, Role.SYNDIC, Role.RESIDENT],
  }
);
