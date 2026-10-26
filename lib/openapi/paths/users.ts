import { registry, UserCreateSchema, UserUpdateSchema, RoleSchema, ErrorResponseSchema } from "../registry";
import { z } from "zod";

export function registerUsersPaths() {
  // GET /api/users
  registry.registerPath({
    method: "get",
    path: "/api/users",
    tags: ["Utilisateurs"],
    summary: "Lister les utilisateurs du système",
    description:
      "Renvoie la liste des utilisateurs enregistrés sans leur mot de passe hashé. Filtrable par rôle.\n\n**Rôles autorisés** : ADMIN, SYNDIC.",
    security: [{ cookieAuth: [] }],
    request: {
      query: z.object({
        role: RoleSchema.optional().openapi({ description: "Filtrer par rôle utilisateur" }),
      }),
    },
    responses: {
      200: {
        description: "Liste des utilisateurs récupérée avec succès",
        content: {
          "application/json": {
            schema: z.array(
              z.object({
                _id: z.string(),
                name: z.string(),
                email: z.string(),
                phone: z.string().optional(),
                role: RoleSchema,
                isActive: z.boolean(),
                createdAt: z.string().optional(),
              })
            ),
          },
        },
      },
      401: { description: "Non authentifié", content: { "application/json": { schema: ErrorResponseSchema } } },
      403: { description: "Accès refusé : rôle insuffisant", content: { "application/json": { schema: ErrorResponseSchema } } },
      500: { description: "Erreur serveur", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });

  // POST /api/users
  registry.registerPath({
    method: "post",
    path: "/api/users",
    tags: ["Utilisateurs"],
    summary: "Créer un utilisateur avec rôle spécifique",
    description:
      "Permet de créer un compte avec un rôle choisi. Règle de sécurité : Seul un ADMIN peut créer un utilisateur avec le rôle ADMIN ou SYNDIC. Le SYNDIC peut créer des profils TECHNICIAN ou RESIDENT.\n\n**Rôles autorisés** : ADMIN, SYNDIC.",
    security: [{ cookieAuth: [] }],
    request: {
      body: {
        description: "Données du nouvel utilisateur",
        content: {
          "application/json": {
            schema: UserCreateSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        description: "Utilisateur créé avec succès",
        content: {
          "application/json": {
            schema: z.object({
              _id: z.string(),
              name: z.string(),
              email: z.string(),
              phone: z.string().optional(),
              role: RoleSchema,
              isActive: z.boolean(),
              createdAt: z.string().optional(),
            }),
          },
        },
      },
      400: { description: "Données invalides", content: { "application/json": { schema: ErrorResponseSchema } } },
      401: { description: "Non authentifié", content: { "application/json": { schema: ErrorResponseSchema } } },
      403: { description: "Rôle insuffisant pour créer ce niveau de privilège", content: { "application/json": { schema: ErrorResponseSchema } } },
      409: { description: "Adresse email déjà existante", content: { "application/json": { schema: ErrorResponseSchema } } },
      500: { description: "Erreur serveur", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });

  // PATCH /api/users/{id}
  registry.registerPath({
    method: "patch",
    path: "/api/users/{id}",
    tags: ["Utilisateurs"],
    summary: "Modifier le profil ou le statut d'un utilisateur",
    description:
      "Met à jour les informations, le rôle ou le statut actif/inactif d'un compte. Règles de sécurité : un ADMIN ne peut pas se retirer son propre rôle ADMIN ni se désactiver lui-même. Seul un ADMIN peut modifier un compte ADMIN ou SYNDIC.\n\n**Rôles autorisés** : ADMIN, SYNDIC.",
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ description: "Identifiant MongoDB de l'utilisateur à modifier" }),
      }),
      body: {
        description: "Champs modifiables (nom, email, téléphone, rôle, statut isActive)",
        content: {
          "application/json": {
            schema: UserUpdateSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "Utilisateur mis à jour avec succès",
        content: {
          "application/json": {
            schema: z.object({
              _id: z.string(),
              name: z.string(),
              email: z.string(),
              phone: z.string().optional(),
              role: RoleSchema,
              isActive: z.boolean(),
              updatedAt: z.string().optional(),
            }),
          },
        },
      },
      400: { description: "Identifiant invalide ou tentative d'auto-dégradation interdite", content: { "application/json": { schema: ErrorResponseSchema } } },
      401: { description: "Non authentifié", content: { "application/json": { schema: ErrorResponseSchema } } },
      403: { description: "Permissions insuffisantes pour modifier cet utilisateur", content: { "application/json": { schema: ErrorResponseSchema } } },
      404: { description: "Utilisateur introuvable", content: { "application/json": { schema: ErrorResponseSchema } } },
      500: { description: "Erreur serveur", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });
}
