import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getSyndicResidenceIds } from "@/lib/auth-guard";
import { Role } from "@/types/enums";
import { StockItem } from "@/models/StockItem";
import { StockMovement } from "@/models/StockMovement";
import { stockMovementCreateSchema } from "@/lib/validations/stock";
import { HttpError, stockResidenceScope } from "@/lib/crud/stock";

const ALLOWED_ROLES: Role[] = [Role.ADMIN, Role.SYNDIC, Role.TECHNICIAN];

/**
 * GET /api/stock/movements
 * Liste les mouvements de stock d'un article ou d'une résidence.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (!ALLOWED_ROLES.includes(user.role)) {
      throw new HttpError(403, "Accès refusé");
    }

    const scope = await stockResidenceScope(user);

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
    const itemId = searchParams.get("item") || searchParams.get("stockItem") || "";
    const residenceId = searchParams.get("residence") || "";
    const type = searchParams.get("type") || "";

    const query: Record<string, unknown> = {};

    if (itemId) {
      query.item = itemId;
    } else if (residenceId || Object.keys(scope).length > 0) {
      const itemFilter: Record<string, unknown> = { ...scope };
      if (residenceId) {
        itemFilter.residence = residenceId;
      }
      const allowedItems = await StockItem.find(itemFilter).select("_id").lean();
      query.item = { $in: allowedItems.map((i: any) => i._id) };
    }

    if (type) {
      query.type = type;
    }

    const [data, total] = await Promise.all([
      StockMovement.find(query)
        .populate("item", "name unit residence")
        .populate("performedBy", "name role")
        .sort({ movementDate: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      StockMovement.countDocuments(query),
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/stock/movements
 * Enregistre un mouvement de stock (IN, OUT, ADJUST) et met à jour atomiquement la quantité.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (!ALLOWED_ROLES.includes(user.role)) {
      throw new HttpError(403, "Accès refusé");
    }

    const rawBody = await req.json();
    const rawItemId = rawBody.item || rawBody.stockItem;
    if (!rawItemId) {
      throw new HttpError(400, "Article de stock requis");
    }

    const stockItem = await StockItem.findById(rawItemId);
    if (!stockItem) {
      throw new HttpError(404, "Article de stock introuvable");
    }

    const bodyToValidate = {
      ...rawBody,
      item: String(stockItem._id),
      residence: String(stockItem.residence),
      reason: rawBody.reason || rawBody.reference || rawBody.notes || undefined,
    };

    const parsed = stockMovementCreateSchema.safeParse(bodyToValidate);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Données de mouvement invalides" },
        { status: 400 }
      );
    }

    const validData = parsed.data as Record<string, any>;
    const { type, quantity } = validData;
    const reason =
      validData.reason ||
      validData.reference ||
      validData.notes ||
      rawBody.reason ||
      rawBody.reference ||
      rawBody.notes ||
      undefined;
    const reference = validData.reference ?? rawBody.reference;
    const notes = validData.notes ?? rawBody.notes;
    const movementDate = validData.movementDate ?? rawBody.movementDate;

    if (user.role === Role.SYNDIC) {
      const allowedIds = await getSyndicResidenceIds(user.id);
      const isAllowed = allowedIds.some(
        (id: any) => String(id) === String(stockItem.residence)
      );
      if (!isAllowed) {
        throw new HttpError(403, "Vous ne gérez pas la résidence de cet article");
      }
    }

    // Règle métier critique : vérification du stock disponible pour une sortie (OUT)
    if (type === "OUT") {
      if (quantity > stockItem.quantity) {
        throw new HttpError(400, "Stock insuffisant");
      }
    }

    // Mise à jour atomique de la quantité sur le StockItem associé
    const updateOperation =
      type === "IN"
        ? { $inc: { quantity: quantity } }
        : type === "OUT"
        ? { $inc: { quantity: -quantity } }
        : { $set: { quantity: quantity } };

    const updatedItem = await StockItem.findByIdAndUpdate(
      stockItem._id,
      updateOperation,
      { new: true }
    ).lean();

    // Enregistrement du mouvement avec performedBy forcé à user.id et residence depuis stockItem
    const movement = await StockMovement.create({
      residence: stockItem.residence,
      item: stockItem._id,
      type,
      quantity,
      reason,
      reference,
      notes,
      movementDate: movementDate ? new Date(movementDate) : new Date(),
      performedBy: user.id,
    } as any);

    const populatedMovement = await StockMovement.findById((movement as any)._id)
      .populate("item", "name unit quantity minThreshold residence")
      .populate("performedBy", "name role")
      .lean();

    return NextResponse.json(
      { data: populatedMovement, stockItem: updatedItem },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message =
      err instanceof Error ? err.message : "Erreur lors de l'enregistrement du mouvement";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
