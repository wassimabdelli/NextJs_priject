import SwaggerParser from "@apidevtools/swagger-parser";
import { getOpenApiDocument } from "../lib/openapi/generate";

async function validateOpenApi() {
  console.log("🔍 Validation de la spécification OpenAPI avec @apidevtools/swagger-parser...");

  const doc = getOpenApiDocument();
  console.log(`Document généré : ${doc.info.title} v${doc.info.version}`);
  console.log(`Nombre de routes documentées : ${Object.keys(doc.paths || {}).length}`);
  console.log(`Nombre de composants/schémas : ${Object.keys(doc.components?.schemas || {}).length}`);

  try {
    // Validation syntaxique et sémantique formelle OpenAPI v3
    const api = await SwaggerParser.validate(JSON.parse(JSON.stringify(doc)));
    console.log(`✅ Spécification OpenAPI 3.0 100% VALIDE ! (Titre: "${api.info.title}")`);
    process.exit(0);
  } catch (err: unknown) {
    console.error("❌ Erreur de validation OpenAPI :", err);
    process.exit(1);
  }
}

validateOpenApi();
