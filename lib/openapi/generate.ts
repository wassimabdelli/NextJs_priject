import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { registry } from "./registry";
import { registerAllPaths } from "./paths";

let cachedDocument: ReturnType<OpenApiGeneratorV3["generateDocument"]> | null = null;

/**
 * Génère la spécification OpenAPI 3.0 complète pour l'API SyndicPro.
 * Les schémas Zod et les routes sont enregistrés puis compilés en spécification standard.
 */
export function getOpenApiDocument() {
  if (cachedDocument) {
    return cachedDocument;
  }

  // 1. Enregistre toutes les routes
  registerAllPaths();

  // 2. Générateur OpenAPI v3.0
  const generator = new OpenApiGeneratorV3(registry.definitions);

  cachedDocument = generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title: "SyndicPro API",
      version: "1.0.0",
      description:
        "Documentation interactive de l'API REST de SyndicPro — PWA de gestion de copropriété moderne.\n\n" +
        "### Authentification\n" +
        "L'authentification s'appuie sur Auth.js (v5) avec un cookie JWT HttpOnly nommé `authjs.session-token`. " +
        "Pour tester les routes sécurisées via le bouton **'Try it out'**, connectez-vous préalablement à l'application dans ce même navigateur.\n\n" +
        "### Matrice des rôles\n" +
        "- **ADMIN** : Accès complet à l'ensemble des ressources.\n" +
        "- **SYNDIC** : Gestion des résidences, appartements, charges, règlements, dépenses et techniciens de ses copropriétés.\n" +
        "- **TECHNICIAN** : Consultation et mise à jour de statut des incidents assignés.\n" +
        "- **RESIDENT** : Consultation de ses charges, paiement en ligne, déclaration d'incidents et lecture des annonces.",
      contact: {
        name: "Support Technique SyndicPro",
        email: "contact@syndicpro.tn",
      },
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Serveur de développement local",
      },
    ],
  });

  return cachedDocument;
}
