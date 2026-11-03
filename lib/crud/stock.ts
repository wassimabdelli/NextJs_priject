import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getSyndicResidenceIds } from "@/lib/auth-guard";
import { Role } from "@/types/enums";
import { StockItem } from "@/models/StockItem";
import { Residence } from "@/models/Residence";
import { stockItemCreateSchema } from "@/lib/validations/stock";

/**
 * Erreur HTTP typée pour les routes API du module Stock.
 */
export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Détermine le filtre de portée (scope) par résidence selon le rôle de l'utilisateur.
 * - ADMIN : accès à toutes les résidences
 * - SYNDIC : accès uniquement aux résidences qu'il gère
 * - TECHNICIAN : accès aux résidences rattachées
 */
export async function stockResidenceScope(user: {
  id: string;
  role: Role;
}): Promise<Record<string, unknown>> {
  if (user.role === Role.ADMIN) {
    return {};
  }

  if (user.role === Role.SYNDIC) {
    const residenceIds = await getSyndicResidenceIds(user.id);
    return { residence: { $in: residenceIds } };
  }

  if (user.role === Role.TECHNICIAN) {
    return {};
  }

  throw new HttpError(403, "Accès refusé");
}

interface CrudOptions {
  readRoles: Role[];
  writeRoles: Role[];
}

/**
 * Générateur de gestionnaires CRUD standardisés pour les articles de stock.
 */
