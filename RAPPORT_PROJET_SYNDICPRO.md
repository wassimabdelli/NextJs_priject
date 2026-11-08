# Rapport ciblé — Gestion des réclamations, annonces et assistance IA

## 1. Objet du rapport

SyndicPro est une application web de gestion de copropriétés développée avec Next.js, TypeScript, MongoDB/Mongoose et Auth.js. Ce rapport se concentre sur le périmètre présenté comme notre contribution : **la gestion des réclamations**, **la gestion des annonces** et les fonctions d’**assistance par intelligence artificielle** associées. Il décrit les écrans et les responsabilités des quatre rôles sans détailler les autres modules de la plateforme.

Les contrôles d’accès sont appliqués côté serveur. Les possibilités visibles dépendent du rôle connecté et, pour le syndic, du périmètre des résidences qu’il gère.

## 2. Écrans concernés

### 2.1 Écran « Incidents & Pannes » — `/incidents`

Cet écran rassemble le tableau de bord des incidents, la liste des réclamations, la recherche et les filtres par statut, catégorie, priorité, résidence, technicien et période. Les gestionnaires peuvent également accéder à un rapport IA sur les incidents.

Le formulaire **« Signaler un incident »** permet de saisir le titre, la description, la catégorie, la priorité et jusqu’à trois photos. L’assistance **« Analyser avec l’IA »** peut proposer une catégorie, une priorité, une spécialité, une cause probable et signaler un risque potentiel. L’utilisateur peut appliquer les suggestions ou les ignorer ; l’analyse ne soumet jamais le formulaire à sa place.

La fiche d’un incident est organisée en onglets :

- **Aperçu** : description, progression, informations de prise en charge et photos initiales.
- **Historique** : événements enregistrés pendant le traitement.
- **Discussion** : échanges associés au dossier.
- **Résolution** : preuve soumise par le technicien et réponse du résident, lorsque l’onglet est disponible.

Les utilisateurs autorisés peuvent demander une **vérification IA de la résolution** lorsque des photos après intervention sont présentes. L’avis et son explication sont affichés comme une aide à la décision ; le résident conserve la confirmation ou le rejet.

### 2.2 Écran « Annonces » — `/announcements`

Le tableau de bord des annonces affiche les annonces accessibles à l’utilisateur, avec recherche, filtres et détails. Pour les gestionnaires, il comprend des indicateurs de publication et de lecture ainsi que des actions de création, de modification et de gestion des annonces.

L’éditeur **« Nouvelle annonce »** permet de choisir la résidence, le titre, le contenu, la catégorie, la priorité, les destinataires, les éventuelles pièces jointes et le mode de publication :

- enregistrer comme brouillon ;
- publier immédiatement ;
- programmer une publication.

Le générateur IA et le panneau de traduction sont intégrés à l’éditeur. Ils assistent la rédaction et la traduction du contenu ; la personne qui gère l’annonce garde la responsabilité de sa vérification et de sa publication. Les résidents peuvent consulter les annonces qui leur sont destinées ; leur lecture peut être enregistrée.

## 3. Rôles dans notre périmètre

| Rôle | Réclamations | Annonces |
|---|---|---|
| **ADMIN** | Vue globale, consultation et gestion des incidents, attribution d’un technicien, consultation des analyses IA et demande d’avis IA sur une résolution. | Gestion globale : création, modification et publication des annonces, consultation des statistiques disponibles. |
| **SYNDIC** | Suit les incidents des résidences qu’il gère, attribue les techniciens, consulte les analyses IA et peut demander un avis IA sur la résolution. | Crée et gère les annonces dans ses résidences, choisit les destinataires et le mode de publication, consulte les indicateurs associés. |
| **RESIDENT** | Signale ses propres incidents, joint des photos, suit leur progression et les échanges. Peut demander une suggestion de triage, puis décider de l’appliquer. Après réception d’une preuve, confirme ou rejette la résolution de son incident. | Consulte les annonces accessibles à son rôle et à sa résidence ; la lecture peut être enregistrée. |
| **TECHNICIAN** | Consulte les incidents qui lui sont assignés, prend en charge l’intervention et soumet une description ainsi que des photos de résolution. Il ne confirme pas à la place du résident. | Consulte les annonces qui lui sont destinées dans le périmètre de ses interventions ; ne crée ni ne publie d’annonce. |

## 4. Cycle de traitement d’une réclamation

