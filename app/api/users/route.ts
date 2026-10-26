import type { NextRequest } from "next/server";
import { HttpError, isDuplicateKeyError, json, parseBody } from "@/lib/api";
import { User } from "@/models/User";
import { userCreateSchema } from "@/lib/validations/user";
import { hashPassword } from "@/lib/password";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { Role } from "@/types/enums";

/**
 * GET /api/users
 * Réservé aux rôles ADMIN et SYNDIC.
 * Supporte le filtrage par rôle, la recherche textuelle (q) et la pagination { data, meta }.
 */
export const GET = withAuth(
  async (req: NextRequest) => {
    const { searchParams } = req.nextUrl;
    const roleParam = searchParams.get("role");
    const q = searchParams.get("q");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    const filter: Record<string, unknown> = {};
    if (roleParam) {
      filter.role = roleParam;
    }
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("-passwordHash")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    return json({
      data: users,
      meta: {
        page,
        limit,
        total,
      },
    });
  },
  { roles: [Role.ADMIN, Role.SYNDIC] }
);


/**
 * POST /api/users
 * Réservé aux rôles ADMIN et SYNDIC.
 * Règle : Seul un ADMIN peut créer un utilisateur avec le rôle ADMIN ou SYNDIC.
 */
export const POST = withAuth(
  async (req: NextRequest, currentUser: AuthUser) => {
    const data = await parseBody(req, userCreateSchema);

    // Seul un ADMIN a le droit de nommer un ADMIN ou un SYNDIC
    if (currentUser.role !== Role.ADMIN) {
      if (data.role === Role.ADMIN || data.role === Role.SYNDIC) {
        throw new HttpError(403, "Seul un administrateur peut créer un compte ADMIN ou SYNDIC");
      }
    }

    const normalizedEmail = data.email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail }).lean();
    if (existing) {
      throw new HttpError(409, "Un compte avec cette adresse email existe déjà");
    }

    const passwordHash = await hashPassword(data.password);

    try {
      const created = await User.create({
        name: data.name,
        email: normalizedEmail,
        passwordHash,
        phone: data.phone,
        role: data.role,
        isActive: data.isActive ?? true,
      });

      return json(
        {
          _id: created._id.toString(),
          name: created.name,
          email: created.email,
          phone: created.phone,
          role: created.role,
          isActive: created.isActive,
          createdAt: created.createdAt,
        },
        201
      );
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        throw new HttpError(409, "Un compte avec cette adresse email existe déjà");
      }
      throw err;
    }
  },
  { roles: [Role.ADMIN, Role.SYNDIC] }
);
