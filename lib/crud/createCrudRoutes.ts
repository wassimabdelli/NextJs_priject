import type { NextRequest } from "next/server";
import type { Model } from "mongoose";

type MongoFilter<T = any> = Parameters<Model<T>["find"]>[0] | Record<string, any>;
import { z } from "zod";
import { HttpError, isValidObjectId, json, parseBody } from "@/lib/api";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import { Role } from "@/types/enums";

export interface CrudRouteConfig<T = any> {
  model: Model<T>;
  createSchema: z.ZodType<any>;
  updateSchema: z.ZodType<any>;
  access: {
    read?: Role[];
    create?: Role[];
    update?: Role[];
    delete?: Role[];
  };
  scope?: (user: AuthUser, req: NextRequest) => MongoFilter<T> | Promise<MongoFilter<T>>;
  injectOnCreate?: (
    user: AuthUser,
    body: any,
    req: NextRequest
  ) => Record<string, any> | Promise<Record<string, any>>;
  beforeCreate?: (user: AuthUser, body: any, req: NextRequest) => Promise<void> | void;
  beforeDelete?: (id: string, user: AuthUser, req: NextRequest) => Promise<void> | void;
  afterCreate?: (doc: any, user: AuthUser, req: NextRequest) => Promise<void> | void;
  afterUpdate?: (doc: any, user: AuthUser, req: NextRequest) => Promise<void> | void;
  afterDelete?: (deletedDoc: any, user: AuthUser, req: NextRequest) => Promise<void> | void;
  afterList?: (data: any[], req: NextRequest, user: AuthUser) => Promise<any> | any;
  searchFields?: string[];
  defaultSort?: Record<string, 1 | -1> | string;
  populate?: any;
  filterFields?: string[];
  dateField?: string;
  exportColumns?: { key: string; label: string }[];
  exportPopulate?: any;
}

const DATE_PARAM_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Résout une valeur imbriquée via un chemin pointé (ex: "apartment.number").
 */
function resolveDotPath(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  return path.split(".").reduce((acc, part) => (acc != null ? acc[part] : undefined), obj);
}

/**
 * Formate une valeur brute en chaîne pour une cellule CSV.
 */
function formatCsvValue(val: any): string {
  if (val === null || val === undefined) return "";
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? "" : val.toISOString().slice(0, 10);
  }
  if (typeof val === "boolean") {
    return val ? "Oui" : "Non";
  }
  if (Array.isArray(val)) {
    return val.map((item) => formatCsvValue(item)).join(", ");
  }
  if (typeof val === "object") {
    // Support ObjectId ou objet ayant un toString dédié
    if (typeof val.toHexString === "function") {
      return val.toHexString();
    }
    if (typeof val.toString === "function" && val.toString !== Object.prototype.toString) {
      return String(val.toString());
    }
    return JSON.stringify(val);
  }
  return String(val);
}

/**
 * Protège contre l'injection de formules CSV et échappe les séparateurs/guillemets.
 */