1. **Signalement** : le résident décrit le problème, sélectionne une catégorie et une priorité, et peut joindre des photos.
2. **Aide au triage** : l’IA peut proposer une qualification. Le résident examine la proposition et choisit explicitement de l’appliquer ou non.
3. **Recherche de réclamations similaires** : l’application compare le nouveau dossier à des incidents non résolus récents de la même résidence. Aucune fusion ou suppression n’est automatique ; la décision de relier ou d’écarter un doublon reste humaine.
4. **Attribution** : le syndic ou l’administrateur affecte un technicien.
5. **Intervention** : le technicien suit l’incident et peut le prendre en charge, commenter et décrire le travail réalisé.
6. **Preuve** : le technicien soumet la preuve de résolution, qui peut comprendre des photos.
7. **Décision du résident** : lorsque la preuve est en attente alors que l’incident est encore « En cours », le résident déclarant peut confirmer la résolution ou indiquer que le problème persiste. Le syndic, l’administrateur ou le technicien assigné possède également une action distincte de progression du statut jusqu’à « Résolu » ; cette action n’est pas une confirmation du résident.
8. **Traçabilité** : le workflow conserve les informations de suivi, les événements et les échanges associés.

Les statuts métier du dossier sont **Signalé**, **Assigné**, **En cours** et **Résolu**. Les transitions suivent le workflow métier. L’avis IA sur la résolution ne change aucun de ces statuts.

## 5. Fonctions d’IA

### 5.1 Réclamations

- **Triage** : suggestion de catégorie et priorité, accompagnée d’une spécialité, d’une cause probable, d’un indicateur de risque et d’un niveau de confiance. La personne reste responsable de l’application des suggestions.
- **Doublons potentiels** : recherche hybride fondée d’abord sur la similarité vectorielle (embeddings et cosinus), avec repli vers la similarité lexicale de type Jaccard si les embeddings sont indisponibles ou incomplets. La recherche est restreinte aux incidents non résolus récents de la même résidence. Une explication peut aider à examiner les candidats.
- **Vérification de résolution** : comparaison indicative des photos initiales et des photos de résolution. Le résultat est enregistré avec sa date de vérification, sans confirmer ni rejeter le dossier.
- **Rapport IA** : aide à interpréter les indicateurs disponibles sur les incidents.

### 5.2 Annonces

- **Génération ou amélioration de texte** : aide à préparer un brouillon d’annonce.
- **Traduction** : aide à traduire le contenu d’une annonce.
- **Rapport IA** : synthèse en langage naturel des indicateurs de publication et de lecture disponibles.

Les agrégats chiffrés proviennent des données de l’application ; une explication générée par IA ne remplace pas ces chiffres.

### 5.3 Confidentialité et limites

Les appels aux fournisseurs d’IA sont effectués côté serveur. Les textes concernés sont expurgés de certains éléments personnels avant envoi. Les clés API doivent rester dans l’environnement serveur et ne doivent pas être exposées au navigateur.

Gemini est utilisé pour les fonctions texte, vision et embeddings. Groq peut servir de solution de repli pour du texte, mais ne remplace pas Gemini pour l’analyse de photos ou la génération d’embeddings. Sans clé configurée, l’application conserve ses parcours manuels et les actions IA indiquent que le service n’est pas disponible.

**L’IA conseille : elle ne publie pas une annonce, ne modifie pas les permissions, ne soumet pas un signalement à la place de l’utilisateur, ne change pas le statut d’un incident et ne prend pas de décision automatique de fusion ou suppression.**

## 6. Évaluation et vérification

Un jeu de données et un script de mesure sont disponibles dans `scripts/eval-dataset.json` et `scripts/eval-ai.ts`. Le jeu comprend 30 exemples de réclamations et 10 paires pour comparer la détection lexicale et vectorielle. Il permet de mesurer l’exactitude du triage et les résultats de plusieurs seuils de similarité.

Le script d’évaluation effectue des appels aux fournisseurs et peut consommer leur quota. Il doit être lancé volontairement avec une clé configurée ; aucun résultat chiffré n’est avancé dans ce rapport car l’évaluation n’a pas été exécutée.

Les vérifications automatisées connues comprennent les tests unitaires du dépôt, le contrôle TypeScript, la validation OpenAPI et une compilation de production. Elles ne constituent pas à elles seules une validation complète des parcours d’interface avec MongoDB réel, des appels d’IA en direct ou de tous les rôles dans un environnement de bout en bout.

## 7. Conclusion

Le périmètre réclamations-annonces relie le signalement d’un problème, son affectation et son traitement, la preuve de résolution, la confirmation du résident et la communication aux personnes concernées par les annonces. L’IA enrichit ces parcours par des propositions de triage, de comparaison, de vérification visuelle, de rédaction et de traduction. Les décisions métier restent prises par les utilisateurs autorisés, selon leur rôle et leur résidence.
