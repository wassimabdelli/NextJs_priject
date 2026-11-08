import mongoose from "mongoose";
import type { NextRequest } from "next/server";
import { HttpError, isValidObjectId, json, parseBody } from "@/lib/api";
import { withAuth, type AuthUser, getSyndicResidenceIds } from "@/lib/auth-guard";
import { recordIncidentHistory } from "@/lib/incidents/recordHistory";
import { Incident } from "@/models/Incident";
import { Role } from "@/types/enums";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };
const reviewSchema = z.object({
  targetIncidentId: z.string().regex(/^[a-f\d]{24}$/i),
  action: z.enum(["LINK", "DISMISS"]),
});

export const POST = withAuth(async (req: NextRequest, user: AuthUser, context?: RouteContext) => {
  if (user.role !== Role.ADMIN && user.role !== Role.SYNDIC) throw new HttpError(403, "Seuls ADMIN et SYNDIC peuvent traiter les doublons potentiels");
  const { id = "" } = await (context?.params ?? Promise.resolve({ id: "" }));
  if (!isValidObjectId(id)) throw new HttpError(400, "Identifiant invalide");
  const input = await parseBody(req, reviewSchema);
  if (id === input.targetIncidentId) throw new HttpError(400, "Un incident ne peut pas être lié à lui-même");

  const [source, target] = await Promise.all([
    Incident.findById(id).select("residence title relatedIncidents dismissedDuplicates").lean(),
    Incident.findById(input.targetIncidentId).select("residence title relatedIncidents dismissedDuplicates").lean(),
  ]);
  if (!source || !target || String(source.residence) !== String(target.residence)) {
    throw new HttpError(404, "Incident introuvable");
  }
  const residenceIds = user.role === Role.ADMIN ? null : await getSyndicResidenceIds(user.id);
  if (user.role === Role.SYNDIC && !residenceIds?.includes(String(source.residence))) {
    throw new HttpError(404, "Incident introuvable");
  }

  const sourceId = new mongoose.Types.ObjectId(id);
  const targetId = new mongoose.Types.ObjectId(input.targetIncidentId);
  if (input.action === "LINK") {
    await Incident.bulkWrite([
      { updateOne: { filter: { _id: sourceId }, update: { $addToSet: { relatedIncidents: targetId }, $pull: { dismissedDuplicates: targetId } } } },
      { updateOne: { filter: { _id: targetId }, update: { $addToSet: { relatedIncidents: sourceId }, $pull: { dismissedDuplicates: sourceId } } } },
    ]);
    await recordIncidentHistory({
      incidentId: sourceId,
      actorId: user.id,
      action: "UPDATED",
      description: `Incident lié à ${target.title.slice(0, 180)} après vérification humaine.`,
    });
    await recordIncidentHistory({
      incidentId: targetId,
      actorId: user.id,
      action: "UPDATED",
      description: `Incident lié à ${source.title.slice(0, 180)} après vérification humaine.`,
    });
    return json({ success: true, action: input.action, relatedIncidentId: input.targetIncidentId });
  }

  await Incident.updateOne(
    { _id: sourceId },
    { $addToSet: { dismissedDuplicates: targetId } }
  );
  await recordIncidentHistory({
    incidentId: sourceId,
    actorId: user.id,
    action: "UPDATED",
    description: `Correspondance potentielle avec ${target.title.slice(0, 180)} écartée après vérification humaine.`,
  });
  return json({ success: true, action: input.action, dismissedIncidentId: input.targetIncidentId });
});
