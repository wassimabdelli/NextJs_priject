/**
 * Limiteur de tentatives de connexion en mémoire vive (In-Memory).
 * Note importante d'architecture : Cette limitation réside dans la mémoire du processus Node.js.
 * Elle est adaptée pour une instance unique ou le développement, mais n'est pas partagée
 * entre plusieurs instances scalées horizontalement (pour un déploiement multi-instances,
 * un magasin distribué tel que Redis ou MongoDB TTL index serait préconisé).
 */

interface AttemptRecord {
  count: number;
  blockedUntil: number | null;
  firstAttempt: number;
}

const MAX_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const WINDOW_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const attemptsMap = new Map<string, AttemptRecord>();

export function checkRateLimit(key: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const record = attemptsMap.get(key);

  if (!record) {
    return { allowed: true };
  }

  // Si le compte/IP est temporairement bloqué
  if (record.blockedUntil && record.blockedUntil > now) {
    const retryAfterSeconds = Math.ceil((record.blockedUntil - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  // Si la fenêtre de temps est expirée, on réinitialise
  if (now - record.firstAttempt > WINDOW_DURATION_MS) {
    attemptsMap.delete(key);
    return { allowed: true };
  }

  return { allowed: true };
}

export function recordFailedAttempt(key: string): void {
  const now = Date.now();
  const record = attemptsMap.get(key);

  if (!record || now - record.firstAttempt > WINDOW_DURATION_MS) {
    attemptsMap.set(key, {
      count: 1,
      blockedUntil: null,
      firstAttempt: now,
    });
    return;
  }

  record.count += 1;
  if (record.count >= MAX_ATTEMPTS) {
    record.blockedUntil = now + BLOCK_DURATION_MS;
  }
}

export function resetRateLimit(key: string): void {
  attemptsMap.delete(key);
}
