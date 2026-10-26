# Documentation Postman — SyndicPro API

Ce dossier contient la collection Postman officielle ainsi que l'environnement local pour tester l'ensemble des routes de l'API **SyndicPro** avec authentification automatisée et tests de sécurité.

---

## 1. Fichiers Disponibles

- `SyndicPro.postman_collection.json` : Collection complète contenant toutes les requêtes organisées par ressource avec leurs scripts de validation (`pm.test`).
- `SyndicPro.local.postman_environment.json` : Variables d'environnement préconfigurées pour le développement local (`baseUrl = http://localhost:3000`) et les 4 comptes de test créés par le seed.
- `README.md` : Guide d'utilisation et d'exécution.

---

## 2. Importation dans Postman

1. Ouvrez **Postman**.
2. Cliquez sur le bouton **Import** (en haut à gauche).
3. Glissez-déposez les deux fichiers :
   - `SyndicPro.postman_collection.json`
   - `SyndicPro.local.postman_environment.json`
4. En haut à droite de Postman, sélectionnez l'environnement actif : **`SyndicPro - Local`**.

---

## 3. Authentification Automatisée (Flux Auth.js v5)

L'API SyndicPro s'appuie sur Auth.js (v5) avec des cookies de session HttpOnly (`authjs.session-token`).

Dans le dossier **`00 - Auth`** :
1. **Étape 1 : Récupérer le CSRF Token** :
   - Exécutez `GET /api/auth/csrf`.
   - Le script de test extrait automatiquement le `csrfToken` de la réponse et le stocke dans la variable d'environnement `{{csrfToken}}`.
2. **Étape 2 : Se connecter selon le rôle souhaité** :
   - Pour tester en **ADMIN** : Exécutez `2. Se connecter en ADMIN`.
   - Pour tester en **SYNDIC** : Exécutez `3. Se connecter en SYNDIC`.
   - Pour tester en **TECHNICIAN** : Exécutez `4. Se connecter en TECHNICIAN`.
   - Pour tester en **RESIDENT** : Exécutez `5. Se connecter en RESIDENT`.
   - *Postman gère automatiquement les cookies de session (`authjs.session-token`) et les réinjecte sur toutes les requêtes suivantes.*
3. **Étape 3 : Vérifier la session** :
   - Exécutez `6. Vérifier la session active` (`GET /api/auth/session`) pour confirmer le rôle et l'ID de l'utilisateur connecté.

---

## 4. Identifiants des Comptes de Démonstration (Seed)

| Rôle | Email | Mot de passe | Description des droits |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@syndicpro.tn` | `Admin123!` | Accès total à toutes les ressources et création de syndics/admins |
| **SYNDIC** | `syndic@syndicpro.tn` | `Syndic123!` | Gestion des résidences, lots, charges, paiements, dépenses et techniciens |
| **TECHNICIAN** | `tech@syndicpro.tn` | `Tech123!` | Visualisation et avancement du statut des incidents assignés |
| **RESIDENT** | `resident@syndicpro.tn` | `Resident123!` | Consultation de ses charges (lot A1), paiements et déclaration d'incidents |

---

## 5. Exécution Automatisée avec le Collection Runner

Pour valider l'ensemble des règles de sécurité et l'idempotence des requêtes :
1. Faites un clic droit sur la collection **SyndicPro API** et sélectionnez **Run collection**.
2. Assurez-vous que l'environnement **SyndicPro - Local** est sélectionné.
3. Cliquez sur **Run SyndicPro API**.
4. Les tests automatisés valideront notamment :
   - **401 Unauthorized** : Accès à une route protégée sans cookie de session.
   - **Protection anti-escalade** : L'inscription publique (`POST /api/auth/register`) avec `"role": "ADMIN"` produit un utilisateur avec le rôle forcé `RESIDENT`.
   - **Idempotence offline** : Deux appels successifs à `POST /api/incidents` avec le même `clientId` ne créent qu'un seul incident dans MongoDB (statut 200 au 2e appel).
