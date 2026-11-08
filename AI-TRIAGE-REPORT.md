# Rapport : analyse IA des photos de réclamation

**Date :** 3 novembre 2026  
**Fonction concernée :** suggestions de titre, description, catégorie et priorité à partir d'une photo.

## Résumé

L'analyse photo passe par Gemini avec le modèle configuré dans `GEMINI_MODEL`. Les journaux communiqués montrent des erreurs du fournisseur, pas un refus causé par la catégorie `OTHER` ni par le texte du prompt :

- `429 RESOURCE_EXHAUSTED` avec `gemini-2.5-flash` : quota gratuit de génération quotidien atteint.
- `404 NOT_FOUND` avec `gemini-2.5-flash` : le message Google indique que ce modèle n'est pas disponible pour les nouveaux utilisateurs de cette clé/projet.
- `503 UNAVAILABLE` lors d'un essai avec `gemini-3.8-flash` : le modèle répondait alors qu'il était sous forte demande.

Ces réponses peuvent varier selon le projet associé à la clé, son accès aux modèles et le quota restant. Le fait qu'une image ait fonctionné la veille ne garantit pas que le quota ou l'accès au modèle soit encore disponible. Réutiliser la même photo ne contourne pas ces limites.

## Parcours du code

1. `components/ai/AiTriagePanel.tsx` envoie au serveur les champs texte saisis et jusqu'à trois images, puis applique la suggestion reçue aux champs du formulaire.
2. `app/api/ai/triage/route.ts` vérifie le rôle, le type et la taille des images, puis appelle `triageIncident`.
3. `lib/ai/triage.ts` construit le prompt et valide la réponse avec `TriageResponseSchema`. Le prompt demande de toujours fournir les champs, même lorsque la catégorie est `OTHER`, et de réserver `URGENT` aux dangers immédiats sérieux.
4. `lib/ai/gemini.ts` envoie texte et images à `GEMINI_MODEL`. Pour une requête avec image, le repli textuel Groq est désactivé : Groq ne reçoit pas la photo.

Extrait du choix de modèle :

```ts
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
```

Extrait de l'appel multimodal :

```ts
const parts: Part[] = [{ text: prompt }];
for (const img of images) {
  parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
}
const res = await getClient().models.generateContent({
  model: GEMINI_MODEL,
  contents: [{ role: "user", parts }],
  config: { responseMimeType: "application/json", temperature: 0.2 },
});
```

Le nom du modèle est donc configurable par `GEMINI_MODEL`; le modifier dans le code ou `.env.local` ne donne pas à la clé un accès ou un quota qu'elle n'a pas.

## Le prompt et la catégorie « Autre »

Le prompt en vigueur spécifie notamment :

```text
- Remplis TOUJOURS title, description, category, priority, specialty,
  probableCause, safetyRisk, confidence et reasoning, même si category vaut OTHER.
- OTHER signifie seulement que le problème ne correspond pas aux catégories principales.
- Ne choisis URGENT que si les éléments montrent un danger immédiat sérieux.
```

Cette consigne influence le contenu d'une réponse générée. Elle ne peut pas corriger une requête rejetée avant génération avec une erreur 429, 404 ou 503. La catégorie `OTHER` ne bloque pas la génération des autres champs.

## Diagnostic et résolution

1. Dans Google AI Studio, vérifier pour **le même projet et la même clé** les modèles actuellement accessibles, leur prise en charge des images et les quotas de génération.
2. Choisir un identifiant exact de modèle image/vision autorisé pour cette clé, puis le définir comme `GEMINI_MODEL` côté serveur.
3. Redémarrer `npm run dev` afin de recharger les variables d'environnement, puis tester une image.
4. Interpréter le résultat : `429` signifie quota/limitation, `404` signifie modèle ou accès indisponible, `503` signifie indisponibilité temporaire du service. Le prompt doit être examiné si le fournisseur répond avec succès mais que les champs sont mauvais ou mal formés.

Un modèle gratuit différent peut avoir un quota distinct, mais son accès, sa disponibilité et sa prise en charge des images doivent être confirmés dans AI Studio. Aucun modèle alternatif ne peut être garanti uniquement par un changement de code.

## Sécurité

Ce rapport ne contient aucune clé ni valeur de `.env.local`. Les clés API doivent rester côté serveur et ne jamais être ajoutées à un rapport partagé. À la suite de leur exposition accidentelle dans une sortie précédente, révoquer les anciennes clés Gemini et Groq et les remplacer localement.
