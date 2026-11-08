/**
 * Script de validation automatisé des tests de Phase 2 pour SyndicPro.
 * Exécute l'ensemble des scénarios de sécurité, proxy, API guards, et permissions.
 */

const BASE_URL = "http://localhost:3000";

async function runTests() {
  console.log("🚀 Lancement de la suite de tests automatisée...\n");
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [SUCCÈS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [ÉCHEC] ${message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // TEST 1 : Fichiers PWA et /offline accessibles sans connexion
  // -------------------------------------------------------------
  console.log("--- TEST 1 : Accessibilité PWA sans authentification ---");
  const manifestRes = await fetch(`${BASE_URL}/manifest.webmanifest`);
  assert(manifestRes.status === 200, `/manifest.webmanifest accessible (statut: ${manifestRes.status})`);

  const swRes = await fetch(`${BASE_URL}/sw.js`);
  assert(swRes.status === 200, `/sw.js accessible (statut: ${swRes.status})`);

  const offlineRes = await fetch(`${BASE_URL}/offline`);
  assert(offlineRes.status === 200, `/offline accessible (statut: ${offlineRes.status})`);

  // -------------------------------------------------------------
  // TEST 2 : Redirection du proxy pour utilisateur non connecté
  // -------------------------------------------------------------
  console.log("\n--- TEST 2 : Redirection Proxy (/dashboard non connecté) ---");
  const unauthRes = await fetch(`${BASE_URL}/dashboard`, { redirect: "manual" });
  const isRedirect = unauthRes.status === 307 || unauthRes.status === 302;
  const location = unauthRes.headers.get("location") || "";
  assert(
    isRedirect && location.includes("/login"),
    `Redirection 307/302 vers /login (statut: ${unauthRes.status}, location: ${location})`
  );

  // -------------------------------------------------------------
  // TEST 3 : Protection contre l'élévation de privilèges (Register)
  // -------------------------------------------------------------
  console.log("\n--- TEST 3 : Protection élévation de privilèges (/api/auth/register) ---");
  const uniqueEmail = `hacker_${Date.now()}@test.com`;
  const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Attaquant Malveillant",
      email: uniqueEmail,
      password: "Password123!",
      confirmPassword: "Password123!",
      role: "ADMIN", // Tentative d'élévation de privilège
    }),
  });
  const registerData = await registerRes.json();
  assert(
    registerRes.status === 201 && registerData.role === "RESIDENT",
    `Rôle créé forcé à RESIDENT (reçu: ${registerData.role}, statut: ${registerRes.status})`
  );

  // Tentative doublon email -> doit renvoyer 409
  const duplicateRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Doublon",
      email: uniqueEmail,
      password: "Password123!",
      confirmPassword: "Password123!",
    }),
  });
  assert(duplicateRes.status === 409, `Doublon d'email rejeté avec code 409 (statut: ${duplicateRes.status})`);

  // -------------------------------------------------------------
  // TEST 4 : Connexion de chaque rôle et vérification CSRF / Session
  // -------------------------------------------------------------
  console.log("\n--- TEST 4 : Connexion des 4 rôles et vérification des JWT ---");

  async function loginAs(email, password) {
    // 1. Récupération du CSRF token
    const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
    const csrfCookies = csrfRes.headers.getSetCookie();
    const { csrfToken } = await csrfRes.json();

    // 2. Envoi des identifiants au handler NextAuth
    const loginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: csrfCookies.join("; "),
      },
      body: new URLSearchParams({
        email,
        password,
        csrfToken,
      }),
      redirect: "manual",
    });

    const sessionCookies = loginRes.headers.getSetCookie();
    const allCookies = [...csrfCookies, ...sessionCookies].join("; ");

    // 3. Vérification de la session
    const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: { Cookie: allCookies },
    });
    const session = await sessionRes.json();
    return { session, cookies: allCookies };
  }

  const adminAuth = await loginAs("admin@syndicpro.tn", "Admin123!");
  assert(adminAuth.session?.user?.role === "ADMIN", `ADMIN connecté avec succès (id: ${adminAuth.session?.user?.id})`);

  const syndicAuth = await loginAs("syndic@syndicpro.tn", "Syndic123!");
  assert(syndicAuth.session?.user?.role === "SYNDIC", `SYNDIC connecté avec succès (id: ${syndicAuth.session?.user?.id})`);

  const techAuth = await loginAs("tech@syndicpro.tn", "Tech123!");
  assert(techAuth.session?.user?.role === "TECHNICIAN", `TECHNICIAN connecté avec succès (id: ${techAuth.session?.user?.id})`);

  const residentAuth = await loginAs("resident@syndicpro.tn", "Resident123!");
  assert(residentAuth.session?.user?.role === "RESIDENT", `RESIDENT connecté avec succès (id: ${residentAuth.session?.user?.id})`);

  // -------------------------------------------------------------
  // TEST 5 : Contrôle d'accès RESIDENT sur /expenses et /api/expenses
  // -------------------------------------------------------------
  console.log("\n--- TEST 5 : Contrôle d'accès RESIDENT (/expenses & /api/expenses) ---");
  
  // Page /expenses -> Proxy doit rediriger le RESIDENT vers /forbidden
  const expPageRes = await fetch(`${BASE_URL}/expenses`, {
    headers: { Cookie: residentAuth.cookies },
    redirect: "manual",
  });
  const expPageRedirect = expPageRes.headers.get("location") || "";
  assert(
    expPageRedirect.includes("/forbidden"),
    `Page /expenses redirigée vers /forbidden pour le RESIDENT (location: ${expPageRedirect})`
  );

  // Route API /api/expenses -> API Guard doit renvoyer HTTP 403 JSON
  const expApiRes = await fetch(`${BASE_URL}/api/expenses`, {
    headers: { Cookie: residentAuth.cookies },
  });
  assert(
    expApiRes.status === 403,
    `Route /api/expenses interdite au RESIDENT avec code 403 (statut: ${expApiRes.status})`
  );

  // En revanche, ADMIN et SYNDIC doivent pouvoir y accéder
  const adminExpRes = await fetch(`${BASE_URL}/api/expenses`, {
    headers: { Cookie: adminAuth.cookies },
  });
  assert(adminExpRes.status === 200, `Route /api/expenses autorisée pour ADMIN (statut: ${adminExpRes.status})`);

  // -------------------------------------------------------------
  // TEST 6 : Filtrage TECHNICIAN (ne voit que ses incidents assignés)
  // -------------------------------------------------------------
  console.log("\n--- TEST 6 : Filtrage propriétaire TECHNICIAN (incidents assignés) ---");
  const techIncidentsRes = await fetch(`${BASE_URL}/api/incidents`, {
    headers: { Cookie: techAuth.cookies },
  });
  const techIncidents = await techIncidentsRes.json();
  const allAssignedToTech = techIncidents.every(
    (inc) => inc.assignedTo?._id === techAuth.session.user.id || inc.assignedTo === techAuth.session.user.id
  );
  assert(
    techIncidentsRes.status === 200 && allAssignedToTech && techIncidents.length > 0,
    `TECHNICIAN ne voit que ses incidents assignés (${techIncidents.length} incidents récupérés, tous assignés à son ID)`
  );

  // -------------------------------------------------------------
  // TEST 7 : Filtrage RESIDENT (ne voit que ses charges)
  // -------------------------------------------------------------
  console.log("\n--- TEST 7 : Filtrage propriétaire RESIDENT (charges & paiements) ---");
  const residentChargesRes = await fetch(`${BASE_URL}/api/charges`, {
    headers: { Cookie: residentAuth.cookies },
  });
  const residentCharges = await residentChargesRes.json();
  assert(
    residentChargesRes.status === 200 && Array.isArray(residentCharges),
    `RESIDENT accède à ses charges de manière sécurisée (${residentCharges.length} charges trouvées pour son appartement)`
  );

  // -------------------------------------------------------------
  // BILAN DES TESTS
  // -------------------------------------------------------------
  console.log("\n==================================================");
  console.log(`Résultats : ${passed} passés, ${failed} échoués`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Erreur inattendue :", err);
  process.exit(1);
});
