import { NextRequest } from "next/server";
import mongoose from "mongoose";
import {
  withAuth,
  getResidentApartmentIds,
  getSyndicResidenceIds,
  getResidentResidenceIds,
  type AuthUser,
} from "@/lib/auth-guard";
import { json } from "@/lib/api";
import { Role } from "@/types/enums";

// Types d'entités pris en charge pour la recherche globale
const ALL_TYPES = [
  "incident",
  "announcement",
  "charge",
  "apartment",
  "resident",
  "document",
  "meeting",
] as const;

type SearchType = (typeof ALL_TYPES)[number];

export interface SearchResult {
  type: SearchType;
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  href: string;
}

// Formate une date au format JJ/MM/AAAA
function formatDateFR(dateValue: unknown): string | undefined {
  if (!dateValue) return undefined;
  const d = new Date(dateValue as string | number | Date);
  if (isNaN(d.getTime())) return undefined;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export const GET = withAuth(
  async (req: NextRequest, user: AuthUser) => {
    const { searchParams } = new URL(req.url);
    const rawQ = (searchParams.get("q") || "").trim();

    // Minimum 2 caractères requis après trim
    if (rawQ.length < 2) {
      return json({ data: [] });
    }

    // Filtrage des types demandés (défaut = tous)
    const typesParam = searchParams.get("types");
    const requestedTypes: SearchType[] = typesParam
      ? (typesParam
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter((t): t is SearchType =>
            (ALL_TYPES as readonly string[]).includes(t)
          ) as SearchType[])
      : [...ALL_TYPES];

    if (requestedTypes.length === 0) {
      return json({ data: [] });
    }

    // Échappement des caractères spéciaux regex et recherche insensible à la casse
    const escaped = rawQ.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");

    // Préparation des périmètres par rôle
    let syndicResIds: unknown[] = [];
    let syndicAptIds: unknown[] = [];
    let residentAptIds: unknown[] = [];
    let residentResIds: unknown[] = [];
    let techResIds: unknown[] = [];

    if (user.role === Role.SYNDIC) {
      syndicResIds = await getSyndicResidenceIds(user.id);
      if (
        requestedTypes.includes("charge") ||
        requestedTypes.includes("resident")
      ) {
        syndicAptIds = await mongoose
          .model("Apartment")
          .find({ residence: { $in: syndicResIds } })
          .distinct("_id");
      }
    } else if (user.role === Role.RESIDENT) {
      const needsApt =
        requestedTypes.includes("charge") ||
        requestedTypes.includes("apartment");
      const needsRes =
        requestedTypes.includes("announcement") ||
        requestedTypes.includes("document") ||
        requestedTypes.includes("meeting");

      const [aptIds, resIds] = await Promise.all([
        needsApt ? getResidentApartmentIds(user.id) : Promise.resolve([]),
        needsRes ? getResidentResidenceIds(user.id) : Promise.resolve([]),
      ]);
      residentAptIds = aptIds;
      residentResIds = resIds;
    } else if (user.role === Role.TECHNICIAN) {
      if (requestedTypes.includes("announcement")) {
        techResIds = await mongoose
          .model("Incident")
          .find({ assignedTo: user.id })
          .distinct("residence");
      }
    }

    // Construit le filtre de périmètre pour un type donné (null = accès interdit)
    const getScopeFilter = (
      type: SearchType
    ): Record<string, unknown> | null => {
      switch (user.role) {
        case Role.ADMIN:
          return {};

        case Role.SYNDIC:
          if (type === "charge" || type === "resident") {
            return { apartment: { $in: syndicAptIds } };
          }
          return { residence: { $in: syndicResIds } };

        case Role.RESIDENT:
          switch (type) {
            case "incident":
              return { reportedBy: user.id };
            case "charge":
              return { apartment: { $in: residentAptIds } };
            case "apartment":
              return { _id: { $in: residentAptIds } };
            case "announcement":
            case "document":
            case "meeting":
              return { residence: { $in: residentResIds } };
            case "resident":
              return null; // Interdit aux résidents
          }
          break;

        case Role.TECHNICIAN:
          if (type === "incident") {
            return { assignedTo: user.id };
          }
          if (type === "announcement") {
            return { residence: { $in: techResIds } };
          }
          return null; // Autres types interdits au technicien
      }
      return null;
    };

    // Combine le filtre texte et le filtre de périmètre avec $and
    const buildQuery = (
      textFilter: Record<string, unknown>,
      scopeFilter: Record<string, unknown>
    ) => {
      if (Object.keys(scopeFilter).length === 0) {
        return textFilter;
      }
      return { $and: [textFilter, scopeFilter] };
    };

    // Exécute la recherche pour un type donné avec gestion d'erreur isolée
    const searchByType = async (type: SearchType): Promise<SearchResult[]> => {
      try {
        const scope = getScopeFilter(type);
        if (scope === null) return [];

        switch (type) {
          case "incident": {
            const textFilter = {
              $or: [{ title: regex }, { description: regex }],
            };
            const docs = (await mongoose
              .model("Incident")
              .find(buildQuery(textFilter, scope))
              .select("title category status")
              .limit(5)
              .lean()) as Array<{
              _id: unknown;
              title?: string;
              category?: string;
              status?: string;
            }>;

            return docs.map((d) => {
              const title = d.title || "";
              return {
                type: "incident",
                id: String(d._id),
                title,
                subtitle: d.category,
                badge: d.status,
                href: `/incidents?q=${encodeURIComponent(title)}`,
              };
            });
          }

          case "announcement": {
            const textFilter = {
              $or: [{ title: regex }, { content: regex }],
            };
            const docs = (await mongoose
              .model("Announcement")
              .find(buildQuery(textFilter, scope))
              .select("title content")
              .limit(5)
              .lean()) as Array<{
              _id: unknown;
              title?: string;
              content?: string;
            }>;

            return docs.map((d) => {
              const title = d.title || "";
              return {
                type: "announcement",
                id: String(d._id),
                title,
                subtitle: d.content ? d.content.slice(0, 80) : undefined,
                href: `/announcements?q=${encodeURIComponent(title)}`,
              };
            });
          }

          case "charge": {
            const textFilter = { period: regex };
            const docs = (await mongoose
              .model("Charge")
              .find(buildQuery(textFilter, scope))
              .select("period status apartment")
              .populate("apartment", "number")
              .limit(5)
              .lean()) as Array<{
              _id: unknown;
              period?: string;
              status?: string;
              apartment?: { number?: string } | null;
            }>;

            return docs.map((d) => {
              const period = d.period || "";
              const aptNumber = d.apartment?.number || "";
              return {
                type: "charge",
                id: String(d._id),
                title: `Charge ${period}`,
                subtitle: aptNumber ? `Appartement ${aptNumber}` : undefined,
                badge: d.status,
                href: `/charges?q=${encodeURIComponent(period)}`,
              };
            });
          }

          case "apartment": {
            const textFilter = { number: regex };
            const docs = (await mongoose
              .model("Apartment")
              .find(buildQuery(textFilter, scope))
              .select("number floor")
              .limit(5)
              .lean()) as Array<{
              _id: unknown;
              number?: string;
              floor?: number | string;
            }>;

            return docs.map((d) => {
              const number = d.number || "";
              return {
                type: "apartment",
                id: String(d._id),
                title: `Appartement ${number}`,
                subtitle:
                  d.floor !== undefined && d.floor !== null
                    ? `Étage ${d.floor}`
                    : undefined,
                href: `/apartments?q=${encodeURIComponent(number)}`,
              };
            });
          }

          case "resident": {
            const textFilter = {
              $or: [{ fullName: regex }, { phone: regex }, { email: regex }],
            };
            const docs = (await mongoose
              .model("Resident")
              .find(buildQuery(textFilter, scope))
              .select("fullName email phone")
              .limit(5)
              .lean()) as Array<{
              _id: unknown;
              fullName?: string;
              email?: string;
              phone?: string;
            }>;

            return docs.map((d) => {
              const fullName = d.fullName || "";
              return {
                type: "resident",
                id: String(d._id),
                title: fullName,
                subtitle: d.email || d.phone || undefined,
                href: `/residents?q=${encodeURIComponent(fullName)}`,
              };
            });
          }

          case "document": {
            const textFilter = { title: regex };
            const docs = (await mongoose
              .model("Document")
              .find(buildQuery(textFilter, scope))
              .select("title type")
              .limit(5)
              .lean()) as Array<{
              _id: unknown;
              title?: string;
              type?: string;
            }>;

            return docs.map((d) => {
              const title = d.title || "";
              return {
                type: "document",
                id: String(d._id),
                title,
                badge: d.type,
                href: `/documents?q=${encodeURIComponent(title)}`,
              };
            });
          }

          case "meeting": {
            const textFilter = { title: regex };
            const docs = (await mongoose
              .model("Meeting")
              .find(buildQuery(textFilter, scope))
              .select("title date")
              .limit(5)
              .lean()) as Array<{
              _id: unknown;
              title?: string;
              date?: Date | string;
            }>;

            return docs.map((d) => {
              const title = d.title || "";
              return {
                type: "meeting",
                id: String(d._id),
                title,
                subtitle: formatDateFR(d.date),
                href: `/meetings?q=${encodeURIComponent(title)}`,
              };
            });
          }
        }
      } catch {
        // Une erreur sur un type ne bloque pas les autres résultats
        return [];
      }
    };

    // Exécution en parallèle et limitation à 25 résultats au total
    const resultsPerType = await Promise.all(
      requestedTypes.map((type) => searchByType(type))
    );
    const data = resultsPerType.flat().slice(0, 25);

    return json({ data });
  },
  {
    roles: [Role.ADMIN, Role.SYNDIC, Role.RESIDENT, Role.TECHNICIAN],
  }
);