function createCrudRoutes(options: CrudOptions) {
  return {
    async GET(req: NextRequest) {
      try {
        const session = await requireAuth();
        if (!options.readRoles.includes(session.role)) {
          throw new HttpError(403, "Accès refusé");
        }

        const scope = await stockResidenceScope(session);

        const { searchParams } = new URL(req.url);
        const page = Math.max(1, Number(searchParams.get("page") || 1));
        const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
        const search = (searchParams.get("search") || "").trim();
        const category = searchParams.get("category") || "";
        const residence = searchParams.get("residence") || "";
        const lowStock = searchParams.get("lowStock") === "true";
        const sortParam = searchParams.get("sort") || "name:asc";

        const query: Record<string, unknown> = { ...scope };

        if (residence) {
          query.residence = residence;
        }
        if (category) {
          query.category = category;
        }
        if (search) {
          query.$or = [
            { name: { $regex: search, $options: "i" } },
            { notes: { $regex: search, $options: "i" } },
          ];
        }
        if (lowStock) {
          query.$expr = {
            $lte: ["$quantity", { $ifNull: ["$minThreshold", "$minQuantity"] }],
          };
        }

        const [sortField, sortDir] = sortParam.includes(":")
          ? sortParam.split(":")
          : [sortParam.replace(/^-/, ""), sortParam.startsWith("-") ? "desc" : "asc"];
        const sortObj: Record<string, 1 | -1> = {
          [sortField || "name"]: sortDir === "desc" ? -1 : 1,
        };

        const [data, total] = await Promise.all([
          StockItem.find(query)
            .populate("residence", "name city")
            .sort(sortObj)
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
          StockItem.countDocuments(query),
        ]);

        return NextResponse.json({
          data,
          meta: { page, limit, total },
        });
      } catch (err) {
        if (err instanceof HttpError) {
          return NextResponse.json({ error: err.message }, { status: err.status });
        }
        const message = err instanceof Error ? err.message : "Erreur serveur";
        const status = message.includes("Non autorisé") || message.includes("Accès") ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
      }
    },

    async POST(req: NextRequest) {
      try {
        const session = await requireAuth();
        if (!options.writeRoles.includes(session.role)) {
          throw new HttpError(403, "Accès refusé");
        }

        const body = await req.json();

        const parsed = stockItemCreateSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: parsed.error.issues[0]?.message || "Données invalides" },
            { status: 400 }
          );
        }

        const validData = parsed.data as Record<string, any>;
        const {
          residence,
          name,
          category,
          quantity,
          minThreshold,
          minQuantity,
          unit,
          location,
          notes,
        } = validData;
        const thresholdValue = minThreshold ?? minQuantity ?? 0;

        // Vérification de l'existence et des droits sur la résidence
        const residenceDoc = await Residence.findById(residence).lean();
        if (!residenceDoc) {
          throw new HttpError(404, "Résidence introuvable");
        }

        if (session.role === Role.SYNDIC) {
          const allowedIds = await getSyndicResidenceIds(session.id);
          const isAllowed = allowedIds.some((id: any) => String(id) === String(residence));
          if (!isAllowed) {
            throw new HttpError(403, "Vous ne gérez pas cette résidence");
          }
        }

        // Contrôle d'unicité (même nom dans la même résidence)
        const existing = await StockItem.findOne({
          residence,
          name: { $regex: `^${name.trim()}$`, $options: "i" },
        }).lean();

        if (existing) {
          throw new HttpError(
            409,
            "Un article portant ce nom existe déjà dans cette résidence"
          );
        }

        const created = await StockItem.create({
          residence,
          name: name.trim(),
          quantity: quantity ?? 0,
          minThreshold: thresholdValue,
          unit: unit ?? "unité",
          location,
          notes,
        } as any);

        const populated = await StockItem.findById((created as any)._id)
          .populate("residence", "name city")
          .lean();

        return NextResponse.json({ data: populated }, { status: 201 });
      } catch (err) {
        if (err instanceof HttpError) {
          return NextResponse.json({ error: err.message }, { status: err.status });
        }
        const message = err instanceof Error ? err.message : "Erreur lors de la création";
        return NextResponse.json({ error: message }, { status: 500 });
      }
    },

    async PATCH(
      req: NextRequest,
      context: { params: Promise<{ id: string }> }
    ) {
      try {
        const session = await requireAuth();
        if (!options.writeRoles.includes(session.role)) {
          throw new HttpError(403, "Accès refusé");
        }

        const { id } = await context.params;
        const body = await req.json();

        const item = await StockItem.findById(id);
        if (!item) {
          throw new HttpError(404, "Article de stock introuvable");
        }

        if (session.role === Role.SYNDIC) {
          const allowedIds = await getSyndicResidenceIds(session.id);
          const isAllowed = allowedIds.some(
            (resId: any) => String(resId) === String(item.residence)
          );
          if (!isAllowed) {
            throw new HttpError(403, "Accès refusé à cette résidence");
          }
        }

        // Contrôle d'unicité si le nom est modifié
        if (body.name && body.name.trim() !== item.name) {
          const duplicate = await StockItem.findOne({
            _id: { $ne: id },
            residence: body.residence || item.residence,
            name: { $regex: `^${body.name.trim()}$`, $options: "i" },
          }).lean();

          if (duplicate) {
            throw new HttpError(
              409,
              "Un article portant ce nom existe déjà dans cette résidence"
            );
          }
        }

        const updated = await StockItem.findByIdAndUpdate(
          id,
          { $set: body },
          { new: true, runValidators: true }
        )
          .populate("residence", "name city")
          .lean();

        return NextResponse.json({ data: updated });
      } catch (err) {
        if (err instanceof HttpError) {
          return NextResponse.json({ error: err.message }, { status: err.status });
        }
        const message = err instanceof Error ? err.message : "Erreur lors de la mise à jour";
        return NextResponse.json({ error: message }, { status: 500 });
      }
    },

    async DELETE(
      _req: NextRequest,
      context: { params: Promise<{ id: string }> }
    ) {
      try {
        const session = await requireAuth();
        if (!options.writeRoles.includes(session.role)) {
          throw new HttpError(403, "Accès refusé");
        }

        const { id } = await context.params;

        const item = await StockItem.findById(id);
        if (!item) {
          throw new HttpError(404, "Article de stock introuvable");
        }

        if (session.role === Role.SYNDIC) {
          const allowedIds = await getSyndicResidenceIds(session.id);
          const isAllowed = allowedIds.some(
            (resId: any) => String(resId) === String(item.residence)
          );
          if (!isAllowed) {
            throw new HttpError(403, "Accès refusé à cette résidence");
          }
        }

        await StockItem.findByIdAndDelete(id);
        return NextResponse.json({ data: { deleted: true } });
      } catch (err) {
        if (err instanceof HttpError) {
          return NextResponse.json({ error: err.message }, { status: err.status });
        }
        const message = err instanceof Error ? err.message : "Erreur lors de la suppression";
        return NextResponse.json({ error: message }, { status: 500 });
      }
    },
  };
}

export const stockItemCrudRoutes = createCrudRoutes({
  readRoles: [Role.ADMIN, Role.SYNDIC, Role.TECHNICIAN],
  writeRoles: [Role.ADMIN, Role.SYNDIC],
});
