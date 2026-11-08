import type { NextRequest } from "next/server";
import { HttpError, isValidObjectId, json } from "@/lib/api";
import { withAuth, getSyndicResidenceIds, type AuthUser } from "@/lib/auth-guard";
import { JoinRequest, JoinRequestStatus } from "@/models/JoinRequest";
import { Apartment } from "@/models/Apartment";
import { Resident } from "@/models/Resident";
import { User } from "@/models/User";
import { Role, ResidentType } from "@/types/enums";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

/**
 * PATCH /api/join-requests/[id]/approve
 * Approuve une demande de rattachement :
 * - Associe ou crée l'appartement
 * - Crée la fiche Resident liée
 * - Met à jour le propriétaire de l'appartement si OWNER
 * - Passe la demande en APPROVED
 * Rôles autorisés : ADMIN, SYNDIC
 */
export const PATCH = withAuth(
  async (req: NextRequest, user: AuthUser, context?: unknown) => {
    const rawParams = await Promise.resolve((context as RouteParams)?.params);
    const id = rawParams?.id;
    if (!isValidObjectId(id)) {
      throw new HttpError(400, "Identifiant de demande invalide");
    }

    const request = await JoinRequest.findById(id);
    if (!request) {
      throw new HttpError(404, "Demande introuvable");
    }

    if (request.status !== JoinRequestStatus.PENDING) {
      throw new HttpError(400, "Cette demande a déjà été traitée");
    }

    if (user.role === Role.SYNDIC) {
      const syndicResidences = await getSyndicResidenceIds(user.id);
      if (!syndicResidences.includes(request.residence.toString())) {
        throw new HttpError(403, "Vous n'administrez pas la résidence concernée");
      }
    }

    // Recherche de l'appartement dans la résidence
    const aptNumberRegex = new RegExp(`^${request.apartmentNumber.trim()}$`, "i");
    let apartment = await Apartment.findOne({
      residence: request.residence,
      number: { $regex: aptNumberRegex },
    });

    if (!apartment) {
      // Création automatique de l'appartement s'il n'existe pas encore
      apartment = await Apartment.create({
        residence: request.residence,
        number: request.apartmentNumber.trim().toUpperCase(),
        floor: 1,
        surface: 80,
        shares: 100,
        isOccupied: true,
        owner: request.residentType === ResidentType.OWNER ? request.user : undefined,
      });
    } else {
      // Si c'est un propriétaire, on associe l'appartement à l'utilisateur
      apartment.isOccupied = true;
      if (request.residentType === ResidentType.OWNER) {
        apartment.owner = request.user;
      }
      await apartment.save();
    }

    // Récupération des informations de l'utilisateur demandeur
    const applicant = await User.findById(request.user).lean();
    if (!applicant) {
      throw new HttpError(404, "Utilisateur demandeur introuvable");
    }

    // Création ou activation de la fiche Resident
    let resident = await Resident.findOne({
      apartment: apartment._id,
      user: request.user,
    });

    if (!resident) {
      resident = await Resident.create({
        apartment: apartment._id,
        user: request.user,
        fullName: applicant.name || "Résident",
        email: applicant.email,
        phone: applicant.phone,
        type: request.residentType,
        moveInDate: new Date(),
        isActive: true,
      });
    } else {
      resident.isActive = true;
      resident.type = request.residentType;
      await resident.save();
    }

    // Aligne le rôle Auth.js sur le type demandé (sinon le JWT reste incohérent).
    const targetRole =
      request.residentType === ResidentType.TENANT ? Role.TENANT : Role.OWNER;
    if (
      applicant.role === Role.OWNER ||
      applicant.role === Role.TENANT ||
      !applicant.role
    ) {
      await User.findByIdAndUpdate(request.user, { role: targetRole });
    }

    // Finalisation de la demande
    request.status = JoinRequestStatus.APPROVED;
    request.residentId = resident._id;
    request.reviewedBy = user.id as any;
    request.reviewedAt = new Date();
    await request.save();

    const populated = await JoinRequest.findById(request._id)
      .populate("residence", "name address city")
      .populate("user", "name email phone")
      .populate("reviewedBy", "name email")
      .lean();

    return json(populated, 200);
  },
  { roles: [Role.ADMIN, Role.SYNDIC] }
);

