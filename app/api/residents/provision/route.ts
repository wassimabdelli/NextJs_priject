import type { NextRequest } from "next/server";
import { HttpError, json, parseBody } from "@/lib/api";
import { withAuth, getSyndicResidenceIds, type AuthUser } from "@/lib/auth-guard";
import { hashPassword } from "@/lib/password";
import { residentProvisionSchema } from "@/lib/validations/resident-provision";
import { Apartment } from "@/models/Apartment";
import { Resident } from "@/models/Resident";
import { User } from "@/models/User";
import { Role, ResidentType } from "@/types/enums";

/**
 * POST /api/residents/provision
 * Le syndic/admin ajoute directement une personne à un lot
 * (crée le compte si besoin, fiche Resident, propriétaire du lot si OWNER).
 */
export const POST = withAuth(
  async (req: NextRequest, user: AuthUser) => {
    const body = await parseBody(req, residentProvisionSchema);

    const apartment = await Apartment.findById(body.apartment).lean();
    if (!apartment) {
      throw new HttpError(404, "Appartement introuvable");
    }

    if (user.role === Role.SYNDIC) {
      const managed = await getSyndicResidenceIds(user.id);
      if (!managed.includes(String(apartment.residence))) {
        throw new HttpError(403, "Vous n'administrez pas la résidence de ce lot");
      }
    }

    const email = body.email.trim().toLowerCase();
    let account = await User.findOne({ email });
    let createdAccount = false;

    const targetRole =
      body.type === ResidentType.TENANT ? Role.TENANT : Role.OWNER;

    if (!account) {
      if (!body.password) {
        throw new HttpError(
          400,
          "Mot de passe requis pour créer le compte de cet utilisateur"
        );
      }
      account = await User.create({
        name: body.fullName.trim(),
        email,
        phone: body.phone,
        passwordHash: await hashPassword(body.password),
        role: targetRole,
        isActive: true,
      });
      createdAccount = true;
    } else {
      // Ne pas écraser ADMIN/SYNDIC/TECHNICIAN existants.
      if (account.role === Role.OWNER || account.role === Role.TENANT) {
        account.role = targetRole;
        if (body.phone && !account.phone) account.phone = body.phone;
        if (body.fullName.trim()) account.name = body.fullName.trim();
        await account.save();
      }
    }

    let resident = await Resident.findOne({
      apartment: apartment._id,
      user: account._id,
    });

    if (!resident) {
      resident = await Resident.create({
        apartment: apartment._id,
        user: account._id,
        fullName: body.fullName.trim(),
        email,
        phone: body.phone,
        type: body.type,
        moveInDate: body.moveInDate || new Date(),
        isActive: true,
      });
    } else {
      resident.isActive = true;
      resident.type = body.type;
      resident.fullName = body.fullName.trim();
      resident.email = email;
      if (body.phone) resident.phone = body.phone;
      await resident.save();
    }

    if (body.type === ResidentType.OWNER) {
      await Apartment.findByIdAndUpdate(apartment._id, {
        owner: account._id,
        isOccupied: true,
      });
    } else {
      await Apartment.findByIdAndUpdate(apartment._id, { isOccupied: true });
    }

    const populated = await Resident.findById(resident._id)
      .populate({
        path: "apartment",
        select: "number floor residence",
        populate: { path: "residence", select: "name city" },
      })
      .populate("user", "name email phone role")
      .lean();

    return json(
      {
        ...populated,
        meta: { createdAccount },
      },
      createdAccount ? 201 : 200
    );
  },
  { roles: [Role.ADMIN, Role.SYNDIC] }
);