function escapeCsvCell(raw: string): string {
  let cell = raw;
  if (/^[=+\-@]/.test(cell)) {
    cell = `'${cell}`;
  }
  if (/[;"\r\n]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

/**
 * Extrait l'identifiant [id] de façon asynchrone pour compatibilité Next.js 15/16.
 */
async function extractId(context?: any): Promise<string | null> {
  if (!context?.params) return null;
  const p = await Promise.resolve(context.params);
  return p?.id || null;
}

/**
 * Fabrique de routes CRUD générique et réutilisable.
 * Produit { list, create, getOne, update, remove } sécurisés et typés.
 */
export function createCrudRoutes<T = any>(config: CrudRouteConfig<T>) {
  const allRoles = [Role.ADMIN, Role.SYNDIC, Role.RESIDENT, Role.TECHNICIAN];
  const readRoles = config.access.read || allRoles;
  const createRoles = config.access.create || [Role.ADMIN, Role.SYNDIC];
  const updateRoles = config.access.update || [Role.ADMIN, Role.SYNDIC];
  const deleteRoles = config.access.delete || [Role.ADMIN, Role.SYNDIC];

  // Construit le filtre combiné (scope + recherche ?q + filtres simples + plage de dates)
  async function buildFilter(req: NextRequest, user: AuthUser): Promise<MongoFilter<T>> {
    const { searchParams } = req.nextUrl;
    const filterConditions: MongoFilter<T>[] = [];

    // 1. Restriction de périmètre métier (Scope)
    if (config.scope) {
      const scopedFilter = await config.scope(user, req);
      if (scopedFilter && Object.keys(scopedFilter).length > 0) {
        filterConditions.push(scopedFilter);
      }
    }

    // 2. Recherche textuelle multi-champs (?q=...)
    const q = searchParams.get("q")?.trim();
    if (q && config.searchFields && config.searchFields.length > 0) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filterConditions.push({
        $or: config.searchFields.map((field) => ({ [field]: regex })),
      } as MongoFilter<T>);
    }

    // 3. Plage de dates (?from=YYYY-MM-DD&to=YYYY-MM-DD)
    if (config.dateField) {
      const fromParam = searchParams.get("from")?.trim();
      const toParam = searchParams.get("to")?.trim();
      const dateRange: Record<string, Date> = {};

      if (fromParam && DATE_PARAM_REGEX.test(fromParam)) {
        const fromDate = new Date(fromParam);
        if (!isNaN(fromDate.getTime())) {
          dateRange.$gte = fromDate;
        }
      }
      if (toParam && DATE_PARAM_REGEX.test(toParam)) {
        const toDate = new Date(`${toParam}T23:59:59.999Z`);
        if (!isNaN(toDate.getTime())) {
          dateRange.$lte = toDate;
        }
      }

      if (Object.keys(dateRange).length > 0) {
        filterConditions.push({ [config.dateField]: dateRange } as MongoFilter<T>);
      }
    }

    // 4. Filtres simples déclarés ou passés en query (?residence=...&status=...)
    searchParams.forEach((value, key) => {
      if (["page", "limit", "q", "sort", "from", "to"].includes(key)) return;
      if (config.filterFields && !config.filterFields.includes(key)) return;

      if (value === "true") {
        filterConditions.push({ [key]: true } as MongoFilter<T>);
      } else if (value === "false") {
        filterConditions.push({ [key]: false } as MongoFilter<T>);
      } else if (value !== "") {
        filterConditions.push({ [key]: value } as MongoFilter<T>);
      }
    });

    return filterConditions.length > 1
      ? { $and: filterConditions }
      : filterConditions[0] || {};
  }

  // Construit l'option de tri par défaut ou personnalisée (?sort=publishedAt:desc)
  function buildSort(req: NextRequest): any {
    const { searchParams } = req.nextUrl;
    let sortOption: any = config.defaultSort || { createdAt: -1 };
    const sortParam = searchParams.get("sort");
    if (sortParam) {
      const [field, direction] = sortParam.split(":");
      if (field) {
        sortOption = { [field]: direction === "asc" ? 1 : -1 };
      }
    }
    return sortOption;
  }

  // -------------------------------------------------------------
  // 1. LISTE (GET /api/<res>)
  // -------------------------------------------------------------
  const list = withAuth(
    async (req: NextRequest, user: AuthUser) => {
      const { searchParams } = req.nextUrl;

      // Pagination avec limite max 50
      const rawPage = parseInt(searchParams.get("page") || "1", 10);
      const rawLimit = parseInt(searchParams.get("limit") || "20", 10);
      const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
      const limit = isNaN(rawLimit) || rawLimit < 1 ? 20 : Math.min(rawLimit, 50);
      const skip = (page - 1) * limit;

      const finalFilter = await buildFilter(req, user);
      const sortOption = buildSort(req);

      // Exécution parallèle des requêtes données + total
      const query = config.model.find(finalFilter).sort(sortOption).skip(skip).limit(limit);

      if (config.populate) {
        query.populate(config.populate);
      }

      const [data, total] = await Promise.all([
        query.lean(),
        config.model.countDocuments(finalFilter),
      ]);

      if (config.afterList) {
        const customResult = await config.afterList(data, req, user);
        if (customResult !== undefined) {
          return customResult instanceof Response ? customResult : json(customResult);
        }
      }

      return json({
        data,
        meta: {
          page,
          limit,
          total,
        },
      });
    },
    { roles: readRoles }
  );

  // -------------------------------------------------------------
  // 1b. EXPORT CSV (GET /api/<res>/export)
  // -------------------------------------------------------------
  const exportCsv = withAuth(
    async (req: NextRequest, user: AuthUser) => {
      if (!config.exportColumns || config.exportColumns.length === 0) {
        throw new HttpError(400, "Export non disponible pour cette ressource");
      }

      const finalFilter = await buildFilter(req, user);
      const sortOption = buildSort(req);

      const query = config.model.find(finalFilter).sort(sortOption).limit(5000);
      const populateOption = config.exportPopulate ?? config.populate;
      if (populateOption) {
        query.populate(populateOption);
      }

      const rows = (await query.lean()) as any[];

      const headerLine = config.exportColumns
        .map((col) => escapeCsvCell(col.label))
        .join(";");

      const dataLines = rows.map((row) =>
        config.exportColumns!
          .map((col) => {
            const rawVal = resolveDotPath(row, col.key);
            return escapeCsvCell(formatCsvValue(rawVal));
          })
          .join(";")
      );

      const csvBody = "\uFEFF" + [headerLine, ...dataLines].join("\r\n") + "\r\n";

      return new Response(csvBody, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="export-${Date.now()}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    },
    { roles: [Role.ADMIN, Role.SYNDIC] }
  );

  // -------------------------------------------------------------
  // 2. CRÉATION (POST /api/<res>)
  // -------------------------------------------------------------
  const create = withAuth(
    async (req: NextRequest, user: AuthUser) => {
      const parsedBody = await parseBody(req, config.createSchema);

      // Idempotence PWA : si clientId est fourni et présent dans le schéma
      const rawClientId = (parsedBody as any)?.clientId;
      if (rawClientId && config.model.schema.path("clientId")) {
        const existing = await config.model.findOne({ clientId: rawClientId }).lean();
        if (existing) {
          return json(existing, 200);
        }
      }

      // Forçage de champs côté serveur (ex: author: session.user.id)
      const injected = config.injectOnCreate
        ? await config.injectOnCreate(user, parsedBody, req)
        : {};

      const docData = {
        ...parsedBody,
        ...injected,
      };

      if (config.beforeCreate) {
        await config.beforeCreate(user, docData, req);
      }

      const created = await config.model.create(docData);
      const resDoc = created.toObject ? created.toObject() : created;
      if (config.afterCreate) {
        await config.afterCreate(resDoc, user, req);
      }
      return json(resDoc, 201);
    },
    { roles: createRoles }
  );

  // -------------------------------------------------------------
  // 3. OBTENIR UN ÉLÉMENT (GET /api/<res>/[id])
  // -------------------------------------------------------------
  const getOne = withAuth(
    async (req: NextRequest, user: AuthUser, context?: any) => {
      const id = await extractId(context);
      if (!isValidObjectId(id)) {
        throw new HttpError(400, "Identifiant invalide");
      }

      const filterConditions: MongoFilter<T>[] = [{ _id: id } as MongoFilter<T>];

      if (config.scope) {
        const scopedFilter = await config.scope(user, req);
        if (scopedFilter && Object.keys(scopedFilter).length > 0) {
          filterConditions.push(scopedFilter);
        }
      }

      const finalFilter: MongoFilter<T> =
        filterConditions.length > 1
          ? { $and: filterConditions }
          : filterConditions[0];

      const query = config.model.findOne(finalFilter);
      if (config.populate) {
        query.populate(config.populate);
      }

      const item = await query.lean();
      if (!item) {
        throw new HttpError(404, "Ressource introuvable");
      }

      return json(item, 200);
    },
    { roles: readRoles }
  );

  // -------------------------------------------------------------
  // 4. MISE À JOUR (PATCH /api/<res>/[id])
  // -------------------------------------------------------------
  const update = withAuth(
    async (req: NextRequest, user: AuthUser, context?: any) => {
      const id = await extractId(context);
      if (!isValidObjectId(id)) {
        throw new HttpError(400, "Identifiant invalide");
      }

      const parsedBody = await parseBody(req, config.updateSchema);

      const filterConditions: MongoFilter<T>[] = [{ _id: id } as MongoFilter<T>];

      if (config.scope) {
        const scopedFilter = await config.scope(user, req);
        if (scopedFilter && Object.keys(scopedFilter).length > 0) {
          filterConditions.push(scopedFilter);
        }
      }

      const finalFilter: MongoFilter<T> =
        filterConditions.length > 1
          ? { $and: filterConditions }
          : filterConditions[0];

      const updated = await config.model
        .findOneAndUpdate(finalFilter, { $set: parsedBody }, { new: true, runValidators: true })
        .lean();

      if (!updated) {
        throw new HttpError(404, "Ressource introuvable ou modification non autorisée");
      }

      if (config.afterUpdate) {
        await config.afterUpdate(updated, user, req);
      }

      return json(updated, 200);
    },
    { roles: updateRoles }
  );

  // -------------------------------------------------------------
  // 5. SUPPRESSION (DELETE /api/<res>/[id])
  // -------------------------------------------------------------
  const remove = withAuth(
    async (req: NextRequest, user: AuthUser, context?: any) => {
      const id = await extractId(context);
      if (!isValidObjectId(id)) {
        throw new HttpError(400, "Identifiant invalide");
      }

      const filterConditions: MongoFilter<T>[] = [{ _id: id } as MongoFilter<T>];

      if (config.scope) {
        const scopedFilter = await config.scope(user, req);
        if (scopedFilter && Object.keys(scopedFilter).length > 0) {
          filterConditions.push(scopedFilter);
        }
      }

      const finalFilter: MongoFilter<T> =
        filterConditions.length > 1
          ? { $and: filterConditions }
          : filterConditions[0];

      if (config.beforeDelete) {
        await config.beforeDelete(id, user, req);
      }

      const deleted = await config.model.findOneAndDelete(finalFilter).lean();

      if (!deleted) {
        throw new HttpError(404, "Ressource introuvable ou suppression non autorisée");
      }

      if (config.afterDelete) {
        await config.afterDelete(deleted, user, req);
      }

      return json({ success: true, message: "Ressource supprimée avec succès" }, 200);
    },
    { roles: deleteRoles }
  );

  return {
    list,
    create,
    getOne,
    update,
    remove,
    exportCsv,
  };
}
