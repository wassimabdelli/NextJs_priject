/**
 * Service Worker SyndicPro (PWA)
 * Écrit en JavaScript standard (sans bundler) pour Turbopack et compatibilité totale.
 * Rôles :
 * 1. Installation & pré-mise en cache de l'App Shell minimal (/offline, icônes, manifest)
 * 2. Activation & nettoyage des anciennes versions du cache
 * 3. Stratégies de mise en cache adaptées par type de requête (Network-first, Cache-first, Stale-while-revalidate)
 */

const CACHE_VERSION = "v2";
const CACHE_NAME = `syndicpro-${CACHE_VERSION}`;
const STATIC_CACHE_NAME = `syndicpro-static-${CACHE_VERSION}`;
const DATA_CACHE_NAME = `syndicpro-data-${CACHE_VERSION}`;

// Ressources pré-chargées dès l'installation (App Shell minimal : pas de pages protégées)
const PRECACHE_URLS = [
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
  "/favicon.ico",
];

// --- 1. ÉVÉNEMENT INSTALL ---
// Déclenché à la détection d'un nouveau Service Worker
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        // Pré-mise en cache des pages et assets de l'App Shell minimal
        return cache.addAll(PRECACHE_URLS).catch((err) => {
          console.warn("[SW] Erreur pré-mise en cache partielle :", err);
        });
      })
      .then(() => {
        // Force l'activation immédiate sans attendre la fermeture des onglets existants
        return self.skipWaiting();
      })
  );
});

// --- 2. ÉVÉNEMENT ACTIVATE ---
// Déclenché après l'installation lorsque le SW prend le contrôle
self.addEventListener("activate", (event) => {
  const currentCaches = [CACHE_NAME, STATIC_CACHE_NAME, DATA_CACHE_NAME];

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        // Supprime tous les anciens caches dont le nom ne correspond pas à la version courante
        return Promise.all(
          cacheNames
            .filter((name) => !currentCaches.includes(name))
            .map((name) => {
              console.log("[SW] Nettoyage ancien cache :", name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        // Prend immédiatement le contrôle de toutes les pages ouvertes sans rechargement
        return self.clients.claim();
      })
  );
});

// --- 3. ÉVÉNEMENT FETCH ---
// Interception de toutes les requêtes réseau émises par l'application
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // REGLE 1 : Les requêtes non-GET (POST, PATCH, PUT, DELETE) ne doivent JAMAIS être cachées par le SW
  // Elles sont gérées en amont par la file d'attente IndexedDB (Outbox Dexie) en mode offline.
  if (request.method !== "GET") {
    return;
  }

  // Ne pas intercepter les requêtes cross-origin non nécessaires
  if (url.origin !== self.location.origin) {
    return;
  }

  // REGLE 1bis : Authentification (/api/auth/*, /login, /register) et Documentation (/api-docs, /api/openapi) -> TOUJOURS réseau direct, JAMAIS en cache
  if (
    url.pathname.startsWith("/api/auth/") ||
    url.pathname === "/login" ||
    url.pathname === "/register" ||
    url.pathname.startsWith("/api-docs") ||
    url.pathname.startsWith("/api/openapi")
  ) {
    return; // Laisse passer directement au réseau sans interférence du service worker
  }

  // REGLE 2 : Assets statiques Next.js (_next/static, polices, images, icônes) -> Cache-first
  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".woff2");

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            !networkResponse.redirected &&
            !networkResponse.url.includes("/login")
          ) {
            const responseClone = networkResponse.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // REGLE 3 : Requêtes API (/api/*) -> Network-first avec repli cache (ou Stale-while-revalidate)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // Si le réseau répond avec succès (non redirigé), on actualise le cache de données
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            !networkResponse.redirected &&
            !networkResponse.url.includes("/login")
          ) {
            const responseClone = networkResponse.clone();
            caches.open(DATA_CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Hors ligne : on sert les données fraîches précédentes si disponibles
          return caches.match(request).then((cached) => {
            if (cached) {
              return cached;
            }
            return new Response(
              JSON.stringify({ error: "Hors ligne", offline: true }),
              {
                headers: { "Content-Type": "application/json" },
                status: 503,
              }
            );
          });
        })
    );
    return;
  }

  // REGLE 4 : Navigations / Pages HTML -> Network-first avec repli sur le cache, puis /offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // Mets les pages visitées en cache uniquement après une réponse 200 non redirigée
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            !networkResponse.redirected &&
            !networkResponse.url.includes("/login")
          ) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Échec réseau : tenter de servir la page déjà en cache
          const cachedPage = await caches.match(request);
          if (cachedPage) {
            return cachedPage;
          }
          // Si la page n'a jamais été visitée, servir la page de secours /offline
          const offlineFallback = await caches.match("/offline");
          if (offlineFallback) {
            return offlineFallback;
          }
          return new Response("Application hors ligne. Veuillez vous reconnecter.", {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        })
    );
    return;
  }

  // Par défaut pour les autres requêtes GET
  event.respondWith(
    caches.match(request).then((cached) => {
      return (
        cached ||
        fetch(request).catch(() => {
          return new Response("", { status: 408 });
        })
      );
    })
  );
});

// Écoute de messages postés depuis les composants clients
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  // À la déconnexion : suppression du cache des données et du cache des pages
  if (event.data && event.data.type === "LOGOUT") {
    Promise.all([
      caches.delete(DATA_CACHE_NAME),
      caches.delete(CACHE_NAME),
    ]).then(() => {
      console.log("[SW] Cache de données et cache de pages supprimés suite au LOGOUT");
    });
  }
});
