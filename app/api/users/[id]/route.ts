import type { NextRequest } from "next/server";
import { HttpError, isValidObjectId, json, parseBody } from "@/lib/api";
import { User } from "@/models/User";
import { userUpdateSchema } from "@/lib/validations/user";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { Role } from "@/types/enums";
import { Residence } from "@/models/Residence";
import { getSyndicResidenceIds } from "@/lib/auth-guard";
import mongoose from "mongoose";
import { Apartment } from "@/models/Apartment";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/users/[id]
 * Réservé aux rôles ADMIN et SYNDIC.
 * Règles métier de sécurité :
 * 1. Un ADMIN ne peut pas se retirer son propre rôle ADMIN ni se désactiver lui-même.
 * 2. Seul un ADMIN peut modifier un utilisateur ADMIN/SYNDIC ou attribuer un rôle ADMIN/SYNDIC.
 */
export const PATCH = withAuth(
  async (req: NextRequest, currentUser: AuthUser, context?: unknown) => {
    const { id } = await (context as RouteParams).params;
    if (!isValidObjectId(id)) {
      throw new HttpError(400, "Identifiant utilisateur invalide");
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      throw new HttpError(404, "Utilisateur introuvable");
    }

    const data = await parseBody(req, userUpdateSchema);

    // 1. Protection auto-admin : interdiction de s'auto-dégrader ou s'auto-désactiver
    if (currentUser.id === targetUser._id.toString()) {
      if (data.role && data.role !== Role.ADMIN) {
        throw new HttpError(400, "Vous ne pouvez pas retirer votre propre rôle administrateur");
      }
      if (data.isActive === false) {
        throw new HttpError(400, "Vous ne pouvez pas désactiver votre propre compte");
      }
    }

    // 2. Seul un ADMIN peut promouvoir ou modifier un ADMIN ou SYNDIC
    if (currentUser.role !== Role.ADMIN) {
      if (targetUser.role === Role.ADMIN || targetUser.role === Role.SYNDIC) {
        throw new HttpError(403, "Seul un administrateur peut modifier un compte ADMIN ou SYNDIC");
      }
      if (data.role === Role.ADMIN || data.role === Role.SYNDIC) {
        throw new HttpError(403, "Seul un administrateur peut attribuer le rôle ADMIN ou SYNDIC");
      }
    }

    if (data.residence) {
      if ((data.role ?? targetUser.role) !== Role.RESIDENT) {
        throw new HttpError(400, "Seuls les comptes résident peuvent être rattachés à une résidence");
      }
      if (!(await Residence.exists({ _id: data.residence }))) {
        throw new HttpError(404, "Résidence introuvable");
      }
      if (currentUser.role === Role.SYNDIC) {
        const managedResidences = await getSyndicResidenceIds(currentUser.id);
        if (!managedResidences.includes(data.residence)) {
          throw new HttpError(403, "Vous n'administrez pas cette résidence");
        }
      }
      const currentApartment = await Apartment.findOne({ residentUser: targetUser._id })
        .select("residence")
        .lean();
      if (currentApartment && String(currentApartment.residence) !== data.residence) {
        throw new HttpError(
          409,
          "Retirez d'abord ce résident de son lot avant de changer de résidence"
        );
      }
    }

    if (data.role !== undefined && data.role !== Role.RESIDENT) {
      const assignedApartment = await Apartment.exists({ residentUser: targetUser._id });
      if (assignedApartment) {
        throw new HttpError(
          409,
          "Retirez d'abord ce résident de son lot avant de changer son rôle"
        );
      }
    }
    if (data.residence === null && await Apartment.exists({ residentUser: targetUser._id })) {
      throw new HttpError(
        409,
        "Retirez d'abord ce résident de son lot avant de le détacher de la résidence"
      );
    }

    if (data.name !== undefined) targetUser.name = data.name;
    if (data.email !== undefined) targetUser.email = data.email.toLowerCase().trim();
    if (data.phone !== undefined) targetUser.phone = data.phone;
    if (data.role !== undefined) targetUser.role = data.role;
    if (data.isActive !== undefined) targetUser.isActive = data.isActive;
    if (data.role !== undefined && data.role !== Role.RESIDENT) {
      targetUser.residence = undefined;
    } else if (data.residence) {
      targetUser.residence = new mongoose.Types.ObjectId(data.residence);
    } else if (data.residence === null) {
      targetUser.residence = undefined;
    }

    await targetUser.save();

    return json({
      _id: targetUser._id.toString(),
      name: targetUser.name,
      email: targetUser.email,
      phone: targetUser.phone,
      role: targetUser.role,
      isActive: targetUser.isActive,
      residence: targetUser.residence,
      updatedAt: targetUser.updatedAt,
    });
  },
  { roles: [Role.ADMIN, Role.SYNDIC] }
);

/**
 * GET /api/users/[id]
 */
export const GET = withAuth(
  async (_req: NextRequest, _currentUser: AuthUser, context?: unknown) => {
    const { id } = await (context as RouteParams).params;
    if (!isValidObjectId(id)) {
      throw new HttpError(400, "Identifiant utilisateur invalide");
    }

    const user = await User.findById(id)
      .select("-passwordHash")
      .populate("residence", "name")
      .lean();
    if (!user) {
      throw new HttpError(404, "Utilisateur introuvable");
    }

    return json(user);
  },
  { roles: [Role.ADMIN, Role.SYNDIC] }
);

/**
 * DELETE /api/users/[id]
 * Seul un ADMIN peut supprimer un utilisateur.
 * Impossible de supprimer son propre compte administrateur.
 */
export const DELETE = withAuth(
  async (_req: NextRequest, currentUser: AuthUser, context?: unknown) => {
    const { id } = await (context as RouteParams).params;
    if (!isValidObjectId(id)) {
      throw new HttpError(400, "Identifiant utilisateur invalide");
    }

    if (currentUser.id === id) {
      throw new HttpError(400, "Vous ne pouvez pas supprimer votre propre compte");
    }

    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) {
      throw new HttpError(404, "Utilisateur introuvable");
    }

    return json({ success: true, message: "Utilisateur supprimé avec succès" });
  },
  { roles: [Role.ADMIN] }
);
