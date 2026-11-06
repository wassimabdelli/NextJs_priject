import type { NextRequest } from "next/server";
import { z } from "zod";
import { HttpError, json, parseBody } from "@/lib/api";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { User } from "@/models/User";
import { Apartment } from "@/models/Apartment";
import { Resident } from "@/models/Resident";
import { Residence } from "@/models/Residence";
import { Incident } from "@/models/Incident";
import { Role } from "@/types/enums";
import { hashPassword, verifyPassword } from "@/lib/password";

const profileUpdateSchema = z.object({
  name: z.string().min(2, "Le nom doit comporter au moins 2 caractères").max(80).optional(),
  phone: z.string().max(30).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, "Le mot de passe doit comporter au moins 6 caractères").optional(),
});

/**
 * GET /api/profile
 * Récupère le profil complet de l'utilisateur avec ses résidences, appartements et coordonnées du syndic.
 */
export const GET = withAuth(async (_req: NextRequest, authUser: AuthUser) => {
  const user = await User.findById(authUser.id, "name email phone role isActive createdAt updatedAt").lean();
  if (!user) {
    throw new HttpError(404, "Utilisateur introuvable");
  }

  const result: any = {
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      role: user.role,
      createdAt: user.createdAt,
    },
    residences: [],
    apartments: [],
    details: {},
  };

  if (user.role === Role.OWNER || user.role === Role.TENANT) {
    // 1. Récupère les lots dont l'utilisateur est propriétaire direct
    const ownedApts = await Apartment.find({ owner: user._id })
      .populate({
        path: "residence",
        select: "name address city totalApartments syndic",
        populate: { path: "syndic", select: "name email phone" },
      })
      .lean();

    // 2. Récupère les rattachements de résident occupant (locataire ou occupant enregistré)
    const residentEntries = await Resident.find({ user: user._id, isActive: true })
      .populate({
        path: "apartment",
        populate: {
          path: "residence",
          select: "name address city totalApartments syndic",
          populate: { path: "syndic", select: "name email phone" },
        },
      })
      .lean();

    const seenAptIds = new Set<string>();
    const allLots: any[] = [];

    for (const apt of ownedApts as any[]) {
      const idStr = apt._id.toString();
      seenAptIds.add(idStr);
      allLots.push({
        id: idStr,
        number: apt.number,
        floor: apt.floor,
        surface: apt.surface,
        shares: apt.shares,
        relationship: "Propriétaire",
        residence: apt.residence,
      });
    }

    for (const resEntry of residentEntries as any[]) {
      const apt = resEntry.apartment;
      if (!apt) continue;
      const idStr = apt._id?.toString();
      if (idStr && !seenAptIds.has(idStr)) {
        seenAptIds.add(idStr);
        allLots.push({
          id: idStr,
          number: apt.number,
          floor: apt.floor,
          surface: apt.surface,
          shares: apt.shares,
          relationship: resEntry.type === "TENANT" ? "Locataire occupant" : "Copropriétaire occupant",
          moveInDate: resEntry.moveInDate,
          residence: apt.residence,
        });
      }
    }

    result.apartments = allLots;

    // Regroupement par résidence unique
    const resMap = new Map<string, any>();
    for (const lot of allLots) {
      const res = lot.residence;
      if (!res) continue;
      const resId = res._id?.toString() || res.id;
      if (!resMap.has(resId)) {
        resMap.set(resId, {
          id: resId,
          name: res.name,
          address: res.address,
          city: res.city,
          totalApartments: res.totalApartments,
          syndic: res.syndic
            ? {
                name: res.syndic.name,
                email: res.syndic.email,
                phone: res.syndic.phone || "Non renseigné",
              }
            : null,
          lots: [],
        });
      }
      resMap.get(resId).lots.push({
        id: lot.id,
        number: lot.number,
        floor: lot.floor,
        surface: lot.surface,
        shares: lot.shares,
        relationship: lot.relationship,
      });
    }

    result.residences = Array.from(resMap.values());
  } else if (user.role === Role.SYNDIC) {
    // Le syndic gère plusieurs résidences
    const managedResidences = await Residence.find({ syndic: user._id })
      .select("name address city totalApartments")
      .lean();

    result.residences = managedResidences.map((r: any) => ({
      id: r._id.toString(),
      name: r.name,
      address: r.address,
      city: r.city,
      totalApartments: r.totalApartments,
    }));
  } else if (user.role === Role.ADMIN) {
    const totalRes = await Residence.countDocuments();
    const totalApts = await Apartment.countDocuments();
    result.details = {
      totalResidences: totalRes,
      totalApartments: totalApts,
      scope: "Accès superviseur global sur l'ensemble des résidences",
    };
  } else if (user.role === Role.TECHNICIAN) {
    const assignedIncidents = await Incident.countDocuments({
      assignedTo: user._id,
      status: { $in: ["REPORTED", "IN_PROGRESS"] },
    });
    result.details = {
      activeInterventions: assignedIncidents,
      roleDescription: "Technicien d'intervention et de maintenance sur site",
    };
  }

  return json({ data: result });
});

/**
 * PATCH /api/profile
 * Met à jour le nom, téléphone ou mot de passe de l'utilisateur connecté.
 */
export const PATCH = withAuth(async (req: NextRequest, authUser: AuthUser) => {
  const body = await parseBody(req, profileUpdateSchema);

  const user = await User.findById(authUser.id).select("+passwordHash");
  if (!user) {
    throw new HttpError(404, "Utilisateur introuvable");
  }

  if (body.name !== undefined) {
    user.name = body.name.trim();
  }

  if (body.phone !== undefined) {
    user.phone = body.phone.trim();
  }

  if (body.newPassword) {
    if (!body.currentPassword) {
      throw new HttpError(400, "Le mot de passe actuel est requis pour le modifier");
    }
    const isValid = await verifyPassword(body.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new HttpError(400, "Le mot de passe actuel est incorrect");
    }
    user.passwordHash = await hashPassword(body.newPassword);
  }

  await user.save();

  return json({
    success: true,
    data: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      role: user.role,
    },
  });
});

